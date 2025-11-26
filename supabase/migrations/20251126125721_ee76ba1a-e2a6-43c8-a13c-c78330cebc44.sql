-- Fase 1: Database-endringer for anbudsdeling + chat-wall + beskyttelse mot sletting

-- Steg 1.1: Oppdater saved_tenders med nye kolonner
ALTER TABLE saved_tenders
ADD COLUMN cached_title TEXT,
ADD COLUMN cached_client TEXT,
ADD COLUMN cached_deadline TIMESTAMPTZ,
ADD COLUMN cached_doffin_url TEXT,
ADD COLUMN editing_by UUID REFERENCES auth.users(id),
ADD COLUMN editing_started_at TIMESTAMPTZ,
ADD COLUMN is_shared BOOLEAN DEFAULT false;

-- Steg 1.2: Opprett shared_tender_links-tabell
CREATE TABLE shared_tender_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_organization_id UUID NOT NULL REFERENCES organizations(id),
  source_saved_tender_id UUID NOT NULL REFERENCES saved_tenders(id) ON DELETE CASCADE,
  target_organization_id UUID NOT NULL REFERENCES organizations(id),
  target_saved_tender_id UUID REFERENCES saved_tenders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_saved_tender_id, target_organization_id)
);

-- Steg 1.3: Opprett tender_chat_messages-tabell
CREATE TABLE tender_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_tender_id UUID NOT NULL REFERENCES saved_tenders(id) ON DELETE CASCADE,
  reply_to_id UUID REFERENCES tender_chat_messages(id) ON DELETE SET NULL,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  sender_organization_id UUID NOT NULL REFERENCES organizations(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Steg 1.4: Opprett hjelpefunksjon for domenematching
CREATE OR REPLACE FUNCTION find_organization_by_partner_domain(partner_profile_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_domain TEXT;
  v_org_id UUID;
BEGIN
  SELECT p.partner_domain INTO v_partner_domain
  FROM company_profiles cp
  JOIN partners p ON cp.partner_id = p.id
  WHERE cp.id = partner_profile_id;
  
  IF v_partner_domain IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT id INTO v_org_id
  FROM organizations
  WHERE LOWER(domain) = LOWER(v_partner_domain);
  
  RETURN v_org_id;
END;
$$;

-- Steg 1.5: Enable RLS på nye tabeller
ALTER TABLE shared_tender_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS-policyer for shared_tender_links
CREATE POLICY "Users can view their organization's share links"
ON shared_tender_links FOR SELECT
USING (
  source_organization_id = get_user_organization(auth.uid())
  OR target_organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Editors can create share links from their org"
ON shared_tender_links FOR INSERT
WITH CHECK (
  source_organization_id = get_user_organization(auth.uid())
  AND user_can_edit(auth.uid())
);

CREATE POLICY "Target org editors can update share link status"
ON shared_tender_links FOR UPDATE
USING (
  target_organization_id = get_user_organization(auth.uid())
  AND user_can_edit(auth.uid())
);

CREATE POLICY "Editors can delete their org's share links"
ON shared_tender_links FOR DELETE
USING (
  (source_organization_id = get_user_organization(auth.uid())
   OR target_organization_id = get_user_organization(auth.uid()))
  AND user_can_edit(auth.uid())
);

-- RLS-policyer for tender_chat_messages
CREATE POLICY "Users can view chat messages on accessible tenders"
ON tender_chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM saved_tenders st
    WHERE st.id = tender_chat_messages.saved_tender_id
    AND (
      st.organization_id = get_user_organization(auth.uid())
      OR EXISTS (
        SELECT 1 FROM shared_tender_links stl
        WHERE (stl.source_saved_tender_id = st.id OR stl.target_saved_tender_id = st.id)
        AND stl.status = 'accepted'
        AND (stl.source_organization_id = get_user_organization(auth.uid())
             OR stl.target_organization_id = get_user_organization(auth.uid()))
      )
    )
  )
);

CREATE POLICY "Users can send chat messages on accessible tenders"
ON tender_chat_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND sender_organization_id = get_user_organization(auth.uid())
  AND EXISTS (
    SELECT 1 FROM saved_tenders st
    WHERE st.id = tender_chat_messages.saved_tender_id
    AND (
      st.organization_id = get_user_organization(auth.uid())
      OR EXISTS (
        SELECT 1 FROM shared_tender_links stl
        WHERE (stl.source_saved_tender_id = st.id OR stl.target_saved_tender_id = st.id)
        AND stl.status = 'accepted'
        AND (stl.source_organization_id = get_user_organization(auth.uid())
             OR stl.target_organization_id = get_user_organization(auth.uid()))
      )
    )
  )
);

-- Ny RLS-policy for saved_tenders - se delte anbud
CREATE POLICY "Users can view shared tenders"
ON saved_tenders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM shared_tender_links stl
    WHERE stl.target_saved_tender_id = saved_tenders.id
    AND stl.target_organization_id = get_user_organization(auth.uid())
    AND stl.status = 'accepted'
  )
);

-- Steg 1.6: Aktiver Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE shared_tender_links;
ALTER PUBLICATION supabase_realtime ADD TABLE tender_chat_messages;

-- Opprett indekser for ytelse
CREATE INDEX idx_shared_tender_links_source_org ON shared_tender_links(source_organization_id);
CREATE INDEX idx_shared_tender_links_target_org ON shared_tender_links(target_organization_id);
CREATE INDEX idx_shared_tender_links_status ON shared_tender_links(status);
CREATE INDEX idx_tender_chat_messages_saved_tender ON tender_chat_messages(saved_tender_id);
CREATE INDEX idx_tender_chat_messages_created_at ON tender_chat_messages(created_at);
CREATE INDEX idx_organizations_domain_lower ON organizations(LOWER(domain));