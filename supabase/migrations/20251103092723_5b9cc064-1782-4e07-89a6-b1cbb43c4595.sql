-- Add new columns to saved_tenders for relevance scoring and workflow
ALTER TABLE saved_tenders 
ADD COLUMN IF NOT EXISTS relevance_score integer CHECK (relevance_score >= 1 AND relevance_score <= 100),
ADD COLUMN IF NOT EXISTS time_criticality text CHECK (time_criticality IN ('lav', 'middels', 'høy')),
ADD COLUMN IF NOT EXISTS comments text;

-- Create enum for workflow stages
DO $$ BEGIN
  CREATE TYPE tender_stage AS ENUM (
    'kvalifisering',
    'analyse_planlegging',
    'svarer_anbud',
    'kvalitetssikring',
    'godkjenning',
    'laring'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add workflow columns
ALTER TABLE saved_tenders 
ADD COLUMN IF NOT EXISTS current_stage tender_stage DEFAULT 'kvalifisering',
ADD COLUMN IF NOT EXISTS stage_notes jsonb DEFAULT '{}'::jsonb;

-- Update existing status values to be more clear
-- 'vurdering' = saved in Matches (not yet moved to Mine Løp)
-- 'pagar' = in progress in Mine Løp
UPDATE saved_tenders SET status = 'vurdering' WHERE status NOT IN ('vurdering', 'pagar', 'vunnet', 'tapt', 'trukket');

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_saved_tenders_status ON saved_tenders(status);
CREATE INDEX IF NOT EXISTS idx_saved_tenders_current_stage ON saved_tenders(current_stage);