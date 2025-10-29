-- Create tender_evaluations table to store evaluation per org per tender per combination
CREATE TABLE public.tender_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  combination_id uuid REFERENCES public.partner_graph(id) ON DELETE CASCADE,
  combination_type text NOT NULL CHECK (combination_type IN ('solo', 'lead_partner', 'partner_lead')),
  lead_profile_id uuid REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  partner_profile_id uuid REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  
  -- Qualification
  all_minimum_requirements_met boolean NOT NULL DEFAULT false,
  met_minimum_requirements jsonb DEFAULT '[]'::jsonb, -- [{keyword, found_in: 'title'|'description'|'cpv'}]
  missing_minimum_requirements jsonb DEFAULT '[]'::jsonb,
  
  -- Relevance scoring
  support_score integer DEFAULT 0,
  negative_score integer DEFAULT 0,
  cpv_score integer DEFAULT 0,
  synergy_bonus integer DEFAULT 0,
  total_score integer DEFAULT 0,
  
  -- Explanation
  matched_support_keywords jsonb DEFAULT '[]'::jsonb, -- [{keyword, weight, found_in}]
  matched_negative_keywords jsonb DEFAULT '[]'::jsonb,
  matched_cpv_codes jsonb DEFAULT '[]'::jsonb,
  explanation text,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  UNIQUE(tender_id, organization_id, combination_id)
);

-- Create indexes for performance
CREATE INDEX idx_tender_evaluations_org ON public.tender_evaluations(organization_id);
CREATE INDEX idx_tender_evaluations_tender ON public.tender_evaluations(tender_id);
CREATE INDEX idx_tender_evaluations_score ON public.tender_evaluations(total_score DESC);
CREATE INDEX idx_tender_evaluations_qualified ON public.tender_evaluations(all_minimum_requirements_met) WHERE all_minimum_requirements_met = true;

-- Enable RLS
ALTER TABLE public.tender_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view evaluations in their organization"
ON public.tender_evaluations
FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Service role can insert evaluations"
ON public.tender_evaluations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update evaluations"
ON public.tender_evaluations
FOR UPDATE
USING (true);

-- Create saved_tenders table for "Mine løp" pipeline
CREATE TABLE public.saved_tenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  evaluation_id uuid NOT NULL REFERENCES public.tender_evaluations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Pipeline status
  status text NOT NULL DEFAULT 'vurdering' CHECK (status IN ('vurdering', 'kvalifisering', 'skriver', 'levert')),
  assigned_to uuid REFERENCES auth.users(id),
  notes text,
  
  -- Activity log
  activity_log jsonb DEFAULT '[]'::jsonb, -- [{timestamp, user_id, action, details}]
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  saved_by uuid NOT NULL,
  
  UNIQUE(tender_id, organization_id)
);

-- Create indexes
CREATE INDEX idx_saved_tenders_org ON public.saved_tenders(organization_id);
CREATE INDEX idx_saved_tenders_status ON public.saved_tenders(status);
CREATE INDEX idx_saved_tenders_assigned ON public.saved_tenders(assigned_to);

-- Enable RLS
ALTER TABLE public.saved_tenders ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view saved tenders in their organization"
ON public.saved_tenders
FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can insert saved tenders in their organization"
ON public.saved_tenders
FOR INSERT
WITH CHECK (organization_id = get_user_organization(auth.uid()) AND saved_by = auth.uid());

CREATE POLICY "Editors and admins can update saved tenders"
ON public.saved_tenders
FOR UPDATE
USING (organization_id = get_user_organization(auth.uid()) AND user_can_edit(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_tender_evaluations_updated_at
BEFORE UPDATE ON public.tender_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_saved_tenders_updated_at
BEFORE UPDATE ON public.saved_tenders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();