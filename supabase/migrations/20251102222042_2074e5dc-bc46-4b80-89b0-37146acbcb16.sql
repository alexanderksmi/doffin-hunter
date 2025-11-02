-- Add last_tender_sync_at timestamp to organizations table
ALTER TABLE public.organizations
ADD COLUMN last_tender_sync_at timestamp with time zone DEFAULT NULL;

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests from cron jobs
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a daily cleanup job that deletes expired tenders
-- Runs every day at 03:00 AM
SELECT cron.schedule(
  'cleanup-expired-tenders',
  '0 3 * * *',
  $$
  DELETE FROM public.tenders
  WHERE deadline < NOW() - INTERVAL '1 day'
    OR created_at < NOW() - INTERVAL '7 days';
  $$
);

-- Create a nightly sync job that fetches and evaluates tenders for all organizations
-- Runs every day at 02:00 AM
SELECT cron.schedule(
  'nightly-tender-sync',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dcebjaaqjsctalpilftu.supabase.co/functions/v1/fetch-doffin-tenders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjZWJqYWFxanNjdGFscGlsZnR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MTUzOTAsImV4cCI6MjA3NTM5MTM5MH0.EEOfNp9opX4ylKibrAOQ7XPSkebRnnrz-KSbZU5cejw"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);