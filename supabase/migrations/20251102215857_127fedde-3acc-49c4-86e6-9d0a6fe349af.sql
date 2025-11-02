-- First, delete duplicate evaluations keeping only the most recent one
DELETE FROM tender_evaluations a
USING tender_evaluations b
WHERE a.id < b.id
  AND a.tender_id = b.tender_id
  AND a.organization_id = b.organization_id
  AND (a.combination_id IS NULL AND b.combination_id IS NULL OR a.combination_id = b.combination_id);

-- Now add the unique constraint
ALTER TABLE tender_evaluations 
ADD CONSTRAINT tender_evaluations_tender_org_combo_unique 
UNIQUE NULLS NOT DISTINCT (tender_id, organization_id, combination_id);