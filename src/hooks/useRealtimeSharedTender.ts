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

    // Find and subscribe to linked tender if this is a shared tender
    const setupRealtimeSync = async () => {
      // Subscribe to this tender's changes
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

      // Find the linked tender ID if this is a shared tender
      const { data: sharedLink } = await supabase
        .from("shared_tender_links")
        .select("source_saved_tender_id, target_saved_tender_id")
        .or(`source_saved_tender_id.eq.${savedTenderId},target_saved_tender_id.eq.${savedTenderId}`)
        .eq("status", "accepted")
        .maybeSingle();

      if (sharedLink) {
        const linkedTenderId = 
          sharedLink.source_saved_tender_id === savedTenderId
            ? sharedLink.target_saved_tender_id
            : sharedLink.source_saved_tender_id;
        
        // Subscribe to changes on the linked tender too
        if (linkedTenderId) {
          const linkedTenderChannel = supabase
            .channel(`saved_tender_linked:${linkedTenderId}`)
            .on(
              "postgres_changes",
              {
                event: "UPDATE",
                schema: "public",
                table: "saved_tenders",
                filter: `id=eq.${linkedTenderId}`,
              },
              (payload) => {
                console.log("Linked saved tender updated:", payload);
                onUpdate();
              }
            )
            .subscribe();

          channels.push(linkedTenderChannel);

          // Subscribe to owners on linked tender
          const linkedOwnersChannel = supabase
            .channel(`tender_owners_linked:${linkedTenderId}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "tender_owners",
                filter: `saved_tender_id=eq.${linkedTenderId}`,
              },
              (payload) => {
                console.log("Linked tender owners changed:", payload);
                onUpdate();
              }
            )
            .subscribe();

          channels.push(linkedOwnersChannel);

          // Subscribe to contacts on linked tender
          const linkedContactsChannel = supabase
            .channel(`tender_contacts_linked:${linkedTenderId}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "tender_contacts",
                filter: `saved_tender_id=eq.${linkedTenderId}`,
              },
              (payload) => {
                console.log("Linked tender contacts changed:", payload);
                onUpdate();
              }
            )
            .subscribe();

          channels.push(linkedContactsChannel);

          // Subscribe to chat messages on linked tender
          const linkedChatChannel = supabase
            .channel(`tender_chat_linked:${linkedTenderId}`)
            .on(
              "postgres_changes",
              {
                event: "INSERT",
                schema: "public",
                table: "tender_chat_messages",
                filter: `saved_tender_id=eq.${linkedTenderId}`,
              },
              (payload) => {
                console.log("Linked tender chat message:", payload);
                onUpdate();
              }
            )
            .subscribe();

          channels.push(linkedChatChannel);
        }
      }
    };

    setupRealtimeSync();

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [savedTenderId, onUpdate]);
};
