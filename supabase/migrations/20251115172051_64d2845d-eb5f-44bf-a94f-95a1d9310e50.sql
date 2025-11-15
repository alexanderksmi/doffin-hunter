-- Remove stage column from tender_owners and add role column
ALTER TABLE public.tender_owners DROP COLUMN stage;
ALTER TABLE public.tender_owners ADD COLUMN role text;

-- Remove stage column from tender_contacts  
ALTER TABLE public.tender_contacts DROP COLUMN stage;

-- Update RLS policies to remove stage references
DROP POLICY IF EXISTS "Editors can manage owners" ON public.tender_owners;
CREATE POLICY "Editors can manage owners"
ON public.tender_owners
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.saved_tenders
    WHERE saved_tenders.id = tender_owners.saved_tender_id
    AND saved_tenders.organization_id = get_user_organization(auth.uid())
  )
  AND user_can_edit(auth.uid())
);

DROP POLICY IF EXISTS "Users can view owners in their organization" ON public.tender_owners;
CREATE POLICY "Users can view owners in their organization"
ON public.tender_owners
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.saved_tenders
    WHERE saved_tenders.id = tender_owners.saved_tender_id
    AND saved_tenders.organization_id = get_user_organization(auth.uid())
  )
);

DROP POLICY IF EXISTS "Editors can manage contacts" ON public.tender_contacts;
CREATE POLICY "Editors can manage contacts"
ON public.tender_contacts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.saved_tenders
    WHERE saved_tenders.id = tender_contacts.saved_tender_id
    AND saved_tenders.organization_id = get_user_organization(auth.uid())
  )
  AND user_can_edit(auth.uid())
);

DROP POLICY IF EXISTS "Users can view contacts in their organization" ON public.tender_contacts;
CREATE POLICY "Users can view contacts in their organization"
ON public.tender_contacts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.saved_tenders
    WHERE saved_tenders.id = tender_contacts.saved_tender_id
    AND saved_tenders.organization_id = get_user_organization(auth.uid())
  )
);