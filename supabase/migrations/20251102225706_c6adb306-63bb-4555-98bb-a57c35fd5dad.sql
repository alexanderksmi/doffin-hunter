-- Migration 2: Update constraints and clean up data
-- Drop the existing check constraints
ALTER TABLE tender_evaluations DROP CONSTRAINT IF EXISTS tender_evaluations_combination_type_check;
ALTER TABLE partner_graph DROP CONSTRAINT IF EXISTS partner_graph_combination_type_check;

-- Delete old partner graph entries
DELETE FROM partner_graph WHERE combination_type IN ('lead_partner', 'partner_led');

-- Re-add the constraints with all values
ALTER TABLE partner_graph 
ADD CONSTRAINT partner_graph_combination_type_check 
CHECK (combination_type IN ('solo', 'lead_partner', 'partner_led', 'partner_only'));

ALTER TABLE tender_evaluations 
ADD CONSTRAINT tender_evaluations_combination_type_check 
CHECK (combination_type IN ('solo', 'lead_partner', 'partner_led', 'partner_only'));