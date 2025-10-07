-- Allow anyone to delete tenders (for clearing database functionality)
CREATE POLICY "Anyone can delete tenders" 
ON public.tenders
FOR DELETE
USING (true);