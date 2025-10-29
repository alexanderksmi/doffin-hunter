-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create cron job to fetch tenders 4 times a day (every 6 hours)
-- Runs at 00:00, 06:00, 12:00, and 18:00 UTC
SELECT cron.schedule(
  'fetch-doffin-tenders-sync',
  '0 */6 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://dcebjaaqjsctalpilftu.supabase.co/functions/v1/fetch-doffin-tenders',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjZWJqYWFxanNjdGFscGlsZnR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MTUzOTAsImV4cCI6MjA3NTM5MTM5MH0.EEOfNp9opX4ylKibrAOQ7XPSkebRnnrz-KSbZU5cejw"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);