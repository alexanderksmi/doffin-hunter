-- Make tenders table publicly readable
DROP POLICY IF EXISTS "Users can view their own tenders" ON public.tenders;
CREATE POLICY "Anyone can view tenders" ON public.tenders FOR SELECT USING (true);

-- Make keywords table publicly readable and writable
DROP POLICY IF EXISTS "Users can view their own keywords" ON public.keywords;
DROP POLICY IF EXISTS "Users can create their own keywords" ON public.keywords;
DROP POLICY IF EXISTS "Users can update their own keywords" ON public.keywords;
DROP POLICY IF EXISTS "Users can delete their own keywords" ON public.keywords;

CREATE POLICY "Anyone can view keywords" ON public.keywords FOR SELECT USING (true);
CREATE POLICY "Anyone can insert keywords" ON public.keywords FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update keywords" ON public.keywords FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete keywords" ON public.keywords FOR DELETE USING (true);

-- Remove user_id column from keywords table since we don't need it anymore
ALTER TABLE public.keywords DROP COLUMN IF EXISTS user_id;