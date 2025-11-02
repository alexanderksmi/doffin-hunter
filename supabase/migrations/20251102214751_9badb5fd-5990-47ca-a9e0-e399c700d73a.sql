-- Drop the existing unique constraint on doffin_id if it exists
-- and add a composite unique constraint on (doffin_id, org_id)

-- First, drop any existing unique constraint or index on doffin_id alone
DROP INDEX IF EXISTS tenders_doffin_id_idx;
ALTER TABLE tenders DROP CONSTRAINT IF EXISTS tenders_doffin_id_key;

-- Add composite unique constraint to allow same tender for different orgs
ALTER TABLE tenders ADD CONSTRAINT tenders_doffin_id_org_id_key UNIQUE (doffin_id, org_id);