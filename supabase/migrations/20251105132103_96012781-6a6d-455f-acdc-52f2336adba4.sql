-- Add unique constraint for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS tender_evaluations_unique_key 
  ON tender_evaluations(tender_id, organization_id, lead_profile_id, COALESCE(partner_profile_id, '00000000-0000-0000-0000-000000000000'::uuid));