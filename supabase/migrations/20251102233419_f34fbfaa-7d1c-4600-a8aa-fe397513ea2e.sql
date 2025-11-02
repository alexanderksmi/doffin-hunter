-- Drop old unique constraint on combination_id
ALTER TABLE tender_evaluations DROP CONSTRAINT IF EXISTS tender_evaluations_tender_org_combo_unique;