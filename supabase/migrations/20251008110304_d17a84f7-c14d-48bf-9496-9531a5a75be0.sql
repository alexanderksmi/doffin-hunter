-- Update weight from 2 to 1 for specific keywords
UPDATE public.keywords
SET weight = 1
WHERE keyword IN ('grensesnitt', 'opsjon') AND weight = 2;