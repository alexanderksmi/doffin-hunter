-- Create secure RPC function for creating organization and assigning user as admin
CREATE OR REPLACE FUNCTION public.create_org_for_user(
  org_name text,
  org_domain text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  calling_user_id uuid;
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
  
  -- Create the organization
  INSERT INTO public.organizations (name, domain)
  VALUES (org_name, org_domain)
  RETURNING id INTO new_org_id;
  
  -- Assign the user as admin
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (calling_user_id, new_org_id, 'admin');
  
  RETURN new_org_id;
END;
$$;

-- Update RLS policies for organizations table
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;
DROP POLICY IF EXISTS "Admins can update their organization" ON public.organizations;

-- Recreate policies with proper security
CREATE POLICY "Users can view their own organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (id = get_user_organization(auth.uid()));

CREATE POLICY "Admins can update their organization"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  id = get_user_organization(auth.uid()) 
  AND user_has_role(auth.uid(), 'admin'::app_role)
);

-- Block direct INSERT and DELETE on organizations (only via RPC)
-- No INSERT or DELETE policies = blocked by RLS

-- Update RLS policies for user_roles table
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view roles in their organization" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

-- Recreate policies
CREATE POLICY "Users can view roles in their organization"
ON public.user_roles
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins can manage user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND user_has_role(auth.uid(), 'admin'::app_role)
);

-- Block direct INSERT on user_roles (only via RPC or admin)
-- The above policy handles admin INSERT, RPC uses SECURITY DEFINER

-- Add unique constraint to prevent duplicate user-org relationships
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_roles_user_id_organization_id_key'
  ) THEN
    ALTER TABLE public.user_roles 
    ADD CONSTRAINT user_roles_user_id_organization_id_key 
    UNIQUE (user_id, organization_id);
  END IF;
END $$;

-- Ensure org_id columns are NOT NULL where needed
-- (Most tables already have this, but let's be explicit for key tables)
ALTER TABLE public.company_profiles 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.partners 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.user_roles 
ALTER COLUMN organization_id SET NOT NULL;