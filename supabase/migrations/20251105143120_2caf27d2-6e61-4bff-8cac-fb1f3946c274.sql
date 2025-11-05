-- Update upsert function to handle met_minimum_requirements
CREATE OR REPLACE FUNCTION public.upsert_evaluation_results_with_cleanup(_org_id uuid, _profile_id uuid, _combination_type text, _results jsonb, _criteria_fingerprint text)
 RETURNS TABLE(upserted_count integer, pruned_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_upserted_count integer := 0;
  v_pruned_count integer := 0;
BEGIN
  -- Step 1: Upsert current matches with fingerprint
  INSERT INTO tender_evaluations (
    tender_id, 
    organization_id, 
    lead_profile_id, 
    partner_profile_id, 
    combination_type,
    all_minimum_requirements_met, 
    met_minimum_requirements,
    support_score, 
    negative_score, 
    cpv_score, 
    total_score,
    matched_support_keywords, 
    matched_negative_keywords, 
    matched_cpv_codes, 
    explanation,
    criteria_fingerprint,
    is_active,
    is_manual
  )
  SELECT 
    (r->>'tender_id')::uuid,
    _org_id,
    _profile_id,
    NULL,
    _combination_type,
    (r->'matched_keywords'->>'all_minimum_met')::boolean,
    COALESCE(r->'met_minimum_requirements', '[]'::jsonb),
    (r->'matched_keywords'->>'support_score')::integer,
    0,
    (r->'matched_keywords'->>'cpv_score')::integer,
    (r->>'total_score')::integer,
    COALESCE(r->'matched_keywords'->'support', '[]'::jsonb),
    COALESCE(r->'matched_keywords'->'negative', '[]'::jsonb),
    COALESCE(r->'matched_keywords'->'cpv', '[]'::jsonb),
    r->'matched_keywords'->>'explanation',
    _criteria_fingerprint,
    true,
    false
  FROM jsonb_array_elements(_results) as r
  ON CONFLICT (tender_id, organization_id, lead_profile_id, COALESCE(partner_profile_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET
    all_minimum_requirements_met = EXCLUDED.all_minimum_requirements_met,
    met_minimum_requirements = EXCLUDED.met_minimum_requirements,
    support_score = EXCLUDED.support_score,
    negative_score = EXCLUDED.negative_score,
    cpv_score = EXCLUDED.cpv_score,
    total_score = EXCLUDED.total_score,
    matched_support_keywords = EXCLUDED.matched_support_keywords,
    matched_negative_keywords = EXCLUDED.matched_negative_keywords,
    matched_cpv_codes = EXCLUDED.matched_cpv_codes,
    explanation = EXCLUDED.explanation,
    criteria_fingerprint = EXCLUDED.criteria_fingerprint,
    is_active = true,
    updated_at = now()
  WHERE tender_evaluations.is_manual = false;  -- Only update non-manual rows
  
  GET DIAGNOSTICS v_upserted_count = ROW_COUNT;
  
  -- Step 2: Mark stale evaluations as inactive (cleanup)
  -- Stale = auto-generated + active + (not in current result set OR old fingerprint)
  WITH current_tender_ids AS (
    SELECT (r->>'tender_id')::uuid as tender_id
    FROM jsonb_array_elements(_results) as r
  )
  UPDATE tender_evaluations
  SET 
    is_active = false,
    updated_at = now()
  WHERE 
    organization_id = _org_id
    AND lead_profile_id = _profile_id
    AND combination_type = _combination_type
    AND is_manual = false
    AND is_active = true
    AND (
      -- Not in current result set
      tender_id NOT IN (SELECT tender_id FROM current_tender_ids)
      OR
      -- Has old fingerprint
      (criteria_fingerprint IS DISTINCT FROM _criteria_fingerprint)
    );
  
  GET DIAGNOSTICS v_pruned_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_upserted_count, v_pruned_count;
END;
$function$;