-- Add cached source organization name to shared_tender_links
ALTER TABLE shared_tender_links 
ADD COLUMN cached_source_org_name TEXT;