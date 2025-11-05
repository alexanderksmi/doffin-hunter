-- Migration 2: Set-Based SQL Evaluation and CPV Hierarchy

-- CPV Hierarchy table for precise hierarchical matching
CREATE TABLE IF NOT EXISTS public.cpv_hierarchy (
  cpv_code text PRIMARY KEY,
  parent_code text,
  level integer NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cpv_hierarchy_parent ON public.cpv_hierarchy(parent_code);
CREATE INDEX idx_cpv_hierarchy_level ON public.cpv_hierarchy(level);

COMMENT ON TABLE public.cpv_hierarchy IS 'CPV code hierarchy for precise matching. Supports parent-child relationships.';

-- Helper function: Get all CPV codes in hierarchy (including parents)
CREATE OR REPLACE FUNCTION public.get_cpv_with_parents(code text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result text[] := ARRAY[code];
  current_code text := code;
  parent_code text;
BEGIN
  -- Traverse up the hierarchy
  LOOP
    SELECT ch.parent_code INTO parent_code
    FROM public.cpv_hierarchy ch
    WHERE ch.cpv_code = current_code;
    
    EXIT WHEN parent_code IS NULL;
    
    result := result || parent_code;
    current_code := parent_code;
  END LOOP;
  
  RETURN result;
END;
$$;

-- Helper function: Calculate CPV match weight based on hierarchy level
CREATE OR REPLACE FUNCTION public.cpv_match_weight(tender_code text, profile_code text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  exact_match boolean;
  parent_match boolean;
BEGIN
  -- Exact match: highest weight
  IF tender_code = profile_code THEN
    RETURN 10;
  END IF;
  
  -- Check if tender_code is in profile_code's hierarchy
  IF tender_code = ANY(get_cpv_with_parents(profile_code)) THEN
    RETURN 5; -- Parent match
  END IF;
  
  -- Check if profile_code is in tender_code's hierarchy
  IF profile_code = ANY(get_cpv_with_parents(tender_code)) THEN
    RETURN 3; -- Child match (less precise)
  END IF;
  
  RETURN 0; -- No match
END;
$$;

-- Main evaluation function: Set-based batch evaluation
CREATE OR REPLACE FUNCTION public.evaluate_tenders_batch(
  _org_id uuid,
  _profile_ids uuid[]
)
RETURNS TABLE(
  evaluation_id uuid,
  tender_id uuid,
  profile_id uuid,
  total_score integer,
  all_minimum_met boolean,
  matched_keywords jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH fresh_tenders AS (
    -- Only evaluate tenders from last 90 days
    SELECT t.*
    FROM tenders t
    WHERE t.org_id = _org_id
      AND t.published_date >= now() - interval '90 days'
  ),
  profile_criteria AS (
    -- Gather all criteria per profile
    SELECT 
      cp.id as profile_id,
      ARRAY_AGG(DISTINCT mr.keyword) FILTER (WHERE mr.keyword IS NOT NULL) as minimum_reqs,
      ARRAY_AGG(DISTINCT sk.keyword) FILTER (WHERE sk.keyword IS NOT NULL) as support_kws,
      ARRAY_AGG(DISTINCT nk.keyword) FILTER (WHERE nk.keyword IS NOT NULL) as negative_kws,
      ARRAY_AGG(DISTINCT cc.cpv_code) FILTER (WHERE cc.cpv_code IS NOT NULL) as profile_cpv_codes,
      COALESCE(JSONB_OBJECT_AGG(sk.keyword, sk.weight) FILTER (WHERE sk.keyword IS NOT NULL), '{}'::jsonb) as support_weights
    FROM company_profiles cp
    LEFT JOIN minimum_requirements mr ON mr.profile_id = cp.id
    LEFT JOIN support_keywords sk ON sk.profile_id = cp.id
    LEFT JOIN negative_keywords nk ON nk.profile_id = cp.id
    LEFT JOIN cpv_codes cc ON cc.profile_id = cp.id
    WHERE cp.id = ANY(_profile_ids)
      AND cp.organization_id = _org_id
    GROUP BY cp.id
  ),
  evaluated AS (
    SELECT
      gen_random_uuid() as eval_id,
      ft.id as t_id,
      pc.profile_id as p_id,
      
      -- Step 1: Check minimum requirements (all must match)
      CASE 
        WHEN pc.minimum_reqs IS NULL OR array_length(pc.minimum_reqs, 1) IS NULL THEN true
        ELSE (
          SELECT bool_and(
            ft.search_vector @@ plainto_tsquery('norwegian', req)
          )
          FROM unnest(pc.minimum_reqs) as req
        )
      END as all_min_met,
      
      -- Step 2: Hard filter on negative keywords (any match = disqualify)
      CASE
        WHEN pc.negative_kws IS NULL OR array_length(pc.negative_kws, 1) IS NULL THEN true
        ELSE NOT (
          SELECT bool_or(
            ft.search_vector @@ plainto_tsquery('norwegian', neg)
          )
          FROM unnest(pc.negative_kws) as neg
        )
      END as no_negatives,
      
      -- Step 3: Calculate support score (sum of matched keyword weights)
      (
        SELECT COALESCE(SUM((pc.support_weights->>kw)::integer), 0)
        FROM unnest(pc.support_kws) as kw
        WHERE ft.search_vector @@ plainto_tsquery('norwegian', kw)
      ) as supp_score,
      
      -- Step 4: Calculate CPV score (hierarchical matching)
      (
        SELECT COALESCE(SUM(
          GREATEST(
            cpv_match_weight(tc, pc_cpv) * 
            COALESCE((SELECT weight FROM cpv_codes WHERE cpv_code = pc_cpv AND profile_id = pc.profile_id LIMIT 1), 1)
          , 0)
        ), 0)
        FROM unnest(ft.cpv_codes) as tc
        CROSS JOIN unnest(COALESCE(pc.profile_cpv_codes, ARRAY[]::text[])) as pc_cpv
        WHERE cpv_match_weight(tc, pc_cpv) > 0
      ) as cpv_sc,
      
      -- Matched keywords (for explanation)
      (
        SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
          'keyword', kw,
          'weight', (pc.support_weights->>kw)::integer,
          'type', 'support'
        ))
        FROM unnest(pc.support_kws) as kw
        WHERE ft.search_vector @@ plainto_tsquery('norwegian', kw)
      ) as matched_support,
      
      (
        SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
          'keyword', neg,
          'type', 'negative'
        ))
        FROM unnest(pc.negative_kws) as neg
        WHERE ft.search_vector @@ plainto_tsquery('norwegian', neg)
      ) as matched_negative,
      
      (
        SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
          'cpv_code', tc,
          'matched_profile_cpv', pc_cpv,
          'weight', cpv_match_weight(tc, pc_cpv)
        ))
        FROM unnest(ft.cpv_codes) as tc
        CROSS JOIN unnest(COALESCE(pc.profile_cpv_codes, ARRAY[]::text[])) as pc_cpv
        WHERE cpv_match_weight(tc, pc_cpv) > 0
      ) as matched_cpv
      
    FROM fresh_tenders ft
    CROSS JOIN profile_criteria pc
    WHERE pc.profile_id IS NOT NULL
  )
  SELECT
    e.eval_id,
    e.t_id,
    e.p_id,
    CASE
      WHEN NOT e.all_min_met THEN 0
      WHEN NOT e.no_negatives THEN 0
      ELSE e.supp_score + e.cpv_sc
    END as total_sc,
    e.all_min_met,
    JSONB_BUILD_OBJECT(
      'support', COALESCE(e.matched_support, '[]'::jsonb),
      'negative', COALESCE(e.matched_negative, '[]'::jsonb),
      'cpv', COALESCE(e.matched_cpv, '[]'::jsonb),
      'support_score', e.supp_score,
      'cpv_score', e.cpv_sc,
      'all_minimum_met', e.all_min_met,
      'explanation', CASE
        WHEN NOT e.all_min_met THEN 'Failed minimum requirements'
        WHEN NOT e.no_negatives THEN 'Disqualified by negative keywords'
        ELSE 'Qualified'
      END
    ) as matched_kws
  FROM evaluated e
  WHERE e.all_min_met AND e.no_negatives; -- Only return qualified tenders
END;
$$;

COMMENT ON FUNCTION public.evaluate_tenders_batch IS 'Set-based batch evaluation of tenders. Uses tsquery for qualification and hierarchical CPV matching. Returns only qualified tenders.';

-- Helper function: Upsert evaluation results (called by worker)
CREATE OR REPLACE FUNCTION public.upsert_evaluation_results(
  _org_id uuid,
  _lead_profile_id uuid,
  _partner_profile_id uuid,
  _combination_type text,
  _results JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Batch upsert evaluation results
  INSERT INTO tender_evaluations (
    tender_id,
    organization_id,
    lead_profile_id,
    partner_profile_id,
    combination_type,
    all_minimum_requirements_met,
    support_score,
    negative_score,
    cpv_score,
    total_score,
    matched_support_keywords,
    matched_negative_keywords,
    matched_cpv_codes,
    explanation
  )
  SELECT
    (r->>'tender_id')::uuid,
    _org_id,
    _lead_profile_id,
    _partner_profile_id,
    _combination_type,
    (r->'matched_keywords'->>'all_minimum_met')::boolean,
    (r->'matched_keywords'->>'support_score')::integer,
    0, -- negative_score (always 0 since we filter)
    (r->'matched_keywords'->>'cpv_score')::integer,
    (r->>'total_score')::integer,
    COALESCE(r->'matched_keywords'->'support', '[]'::jsonb),
    COALESCE(r->'matched_keywords'->'negative', '[]'::jsonb),
    COALESCE(r->'matched_keywords'->'cpv', '[]'::jsonb),
    r->'matched_keywords'->>'explanation'
  FROM jsonb_array_elements(_results) as r
  ON CONFLICT (tender_id, organization_id, lead_profile_id, COALESCE(partner_profile_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET
    all_minimum_requirements_met = EXCLUDED.all_minimum_requirements_met,
    support_score = EXCLUDED.support_score,
    negative_score = EXCLUDED.negative_score,
    cpv_score = EXCLUDED.cpv_score,
    total_score = EXCLUDED.total_score,
    matched_support_keywords = EXCLUDED.matched_support_keywords,
    matched_negative_keywords = EXCLUDED.matched_negative_keywords,
    matched_cpv_codes = EXCLUDED.matched_cpv_codes,
    explanation = EXCLUDED.explanation,
    updated_at = now();
END;
$$;

-- Function to claim next evaluation job (for worker)
CREATE OR REPLACE FUNCTION public.claim_next_evaluation_job()
RETURNS TABLE(
  job_id uuid,
  organization_id uuid,
  affected_profile_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  -- Atomically claim next pending job
  SELECT id INTO v_job_id
  FROM evaluation_jobs
  WHERE status = 'pending'
    AND run_not_before <= now()
  ORDER BY run_not_before ASC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF v_job_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Mark as running
  UPDATE evaluation_jobs
  SET status = 'running',
      started_at = now(),
      updated_at = now()
  WHERE id = v_job_id;
  
  -- Return job details
  RETURN QUERY
  SELECT 
    ej.id,
    ej.organization_id,
    ej.affected_profile_ids
  FROM evaluation_jobs ej
  WHERE ej.id = v_job_id;
END;
$$;

COMMENT ON FUNCTION public.claim_next_evaluation_job IS 'Atomically claims next pending evaluation job using FOR UPDATE SKIP LOCKED.';