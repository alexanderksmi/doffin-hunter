-- Rollback previous triggers since pg_net is not configured
DROP TRIGGER IF EXISTS trigger_eval_on_minimum_requirements ON minimum_requirements;
DROP TRIGGER IF EXISTS trigger_eval_on_support_keywords ON support_keywords;
DROP TRIGGER IF EXISTS trigger_eval_on_negative_keywords ON negative_keywords;
DROP TRIGGER IF EXISTS trigger_eval_on_cpv_codes ON cpv_codes;
DROP TRIGGER IF EXISTS trigger_eval_on_company_profiles ON company_profiles;
DROP TRIGGER IF EXISTS trigger_eval_on_partner_graph ON partner_graph;
DROP FUNCTION IF EXISTS trigger_tender_evaluation();

-- Enable realtime for tender_evaluations so UI can react to changes
ALTER PUBLICATION supabase_realtime ADD TABLE tender_evaluations;