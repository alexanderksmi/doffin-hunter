-- Add optional payload column for debugging
ALTER TABLE evaluation_jobs 
ADD COLUMN IF NOT EXISTS broadcast_payload jsonb DEFAULT NULL;

-- Enable RLS on evaluation_jobs
ALTER TABLE evaluation_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view jobs in their organization
CREATE POLICY "Users can view evaluation jobs in their organization"
ON evaluation_jobs
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization(auth.uid()));

-- Policy: Service role can manage all jobs
CREATE POLICY "Service role can manage evaluation jobs"
ON evaluation_jobs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Enable realtime for evaluation_jobs
ALTER PUBLICATION supabase_realtime ADD TABLE evaluation_jobs;