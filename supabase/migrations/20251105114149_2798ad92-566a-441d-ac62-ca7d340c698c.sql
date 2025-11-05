-- Migration 1: Evaluation Jobs Queue and Trigger Infrastructure

-- Create evaluation_jobs table (lightweight job queue)
CREATE TABLE IF NOT EXISTS public.evaluation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  affected_profile_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'dead_letter')),
  run_not_before timestamptz NOT NULL DEFAULT now(),
  dedupe_key text UNIQUE NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  error_code text,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS (service role only)
ALTER TABLE public.evaluation_jobs ENABLE ROW LEVEL SECURITY;

-- No public policies - only service role can access
COMMENT ON TABLE public.evaluation_jobs IS 'Job queue for tender evaluations. Service role only.';

-- Indexes for fast job pickup
CREATE INDEX idx_evaluation_jobs_org_status ON public.evaluation_jobs(organization_id, status);
CREATE INDEX idx_evaluation_jobs_status_run_not_before ON public.evaluation_jobs(status, run_not_before) WHERE status = 'pending';
CREATE INDEX idx_evaluation_jobs_dedupe_key ON public.evaluation_jobs(dedupe_key);

-- Trigger function to queue evaluation jobs when criteria change
CREATE OR REPLACE FUNCTION public.queue_evaluation_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    )
    ON CONFLICT (dedupe_key) DO UPDATE
    SET affected_profile_ids = array(
          SELECT DISTINCT unnest(evaluation_jobs.affected_profile_ids || ARRAY[v_profile_id])
        ),
        run_not_before = now() + interval '2 seconds',
        updated_at = now();
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach triggers to all criteria tables

-- support_keywords
DROP TRIGGER IF EXISTS trg_queue_eval_support_keywords ON public.support_keywords;
CREATE TRIGGER trg_queue_eval_support_keywords
AFTER INSERT OR UPDATE OR DELETE ON public.support_keywords
FOR EACH ROW
EXECUTE FUNCTION public.queue_evaluation_job();

-- minimum_requirements
DROP TRIGGER IF EXISTS trg_queue_eval_minimum_requirements ON public.minimum_requirements;
CREATE TRIGGER trg_queue_eval_minimum_requirements
AFTER INSERT OR UPDATE OR DELETE ON public.minimum_requirements
FOR EACH ROW
EXECUTE FUNCTION public.queue_evaluation_job();

-- negative_keywords
DROP TRIGGER IF EXISTS trg_queue_eval_negative_keywords ON public.negative_keywords;
CREATE TRIGGER trg_queue_eval_negative_keywords
AFTER INSERT OR UPDATE OR DELETE ON public.negative_keywords
FOR EACH ROW
EXECUTE FUNCTION public.queue_evaluation_job();

-- cpv_codes
DROP TRIGGER IF EXISTS trg_queue_eval_cpv_codes ON public.cpv_codes;
CREATE TRIGGER trg_queue_eval_cpv_codes
AFTER INSERT OR UPDATE OR DELETE ON public.cpv_codes
FOR EACH ROW
EXECUTE FUNCTION public.queue_evaluation_job();

-- company_profiles (only on profile_name change)
DROP TRIGGER IF EXISTS trg_queue_eval_company_profiles ON public.company_profiles;
CREATE TRIGGER trg_queue_eval_company_profiles
AFTER UPDATE OF profile_name ON public.company_profiles
FOR EACH ROW
WHEN (OLD.profile_name IS DISTINCT FROM NEW.profile_name)
EXECUTE FUNCTION public.queue_evaluation_job();

COMMENT ON FUNCTION public.queue_evaluation_job() IS 'Queues evaluation jobs when search criteria change. Merges jobs per org with 2-second debounce.';