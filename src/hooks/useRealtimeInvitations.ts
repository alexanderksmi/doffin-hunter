import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type UseRealtimeInvitationsProps = {
  onUpdate: () => void;
};

export const useRealtimeInvitations = ({ onUpdate }: UseRealtimeInvitationsProps) => {
  const { organizationId } = useAuth();

  useEffect(() => {
    if (!organizationId) return;

    // Subscribe to shared_tender_links for this organization
    const channel = supabase
      .channel(`invitations:${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shared_tender_links",
          filter: `target_organization_id=eq.${organizationId}`,
        },
        (payload) => {
          console.log("Invitation changed:", payload);
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, onUpdate]);
};
