-- Drop the global unique constraint on doffin_id that breaks multi-tenant isolation
-- This constraint prevents the same tender from existing for multiple organizations
ALTER TABLE public.tenders DROP CONSTRAINT IF EXISTS tenders_doffin_id_key;

-- Verify the correct org-scoped constraint exists
-- This ensures uniqueness per organization (doffin_id + org_id)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname IN ('unique_tender_per_org', 'tenders_doffin_id_org_id_key')
  ) THEN
    ALTER TABLE public.tenders 
    ADD CONSTRAINT unique_tender_per_org UNIQUE (doffin_id, org_id);
  END IF;
END $$;