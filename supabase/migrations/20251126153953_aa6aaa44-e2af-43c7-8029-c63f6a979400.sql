-- Add more cached fields needed for accepting invitations
ALTER TABLE shared_tender_links 
ADD COLUMN cached_tender_id UUID,
ADD COLUMN cached_evaluation_id UUID,
ADD COLUMN cached_current_stage TEXT,
ADD COLUMN cached_combination_type TEXT,
ADD COLUMN cached_lead_profile_id UUID,
ADD COLUMN cached_partner_profile_id UUID,
ADD COLUMN cached_stage_notes JSONB DEFAULT '{}'::jsonb;