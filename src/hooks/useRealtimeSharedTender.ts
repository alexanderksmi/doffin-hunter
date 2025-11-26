import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

type UseRealtimeSharedTenderProps = {
  savedTenderId: string | null;
  onUpdate: () => void;
};

export const useRealtimeSharedTender = ({
  savedTenderId,
  onUpdate,
}: UseRealtimeSharedTenderProps) => {
  useEffect(() => {
    if (!savedTenderId) return;

    const channels: RealtimeChannel[] = [];

    // Subscribe to saved_tenders changes
    const savedTenderChannel = supabase
      .channel(`saved_tender:${savedTenderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "saved_tenders",
          filter: `id=eq.${savedTenderId}`,
        },
        (payload) => {
          console.log("Saved tender updated:", payload);
          onUpdate();
        }
      )
      .subscribe();

    channels.push(savedTenderChannel);

    // Subscribe to tender_owners changes
    const ownersChannel = supabase
      .channel(`tender_owners:${savedTenderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tender_owners",
          filter: `saved_tender_id=eq.${savedTenderId}`,
        },
        (payload) => {
          console.log("Tender owners changed:", payload);
          onUpdate();
        }
      )
      .subscribe();

    channels.push(ownersChannel);

    // Subscribe to tender_contacts changes
    const contactsChannel = supabase
      .channel(`tender_contacts:${savedTenderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tender_contacts",
          filter: `saved_tender_id=eq.${savedTenderId}`,
        },
        (payload) => {
          console.log("Tender contacts changed:", payload);
          onUpdate();
        }
      )
      .subscribe();

    channels.push(contactsChannel);

    // Subscribe to chat messages
    const chatChannel = supabase
      .channel(`tender_chat:${savedTenderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tender_chat_messages",
          filter: `saved_tender_id=eq.${savedTenderId}`,
        },
        (payload) => {
          console.log("New chat message:", payload);
          onUpdate();
        }
      )
      .subscribe();

    channels.push(chatChannel);

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [savedTenderId, onUpdate]);
};
