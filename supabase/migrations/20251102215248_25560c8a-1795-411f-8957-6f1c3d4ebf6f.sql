-- Create a function that triggers tender re-evaluation via HTTP request
CREATE OR REPLACE FUNCTION trigger_tender_evaluation()
RETURNS trigger AS $$
DECLARE
  org_id uuid;
  supabase_url text := current_setting('app.settings.supabase_url', true);
  service_key text := current_setting('app.settings.service_role_key', true);
BEGIN
  -- Get organization_id from the changed record
  IF TG_TABLE_NAME IN ('minimum_requirements', 'support_keywords', 'negative_keywords', 'cpv_codes') THEN
    SELECT organization_id INTO org_id
    FROM company_profiles
    WHERE id = COALESCE(NEW.profile_id, OLD.profile_id);
  ELSIF TG_TABLE_NAME = 'company_profiles' THEN
    org_id := COALESCE(NEW.organization_id, OLD.organization_id);
  ELSIF TG_TABLE_NAME = 'partner_graph' THEN
    org_id := COALESCE(NEW.organization_id, OLD.organization_id);
  END IF;

  -- Trigger evaluation in background using pg_net extension
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/evaluate-tenders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('organizationId', org_id)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for all keyword and profile tables
DROP TRIGGER IF EXISTS trigger_eval_on_minimum_requirements ON minimum_requirements;
CREATE TRIGGER trigger_eval_on_minimum_requirements
AFTER INSERT OR UPDATE OR DELETE ON minimum_requirements
FOR EACH ROW EXECUTE FUNCTION trigger_tender_evaluation();

DROP TRIGGER IF EXISTS trigger_eval_on_support_keywords ON support_keywords;
CREATE TRIGGER trigger_eval_on_support_keywords
AFTER INSERT OR UPDATE OR DELETE ON support_keywords
FOR EACH ROW EXECUTE FUNCTION trigger_tender_evaluation();

DROP TRIGGER IF EXISTS trigger_eval_on_negative_keywords ON negative_keywords;
CREATE TRIGGER trigger_eval_on_negative_keywords
AFTER INSERT OR UPDATE OR DELETE ON negative_keywords
FOR EACH ROW EXECUTE FUNCTION trigger_tender_evaluation();

DROP TRIGGER IF EXISTS trigger_eval_on_cpv_codes ON cpv_codes;
CREATE TRIGGER trigger_eval_on_cpv_codes
AFTER INSERT OR UPDATE OR DELETE ON cpv_codes
FOR EACH ROW EXECUTE FUNCTION trigger_tender_evaluation();

DROP TRIGGER IF EXISTS trigger_eval_on_company_profiles ON company_profiles;
CREATE TRIGGER trigger_eval_on_company_profiles
AFTER INSERT OR UPDATE OR DELETE ON company_profiles
FOR EACH ROW EXECUTE FUNCTION trigger_tender_evaluation();

DROP TRIGGER IF EXISTS trigger_eval_on_partner_graph ON partner_graph;
CREATE TRIGGER trigger_eval_on_partner_graph
AFTER INSERT OR UPDATE OR DELETE ON partner_graph
FOR EACH ROW EXECUTE FUNCTION trigger_tender_evaluation();