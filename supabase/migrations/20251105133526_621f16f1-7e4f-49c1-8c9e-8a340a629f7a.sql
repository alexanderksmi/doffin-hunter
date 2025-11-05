
-- Fix minimum requirements logic to use OR instead of AND
CREATE OR REPLACE FUNCTION public.evaluate_tenders_batch(_org_id uuid, _profile_ids uuid[])
 RETURNS TABLE(tender_id uuid, profile_id uuid, total_score integer, all_minimum_met boolean, matched_keywords jsonb, criteria_fingerprint text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH fresh_tenders AS (
    SELECT t.*
    FROM tenders t
    WHERE t.org_id = _org_id
      AND t.published_date >= now() - interval '90 days'
  ),
  -- Build criteria fingerprint per profile (separate CTE)
  criteria_fingerprints AS (
    SELECT 
      cp.id as profile_id,
      md5(
        concat(
          coalesce((SELECT string_agg(keyword, ',' ORDER BY keyword) FROM minimum_requirements mr WHERE mr.profile_id = cp.id), ''),
          '|',
          coalesce((SELECT string_agg(keyword || ':' || weight, ',' ORDER BY keyword) FROM support_keywords sk WHERE sk.profile_id = cp.id), ''),
          '|',
          coalesce((SELECT string_agg(keyword, ',' ORDER BY keyword) FROM negative_keywords nk WHERE nk.profile_id = cp.id), ''),
          '|',
          coalesce((SELECT string_agg(cpv_code || ':' || weight, ',' ORDER BY cpv_code) FROM cpv_codes cc WHERE cc.profile_id = cp.id), '')
        )
      ) as fingerprint
    FROM company_profiles cp
    WHERE cp.id = ANY(_profile_ids)
      AND cp.organization_id = _org_id
  ),
  profile_criteria AS (
    SELECT 
      cp.id as prof_id,
      cf.fingerprint,
      ARRAY_AGG(DISTINCT mr.keyword) FILTER (WHERE mr.keyword IS NOT NULL) as minimum_reqs,
      ARRAY_AGG(DISTINCT sk.keyword) FILTER (WHERE sk.keyword IS NOT NULL) as support_kws,
      ARRAY_AGG(DISTINCT nk.keyword) FILTER (WHERE nk.keyword IS NOT NULL) as negative_kws,
      ARRAY_AGG(DISTINCT cc.cpv_code) FILTER (WHERE cc.cpv_code IS NOT NULL) as profile_cpv_codes,
      COALESCE(JSONB_OBJECT_AGG(sk.keyword, sk.weight) FILTER (WHERE sk.keyword IS NOT NULL), '{}'::jsonb) as support_weights
    FROM company_profiles cp
    JOIN criteria_fingerprints cf ON cf.profile_id = cp.id
    LEFT JOIN minimum_requirements mr ON mr.profile_id = cp.id
    LEFT JOIN support_keywords sk ON sk.profile_id = cp.id
    LEFT JOIN negative_keywords nk ON nk.profile_id = cp.id
    LEFT JOIN cpv_codes cc ON cc.profile_id = cp.id
    WHERE cp.id = ANY(_profile_ids)
      AND cp.organization_id = _org_id
    GROUP BY cp.id, cf.fingerprint
  ),
  evaluated AS (
    SELECT
      ft.id as t_id,
      pc.prof_id as p_id,
      pc.fingerprint as fp,
      -- CHANGED: Use OR logic for minimum requirements (at least one must match)
      CASE 
        WHEN pc.minimum_reqs IS NULL OR array_length(pc.minimum_reqs, 1) IS NULL THEN true
        ELSE (
          SELECT bool_or(ft.search_vector @@ plainto_tsquery('norwegian', req))
          FROM unnest(pc.minimum_reqs) as req
        )
      END as all_min_met,
      CASE
        WHEN pc.negative_kws IS NULL OR array_length(pc.negative_kws, 1) IS NULL THEN true
        ELSE NOT (
          SELECT bool_or(ft.search_vector @@ plainto_tsquery('norwegian', neg))
          FROM unnest(pc.negative_kws) as neg
        )
      END as no_negatives,
      (
        SELECT COALESCE(SUM((pc.support_weights->>kw)::integer), 0)::integer
        FROM unnest(pc.support_kws) as kw
        WHERE ft.search_vector @@ plainto_tsquery('norwegian', kw)
      ) as supp_score,
      (
        SELECT COALESCE(SUM(
          GREATEST(cpv_match_weight(tc, pc_cpv) * 
            COALESCE((SELECT weight FROM cpv_codes WHERE cpv_code = pc_cpv AND cpv_codes.profile_id = pc.prof_id LIMIT 1), 1), 0)
        ), 0)::integer
        FROM unnest(ft.cpv_codes) as tc
        CROSS JOIN unnest(COALESCE(pc.profile_cpv_codes, ARRAY[]::text[])) as pc_cpv
        WHERE cpv_match_weight(tc, pc_cpv) > 0
      ) as cpv_sc,
      (
        SELECT JSONB_AGG(JSONB_BUILD_OBJECT('keyword', kw, 'weight', (pc.support_weights->>kw)::integer, 'type', 'support'))
        FROM unnest(pc.support_kws) as kw
        WHERE ft.search_vector @@ plainto_tsquery('norwegian', kw)
      ) as matched_support,
      (
        SELECT JSONB_AGG(JSONB_BUILD_OBJECT('keyword', neg, 'type', 'negative'))
        FROM unnest(pc.negative_kws) as neg
        WHERE ft.search_vector @@ plainto_tsquery('norwegian', neg)
      ) as matched_negative,
      (
        SELECT JSONB_AGG(JSONB_BUILD_OBJECT('cpv_code', tc, 'matched_profile_cpv', pc_cpv, 'weight', cpv_match_weight(tc, pc_cpv)))
        FROM unnest(ft.cpv_codes) as tc
        CROSS JOIN unnest(COALESCE(pc.profile_cpv_codes, ARRAY[]::text[])) as pc_cpv
        WHERE cpv_match_weight(tc, pc_cpv) > 0
      ) as matched_cpv
    FROM fresh_tenders ft
    CROSS JOIN profile_criteria pc
    WHERE pc.prof_id IS NOT NULL
  )
  SELECT
    e.t_id,
    e.p_id,
    (CASE WHEN NOT e.all_min_met THEN 0 WHEN NOT e.no_negatives THEN 0 ELSE e.supp_score + e.cpv_sc END)::integer,
    e.all_min_met,
    JSONB_BUILD_OBJECT(
      'support', COALESCE(e.matched_support, '[]'::jsonb),
      'negative', COALESCE(e.matched_negative, '[]'::jsonb),
      'cpv', COALESCE(e.matched_cpv, '[]'::jsonb),
      'support_score', e.supp_score,
      'cpv_score', e.cpv_sc,
      'all_minimum_met', e.all_min_met,
      'explanation', CASE WHEN NOT e.all_min_met THEN 'Failed minimum requirements' WHEN NOT e.no_negatives THEN 'Disqualified by negative keywords' ELSE 'Qualified' END
    ),
    e.fp
  FROM evaluated e
  WHERE e.all_min_met AND e.no_negatives;
END;
$function$;
