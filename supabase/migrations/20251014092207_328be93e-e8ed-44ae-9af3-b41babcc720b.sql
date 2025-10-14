-- Update weight for keyword "frittstående" to 4
UPDATE public.keywords 
SET weight = 4, updated_at = now()
WHERE keyword = 'frittstående';