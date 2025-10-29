-- Delete all existing users and their related data
TRUNCATE TABLE public.user_roles CASCADE;
TRUNCATE TABLE public.saved_tenders CASCADE;
TRUNCATE TABLE public.tender_evaluations CASCADE;
TRUNCATE TABLE public.partners CASCADE;
TRUNCATE TABLE public.partner_graph CASCADE;
TRUNCATE TABLE public.cpv_codes CASCADE;
TRUNCATE TABLE public.support_keywords CASCADE;
TRUNCATE TABLE public.negative_keywords CASCADE;
TRUNCATE TABLE public.minimum_requirements CASCADE;
TRUNCATE TABLE public.company_profiles CASCADE;
TRUNCATE TABLE public.organizations CASCADE;

-- Note: Users in auth.users are managed by Supabase Auth
-- They will be cleaned up automatically when organizations are deleted due to cascade