-- Drop notification settings table
DROP TABLE IF EXISTS public.notification_settings;

-- Remove notified field from tenders table
ALTER TABLE public.tenders DROP COLUMN IF EXISTS notified;

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant necessary permissions to postgres role for cron
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create a cron job to fetch tenders daily at 2 AM
SELECT cron.schedule(
  'fetch-doffin-tenders-daily',
  '0 2 * * *', -- Every day at 2 AM
  $$
  SELECT
    net.http_post(
        url:='https://dcebjaaqjsctalpilftu.supabase.co/functions/v1/fetch-doffin-tenders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjZWJqYWFxanNjdGFscGlsZnR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MTUzOTAsImV4cCI6MjA3NTM5MTM5MH0.EEOfNp9opX4ylKibrAOQ7XPSkebRnnrz-KSbZU5cejw"}'::jsonb
    ) as request_id;
  $$
);