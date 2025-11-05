-- Add criteria fingerprint and cleanup columns to tender_evaluations
ALTER TABLE tender_evaluations 
  ADD COLUMN IF NOT EXISTS criteria_fingerprint text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS is_manual boolean DEFAULT false NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tender_evaluations_active_org 
  ON tender_evaluations(organization_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_tender_evaluations_fingerprint 
  ON tender_evaluations(lead_profile_id, partner_profile_id, criteria_fingerprint);

CREATE INDEX IF NOT EXISTS idx_tender_evaluations_cleanup 
  ON tender_evaluations(lead_profile_id, is_active, is_manual) 
  WHERE is_active = true AND is_manual = false;

-- Add comment explaining the fingerprint
COMMENT ON COLUMN tender_evaluations.criteria_fingerprint IS 
  'MD5 hash of profile criteria (keywords, CPV codes, weights). Changes when criteria are updated.';

COMMENT ON COLUMN tender_evaluations.is_active IS 
  'False if evaluation is stale (criteria changed) or tender no longer matches. Only active=true shown in radar.';

COMMENT ON COLUMN tender_evaluations.is_manual IS 
  'True if evaluation was manually created or flagged. Manual evaluations are never auto-cleaned up.';