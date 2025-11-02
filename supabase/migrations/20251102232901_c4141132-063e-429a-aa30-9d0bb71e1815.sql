-- Drop old unique constraint
ALTER TABLE tender_evaluations DROP CONSTRAINT IF EXISTS tender_evaluations_tender_id_organization_id_combination_id_key;

-- Add new unique constraint using lead_profile_id
ALTER TABLE tender_evaluations 
ADD CONSTRAINT tender_evaluations_tender_id_organization_id_lead_profile_key 
UNIQUE (tender_id, organization_id, lead_profile_id);