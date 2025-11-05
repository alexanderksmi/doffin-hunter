-- Drop the existing unique constraint on dedupe_key
ALTER TABLE public.evaluation_jobs DROP CONSTRAINT evaluation_jobs_dedupe_key_key;

-- Create a partial unique index that only applies to pending and running jobs
CREATE UNIQUE INDEX evaluation_jobs_active_dedupe_key 
ON public.evaluation_jobs (dedupe_key) 
WHERE status IN ('pending', 'running');

-- Update the queue_evaluation_job function to handle this correctly
CREATE OR REPLACE FUNCTION public.queue_evaluation_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_dedupe_key text;
  v_existing_job_id uuid;
  v_existing_profiles uuid[];
BEGIN
  -- Determine profile_id from NEW or OLD
  v_profile_id := COALESCE(NEW.profile_id, OLD.profile_id);
  
  -- Get organization_id from company_profiles
  SELECT organization_id INTO v_org_id
  FROM public.company_profiles
  WHERE id = v_profile_id;
  
  -- If no org found, skip (orphaned data)
  IF v_org_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Org-level dedupe key
  v_dedupe_key := 'org:' || v_org_id::text;
  
  -- Check if pending/running job already exists for this org
  SELECT id, affected_profile_ids INTO v_existing_job_id, v_existing_profiles
  FROM public.evaluation_jobs
  WHERE dedupe_key = v_dedupe_key
    AND status IN ('pending', 'running')
  FOR UPDATE;
  
  IF v_existing_job_id IS NOT NULL THEN
    -- Merge affected_profile_ids (union, not overwrite)
    UPDATE public.evaluation_jobs
    SET affected_profile_ids = array(
          SELECT DISTINCT unnest(affected_profile_ids || ARRAY[v_profile_id])
        ),
        run_not_before = now() + interval '2 seconds',
        updated_at = now()
    WHERE id = v_existing_job_id;
  ELSE
    -- Insert new job with 2-second debounce
    INSERT INTO public.evaluation_jobs (
      organization_id,
      affected_profile_ids,
      status,
      run_not_before,
      dedupe_key
    ) VALUES (
      v_org_id,
      ARRAY[v_profile_id],
      'pending',
      now() + interval '2 seconds',
      v_dedupe_key
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;