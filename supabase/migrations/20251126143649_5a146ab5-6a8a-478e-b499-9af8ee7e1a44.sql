-- Update create_org_for_user function to normalize domain
CREATE OR REPLACE FUNCTION public.create_org_for_user(org_name text, org_domain text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id uuid;
  calling_user_id uuid;
  user_email text;
  email_domain text;
  domain_to_use text;
  existing_org_id uuid;
  normalized_domain text;
  
  -- Liste over kjente offentlige e-postdomener
  public_domains text[] := ARRAY[
    'gmail.com', 'googlemail.com', 
    'hotmail.com', 'outlook.com', 'live.com', 
    'yahoo.com', 'yahoo.no',
    'icloud.com', 'me.com', 'mac.com',
    'aol.com', 'protonmail.com', 'proton.me',
    'mail.com', 'zoho.com'
  ];
BEGIN
  -- Get the calling user's ID
  calling_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Check if user already has an organization (idempotency)
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = calling_user_id
  ) THEN
    RAISE EXCEPTION 'User already has an organization';
  END IF;
  
  -- Get user's email
  SELECT email INTO user_email 
  FROM auth.users 
  WHERE id = calling_user_id;
  
  -- Extract domain from email and normalize
  email_domain := LOWER(TRIM(split_part(user_email, '@', 2)));
  
  -- Normalize the provided org_domain
  normalized_domain := LOWER(TRIM(REGEXP_REPLACE(org_domain, '^www\.', '', 'i')));
  normalized_domain := REGEXP_REPLACE(normalized_domain, '\.+$', '');
  
  -- Determine which domain to use for organization matching
  IF email_domain = ANY(public_domains) THEN
    -- User has public email domain - use the normalized org_domain they provided
    domain_to_use := normalized_domain;
  ELSE
    -- User has company email domain - use that instead (also normalized)
    domain_to_use := email_domain;
  END IF;
  
  -- Check if an organization with this normalized domain already exists
  SELECT id INTO existing_org_id
  FROM public.organizations
  WHERE LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(domain, '^www\.', '', 'i'), '\.+$', ''))) = domain_to_use
  LIMIT 1;
  
  IF existing_org_id IS NOT NULL THEN
    -- Organization exists - add user as viewer
    INSERT INTO public.user_roles (user_id, organization_id, role)
    VALUES (calling_user_id, existing_org_id, 'viewer');
    
    RETURN existing_org_id;
  ELSE
    -- Organization doesn't exist - create new one with normalized domain
    INSERT INTO public.organizations (name, domain)
    VALUES (org_name, domain_to_use)
    RETURNING id INTO new_org_id;
    
    -- Set user as admin (they're creating the org)
    INSERT INTO public.user_roles (user_id, organization_id, role)
    VALUES (calling_user_id, new_org_id, 'admin');
    
    RETURN new_org_id;
  END IF;
END;
$function$;