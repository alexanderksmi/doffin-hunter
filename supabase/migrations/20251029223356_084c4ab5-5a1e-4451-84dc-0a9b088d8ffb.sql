-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

-- Create enum for partner graph combination types
CREATE TYPE public.partner_combination_type AS ENUM ('solo', 'lead_partner', 'partner_led');

-- Organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  billing_status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- User roles table (stores which users belong to which org with which role)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Partners table (companies that an org partners with)
CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  partner_name TEXT NOT NULL,
  partner_domain TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Company profiles (for both own org and partners)
CREATE TABLE public.company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  profile_name TEXT NOT NULL,
  is_own_profile BOOLEAN DEFAULT false,
  partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

-- Minimum requirements (mandatory keywords that must match)
CREATE TABLE public.minimum_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.company_profiles(id) ON DELETE CASCADE NOT NULL,
  keyword TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.minimum_requirements ENABLE ROW LEVEL SECURITY;

-- Support keywords (positive keywords with weights)
CREATE TABLE public.support_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.company_profiles(id) ON DELETE CASCADE NOT NULL,
  keyword TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.support_keywords ENABLE ROW LEVEL SECURITY;

-- Negative keywords (keywords with negative weights)
CREATE TABLE public.negative_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.company_profiles(id) ON DELETE CASCADE NOT NULL,
  keyword TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT -1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.negative_keywords ENABLE ROW LEVEL SECURITY;

-- CPV codes with weights
CREATE TABLE public.cpv_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.company_profiles(id) ON DELETE CASCADE NOT NULL,
  cpv_code TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.cpv_codes ENABLE ROW LEVEL SECURITY;

-- Partner graph (generates all valid partner combinations)
CREATE TABLE public.partner_graph (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  combination_type partner_combination_type NOT NULL,
  lead_profile_id UUID REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  partner_profile_id UUID REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.partner_graph ENABLE ROW LEVEL SECURITY;

-- Security definer function to get user's organization
CREATE OR REPLACE FUNCTION public.get_user_organization(user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.user_roles
  WHERE user_roles.user_id = get_user_organization.user_id
  LIMIT 1;
$$;

-- Security definer function to check if user has a specific role in their org
CREATE OR REPLACE FUNCTION public.user_has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = _role
  );
$$;

-- Security definer function to check if user has admin or editor role
CREATE OR REPLACE FUNCTION public.user_can_edit(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('admin', 'editor')
  );
$$;

-- RLS Policies for organizations
CREATE POLICY "Users can view their own organization"
  ON public.organizations FOR SELECT
  USING (id = public.get_user_organization(auth.uid()));

CREATE POLICY "Admins can update their organization"
  ON public.organizations FOR UPDATE
  USING (id = public.get_user_organization(auth.uid()) AND public.user_has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view roles in their organization"
  ON public.user_roles FOR SELECT
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Admins can manage user roles"
  ON public.user_roles FOR ALL
  USING (organization_id = public.get_user_organization(auth.uid()) AND public.user_has_role(auth.uid(), 'admin'));

-- RLS Policies for partners
CREATE POLICY "Users can view partners in their organization"
  ON public.partners FOR SELECT
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Admins can manage partners"
  ON public.partners FOR ALL
  USING (organization_id = public.get_user_organization(auth.uid()) AND public.user_has_role(auth.uid(), 'admin'));

-- RLS Policies for company_profiles
CREATE POLICY "Users can view profiles in their organization"
  ON public.company_profiles FOR SELECT
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Editors and admins can manage profiles"
  ON public.company_profiles FOR ALL
  USING (organization_id = public.get_user_organization(auth.uid()) AND public.user_can_edit(auth.uid()));

-- RLS Policies for minimum_requirements
CREATE POLICY "Users can view minimum requirements"
  ON public.minimum_requirements FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.company_profiles
    WHERE company_profiles.id = minimum_requirements.profile_id
    AND company_profiles.organization_id = public.get_user_organization(auth.uid())
  ));

CREATE POLICY "Editors and admins can manage minimum requirements"
  ON public.minimum_requirements FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.company_profiles
    WHERE company_profiles.id = minimum_requirements.profile_id
    AND company_profiles.organization_id = public.get_user_organization(auth.uid())
  ) AND public.user_can_edit(auth.uid()));

-- RLS Policies for support_keywords
CREATE POLICY "Users can view support keywords"
  ON public.support_keywords FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.company_profiles
    WHERE company_profiles.id = support_keywords.profile_id
    AND company_profiles.organization_id = public.get_user_organization(auth.uid())
  ));

CREATE POLICY "Editors and admins can manage support keywords"
  ON public.support_keywords FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.company_profiles
    WHERE company_profiles.id = support_keywords.profile_id
    AND company_profiles.organization_id = public.get_user_organization(auth.uid())
  ) AND public.user_can_edit(auth.uid()));

-- RLS Policies for negative_keywords
CREATE POLICY "Users can view negative keywords"
  ON public.negative_keywords FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.company_profiles
    WHERE company_profiles.id = negative_keywords.profile_id
    AND company_profiles.organization_id = public.get_user_organization(auth.uid())
  ));

CREATE POLICY "Editors and admins can manage negative keywords"
  ON public.negative_keywords FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.company_profiles
    WHERE company_profiles.id = negative_keywords.profile_id
    AND company_profiles.organization_id = public.get_user_organization(auth.uid())
  ) AND public.user_can_edit(auth.uid()));

-- RLS Policies for cpv_codes
CREATE POLICY "Users can view cpv codes"
  ON public.cpv_codes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.company_profiles
    WHERE company_profiles.id = cpv_codes.profile_id
    AND company_profiles.organization_id = public.get_user_organization(auth.uid())
  ));

CREATE POLICY "Editors and admins can manage cpv codes"
  ON public.cpv_codes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.company_profiles
    WHERE company_profiles.id = cpv_codes.profile_id
    AND company_profiles.organization_id = public.get_user_organization(auth.uid())
  ) AND public.user_can_edit(auth.uid()));

-- RLS Policies for partner_graph
CREATE POLICY "Users can view partner graph in their organization"
  ON public.partner_graph FOR SELECT
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Admins can manage partner graph"
  ON public.partner_graph FOR ALL
  USING (organization_id = public.get_user_organization(auth.uid()) AND public.user_has_role(auth.uid(), 'admin'));

-- Create triggers for updated_at columns
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_profiles_updated_at
  BEFORE UPDATE ON public.company_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_support_keywords_updated_at
  BEFORE UPDATE ON public.support_keywords
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_negative_keywords_updated_at
  BEFORE UPDATE ON public.negative_keywords
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cpv_codes_updated_at
  BEFORE UPDATE ON public.cpv_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();