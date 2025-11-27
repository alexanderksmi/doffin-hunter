-- Add cached_target_org_name to shared_tender_links
ALTER TABLE shared_tender_links 
ADD COLUMN cached_target_org_name text;