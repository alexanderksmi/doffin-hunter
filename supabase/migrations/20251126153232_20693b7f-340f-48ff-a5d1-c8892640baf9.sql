-- Add cached tender fields to shared_tender_links
-- so invitations can display tender info without needing to read source saved_tender
ALTER TABLE shared_tender_links
ADD COLUMN cached_tender_title TEXT,
ADD COLUMN cached_tender_client TEXT,
ADD COLUMN cached_tender_deadline TIMESTAMPTZ,
ADD COLUMN cached_tender_doffin_url TEXT;