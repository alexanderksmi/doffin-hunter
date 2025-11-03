-- Create table for contact persons per stage
CREATE TABLE public.tender_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_tender_id UUID NOT NULL REFERENCES public.saved_tenders(id) ON DELETE CASCADE,
  stage tender_stage NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for tender owners per stage
CREATE TABLE public.tender_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_tender_id UUID NOT NULL REFERENCES public.saved_tenders(id) ON DELETE CASCADE,
  stage tender_stage NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for tasks per owner
CREATE TABLE public.tender_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_tender_id UUID NOT NULL REFERENCES public.saved_tenders(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.tender_owners(id) ON DELETE CASCADE,
  stage tender_stage NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT false,
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tender_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tender_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tender_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tender_contacts
CREATE POLICY "Users can view contacts in their organization"
  ON public.tender_contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.saved_tenders
      WHERE saved_tenders.id = tender_contacts.saved_tender_id
      AND saved_tenders.organization_id = get_user_organization(auth.uid())
    )
  );

CREATE POLICY "Editors can manage contacts"
  ON public.tender_contacts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.saved_tenders
      WHERE saved_tenders.id = tender_contacts.saved_tender_id
      AND saved_tenders.organization_id = get_user_organization(auth.uid())
    ) AND user_can_edit(auth.uid())
  );

-- RLS Policies for tender_owners
CREATE POLICY "Users can view owners in their organization"
  ON public.tender_owners FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.saved_tenders
      WHERE saved_tenders.id = tender_owners.saved_tender_id
      AND saved_tenders.organization_id = get_user_organization(auth.uid())
    )
  );

CREATE POLICY "Editors can manage owners"
  ON public.tender_owners FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.saved_tenders
      WHERE saved_tenders.id = tender_owners.saved_tender_id
      AND saved_tenders.organization_id = get_user_organization(auth.uid())
    ) AND user_can_edit(auth.uid())
  );

-- RLS Policies for tender_tasks
CREATE POLICY "Users can view tasks in their organization"
  ON public.tender_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.saved_tenders
      WHERE saved_tenders.id = tender_tasks.saved_tender_id
      AND saved_tenders.organization_id = get_user_organization(auth.uid())
    )
  );

CREATE POLICY "Editors can manage tasks"
  ON public.tender_tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.saved_tenders
      WHERE saved_tenders.id = tender_tasks.saved_tender_id
      AND saved_tenders.organization_id = get_user_organization(auth.uid())
    ) AND user_can_edit(auth.uid())
  );

-- Add triggers for updated_at
CREATE TRIGGER update_tender_contacts_updated_at
  BEFORE UPDATE ON public.tender_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tender_owners_updated_at
  BEFORE UPDATE ON public.tender_owners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tender_tasks_updated_at
  BEFORE UPDATE ON public.tender_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();