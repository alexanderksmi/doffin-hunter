-- First, delete all existing tenders since they don't have org_id
-- and we can't assign them to any specific organization
TRUNCATE TABLE public.tenders;

-- Now add org_id and source_updated_at columns
ALTER TABLE public.tenders
ADD COLUMN org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
ADD COLUMN source_updated_at timestamp with time zone DEFAULT now();

-- Create index on org_id for performance
CREATE INDEX idx_tenders_org_id ON public.tenders(org_id);

-- Create index on source_updated_at for incremental updates
CREATE INDEX idx_tenders_source_updated_at ON public.tenders(source_updated_at);

-- Add unique constraint on doffin_id and org_id to prevent duplicates per org
ALTER TABLE public.tenders
ADD CONSTRAINT unique_tender_per_org UNIQUE (doffin_id, org_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Anyone can view tenders" ON public.tenders;
DROP POLICY IF EXISTS "Anyone can delete tenders" ON public.tenders;
DROP POLICY IF EXISTS "Authenticated users can view tenders" ON public.tenders;

-- Create new org-based RLS policies
CREATE POLICY "Users can view tenders in their organization"
ON public.tenders
FOR SELECT
USING (org_id = get_user_organization(auth.uid()));

CREATE POLICY "Service role can insert tenders"
ON public.tenders
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can delete tenders in their organization"
ON public.tenders
FOR DELETE
USING (org_id = get_user_organization(auth.uid()) AND user_has_role(auth.uid(), 'admin'::app_role));

-- Create tender_sync_log table for tracking sync operations
CREATE TABLE public.tender_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  fetched_count integer DEFAULT 0,
  saved_count integer DEFAULT 0,
  error_message text,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))
);

-- Enable RLS on tender_sync_log
ALTER TABLE public.tender_sync_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view sync logs
CREATE POLICY "Admins can view sync logs"
ON public.tender_sync_log
FOR SELECT
USING (user_has_role(auth.uid(), 'admin'::app_role));