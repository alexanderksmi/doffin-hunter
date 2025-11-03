-- Drop the existing status check constraint
ALTER TABLE public.saved_tenders 
DROP CONSTRAINT IF EXISTS saved_tenders_status_check;

-- Add updated status check constraint that includes 'pagar'
ALTER TABLE public.saved_tenders 
ADD CONSTRAINT saved_tenders_status_check 
CHECK (status IN ('vurdering', 'kvalifisering', 'skriver', 'levert', 'pagar'));