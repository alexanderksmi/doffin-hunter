-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create enum for keyword categories
CREATE TYPE keyword_category AS ENUM ('positive', 'negative');

-- Create tenders table with full-text search
CREATE TABLE public.tenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doffin_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  client TEXT,
  deadline TIMESTAMPTZ,
  cpv_codes TEXT[],
  score INTEGER DEFAULT 0,
  matched_keywords JSONB DEFAULT '[]'::jsonb,
  doffin_url TEXT,
  published_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  notified BOOLEAN DEFAULT false,
  -- Full-text search column
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('norwegian', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('norwegian', coalesce(body, '')), 'B')
  ) STORED
);

-- Create index for full-text search
CREATE INDEX tenders_search_idx ON public.tenders USING GIN (search_vector);
CREATE INDEX tenders_score_idx ON public.tenders (score DESC);
CREATE INDEX tenders_created_at_idx ON public.tenders (created_at DESC);

-- Enable RLS
ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;

-- RLS policies for tenders (authenticated users can read all)
CREATE POLICY "Authenticated users can view tenders"
  ON public.tenders FOR SELECT
  TO authenticated
  USING (true);

-- Create keywords table
CREATE TABLE public.keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL UNIQUE,
  weight INTEGER DEFAULT 1,
  category keyword_category NOT NULL DEFAULT 'positive',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;

-- RLS policies for keywords
CREATE POLICY "Authenticated users can view keywords"
  ON public.keywords FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert keywords"
  ON public.keywords FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update keywords"
  ON public.keywords FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete keywords"
  ON public.keywords FOR DELETE
  TO authenticated
  USING (true);

-- Insert default keywords
INSERT INTO public.keywords (keyword, weight, category) VALUES
  ('integrasjon', 2, 'positive'),
  ('API', 2, 'positive'),
  ('grensesnitt', 2, 'positive'),
  ('Noark', 3, 'positive'),
  ('sak/arkiv', 3, 'positive'),
  ('journalføring', 2, 'positive'),
  ('eInnsyn', 2, 'positive'),
  ('KS Fiks', 2, 'positive'),
  ('opsjon', 1, 'positive'),
  ('arkivkjerne', 3, 'positive'),
  ('modul', 1, 'positive'),
  ('underleverandør', 1, 'positive'),
  ('deltilbud', 1, 'positive'),
  ('samspill', 1, 'positive'),
  ('frittstående arkiv', 2, 'positive'),
  ('skannertjenester', -2, 'negative'),
  ('fysisk depot', -2, 'negative'),
  ('magasin', -2, 'negative');

-- Create settings table for notifications
CREATE TABLE public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_webhook_url TEXT,
  alert_email TEXT,
  score_threshold INTEGER DEFAULT 3,
  high_score_threshold INTEGER DEFAULT 5,
  weekly_summary_enabled BOOLEAN DEFAULT true,
  instant_alerts_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Only one settings row
INSERT INTO public.notification_settings (id) VALUES ('00000000-0000-0000-0000-000000000001');

-- RLS policies for settings
CREATE POLICY "Authenticated users can view settings"
  ON public.notification_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update settings"
  ON public.notification_settings FOR UPDATE
  TO authenticated
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for keywords
CREATE TRIGGER update_keywords_updated_at
  BEFORE UPDATE ON public.keywords
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for notification_settings
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();