-- Remove "frittstående arkiv" keyword
DELETE FROM public.keywords
WHERE keyword = 'frittstående arkiv';

-- Add "frittstående" keyword with weight 3
INSERT INTO public.keywords (keyword, weight, category)
VALUES ('frittstående', 3, 'positive');