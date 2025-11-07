-- Enable Row Level Security on cpv_hierarchy table
ALTER TABLE public.cpv_hierarchy ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read CPV hierarchy data (public reference data)
CREATE POLICY "Anyone can view CPV hierarchy"
ON public.cpv_hierarchy
FOR SELECT
TO authenticated
USING (true);

-- Only service role can manage CPV hierarchy data
CREATE POLICY "Service role can manage CPV hierarchy"
ON public.cpv_hierarchy
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');