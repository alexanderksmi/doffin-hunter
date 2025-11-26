-- Enable Realtime for remaining tables (chat and links already added)

-- Add remaining tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE saved_tenders;
ALTER PUBLICATION supabase_realtime ADD TABLE tender_owners;
ALTER PUBLICATION supabase_realtime ADD TABLE tender_contacts;

-- Set REPLICA IDENTITY FULL to capture all changes
ALTER TABLE saved_tenders REPLICA IDENTITY FULL;
ALTER TABLE tender_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE tender_owners REPLICA IDENTITY FULL;
ALTER TABLE tender_contacts REPLICA IDENTITY FULL;
ALTER TABLE shared_tender_links REPLICA IDENTITY FULL;