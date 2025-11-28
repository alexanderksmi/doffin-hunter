-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Editors and admins can update saved tenders" ON public.saved_tenders;
DROP POLICY IF EXISTS "Editors can manage owners" ON public.tender_owners;
DROP POLICY IF EXISTS "Editors can manage contacts" ON public.tender_contacts;

-- Allow editors/admins to update saved tenders (including shared ones)
CREATE POLICY "Editors and admins can update saved tenders"
ON public.saved_tenders
FOR UPDATE
USING (
  user_can_edit(auth.uid())
  AND (
    organization_id = get_user_organization(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.shared_tender_links stl
      WHERE stl.status = 'accepted'
        AND (stl.source_saved_tender_id = saved_tenders.id OR stl.target_saved_tender_id = saved_tenders.id)
        AND (stl.source_organization_id = get_user_organization(auth.uid()) OR stl.target_organization_id = get_user_organization(auth.uid()))
    )
  )
);

-- Allow editors to manage owners on shared tenders
CREATE POLICY "Editors can manage owners"
ON public.tender_owners
FOR ALL
USING (
  user_can_edit(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.saved_tenders st
    WHERE st.id = tender_owners.saved_tender_id
      AND (
        st.organization_id = get_user_organization(auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.shared_tender_links stl
          WHERE stl.status = 'accepted'
            AND (stl.source_saved_tender_id = st.id OR stl.target_saved_tender_id = st.id)
            AND (stl.source_organization_id = get_user_organization(auth.uid()) OR stl.target_organization_id = get_user_organization(auth.uid()))
        )
      )
  )
);

-- Allow editors to manage contacts on shared tenders
CREATE POLICY "Editors can manage contacts"
ON public.tender_contacts
FOR ALL
USING (
  user_can_edit(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.saved_tenders st
    WHERE st.id = tender_contacts.saved_tender_id
      AND (
        st.organization_id = get_user_organization(auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.shared_tender_links stl
          WHERE stl.status = 'accepted'
            AND (stl.source_saved_tender_id = st.id OR stl.target_saved_tender_id = st.id)
            AND (stl.source_organization_id = get_user_organization(auth.uid()) OR stl.target_organization_id = get_user_organization(auth.uid()))
        )
      )
  )
);