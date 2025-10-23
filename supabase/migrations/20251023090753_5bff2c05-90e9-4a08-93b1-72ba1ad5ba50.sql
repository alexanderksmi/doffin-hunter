-- Add three required keywords with weight 3
INSERT INTO public.keywords (keyword, weight, category) VALUES
  ('arkiv', 3, 'positive'),
  ('arkivkjerne', 3, 'positive'),
  ('eiendomsarkiv', 3, 'positive')
ON CONFLICT DO NOTHING;