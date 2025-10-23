-- Slett alle anbud som ikke har minst ett av de påkrevde nøkkelordene
DELETE FROM public.tenders
WHERE NOT (
  matched_keywords::jsonb @> '[{"keyword": "arkiv"}]'::jsonb OR
  matched_keywords::jsonb @> '[{"keyword": "arkivkjerne"}]'::jsonb OR
  matched_keywords::jsonb @> '[{"keyword": "eiendomsarkiv"}]'::jsonb
);

-- Enable realtime for tenders table
ALTER PUBLICATION supabase_realtime ADD TABLE public.tenders;