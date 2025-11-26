-- Make target_organization_id nullable to support pending invitations
-- where the partner hasn't registered yet
ALTER TABLE shared_tender_links 
ALTER COLUMN target_organization_id DROP NOT NULL;

-- Add a check constraint to ensure either target_organization_id exists
-- or status is 'pending' (for future partner registrations)
ALTER TABLE shared_tender_links 
ADD CONSTRAINT target_org_required_unless_pending 
CHECK (
  target_organization_id IS NOT NULL 
  OR status = 'pending'
);