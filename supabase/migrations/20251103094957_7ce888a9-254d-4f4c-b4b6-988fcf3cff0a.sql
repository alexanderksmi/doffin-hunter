-- Add RLS policy for deleting saved tenders
CREATE POLICY "Editors and admins can delete saved tenders"
ON public.saved_tenders
FOR DELETE
USING (
  organization_id = get_user_organization(auth.uid())
  AND user_can_edit(auth.uid())
);