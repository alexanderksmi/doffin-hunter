-- Add combination tracking columns to saved_tenders
ALTER TABLE saved_tenders 
ADD COLUMN combination_type text NOT NULL DEFAULT 'solo',
ADD COLUMN lead_profile_id uuid,
ADD COLUMN partner_profile_id uuid;

-- Add foreign key constraints
ALTER TABLE saved_tenders
ADD CONSTRAINT saved_tenders_lead_profile_fkey 
FOREIGN KEY (lead_profile_id) REFERENCES company_profiles(id) ON DELETE CASCADE;

ALTER TABLE saved_tenders
ADD CONSTRAINT saved_tenders_partner_profile_fkey 
FOREIGN KEY (partner_profile_id) REFERENCES company_profiles(id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX idx_saved_tenders_combination ON saved_tenders(combination_type, lead_profile_id, partner_profile_id);