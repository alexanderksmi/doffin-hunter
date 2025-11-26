import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeInvitations } from "@/hooks/useRealtimeInvitations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, ExternalLink, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Invitation = {
  id: string;
  source_organization_id: string;
  source_saved_tender_id: string;
  invited_at: string;
  cached_tender_title: string | null;
  cached_tender_client: string | null;
  cached_tender_deadline: string | null;
  cached_tender_doffin_url: string | null;
  cached_tender_id: string | null;
  cached_evaluation_id: string | null;
  cached_current_stage: string | null;
  cached_combination_type: string | null;
  cached_lead_profile_id: string | null;
  cached_partner_profile_id: string | null;
  cached_stage_notes: any;
  sourceOrg: {
    name: string;
  } | null;
};

type TenderInvitationsProps = {
  onUpdate: () => void;
};

export const TenderInvitations = ({ onUpdate }: TenderInvitationsProps) => {
  const { organizationId } = useAuth();
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [invitationToReject, setInvitationToReject] = useState<Invitation | null>(null);

  const loadInvitations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("shared_tender_links")
        .select(`
          id,
          source_organization_id,
          source_saved_tender_id,
          invited_at,
          cached_tender_title,
          cached_tender_client,
          cached_tender_deadline,
          cached_tender_doffin_url,
          cached_tender_id,
          cached_evaluation_id,
          cached_current_stage,
          cached_combination_type,
          cached_lead_profile_id,
          cached_partner_profile_id,
          cached_stage_notes,
          sourceOrg:organizations!shared_tender_links_source_organization_id_fkey (
            name
          )
        `)
        .eq("target_organization_id", organizationId)
        .eq("status", "pending")
        .order("invited_at", { ascending: false });

      if (error) throw error;

      setInvitations(data || []);
    } catch (error) {
      console.error("Error loading invitations:", error);
    } finally {
      setLoading(false);
    }
  };

  // Realtime subscription for invitations
  useRealtimeInvitations({ onUpdate: loadInvitations });

  useEffect(() => {
    if (organizationId) {
      loadInvitations();
    }
  }, [organizationId]);

  const handleAccept = async (invitation: Invitation) => {
    setProcessingId(invitation.id);
    try {
      // Validate that we have all required cached data
      if (!invitation.cached_tender_id || !invitation.cached_evaluation_id) {
        throw new Error("Mangler nødvendig data fra invitasjonen");
      }

      // Use cached data from invitation instead of reading source_saved_tender
      // Invert combination_type: lead_partner -> partner_led
      const invertedCombinationType = 
        invitation.cached_combination_type === 'lead_partner' ? 'partner_led' : 
        invitation.cached_combination_type === 'partner_led' ? 'lead_partner' : 
        invitation.cached_combination_type || 'solo';

      // Find the correct evaluation_id for the inverted perspective
      // The partner becomes lead and lead becomes partner, so look for evaluation with swapped profiles
      const { data: evaluation, error: evalError } = await supabase
        .from("tender_evaluations")
        .select("id")
        .eq("tender_id", invitation.cached_tender_id)
        .eq("organization_id", organizationId)
        .eq("lead_profile_id", invitation.cached_partner_profile_id) // Swapped
        .maybeSingle();

      if (evalError) throw evalError;

      // Use found evaluation or fall back to cached evaluation
      const evaluationId = evaluation?.id || invitation.cached_evaluation_id;

      const { data: newTender, error: insertError} = await supabase
        .from("saved_tenders")
        .insert([{
          tender_id: invitation.cached_tender_id,
          evaluation_id: evaluationId,
          organization_id: organizationId,
          saved_by: (await supabase.auth.getUser()).data.user?.id,
          status: "pagar",
          current_stage: (invitation.cached_current_stage as any) || "kvalifisering",
          combination_type: invertedCombinationType,
          lead_profile_id: invitation.cached_partner_profile_id, // Swap
          partner_profile_id: invitation.cached_lead_profile_id, // Swap
          cached_title: invitation.cached_tender_title,
          cached_client: invitation.cached_tender_client,
          cached_deadline: invitation.cached_tender_deadline,
          cached_doffin_url: invitation.cached_tender_doffin_url,
          is_shared: true,
          stage_notes: invitation.cached_stage_notes || {},
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Update share link with accepted status
      const { error: updateError } = await supabase
        .from("shared_tender_links")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          target_saved_tender_id: newTender.id,
        })
        .eq("id", invitation.id);

      if (updateError) throw updateError;

      // Mark source tender as shared
      await supabase
        .from("saved_tenders")
        .update({ is_shared: true })
        .eq("id", invitation.source_saved_tender_id);

      toast({
        title: "Invitasjon akseptert",
        description: "Anbudet er nå synlig i Mine Løp",
      });

      loadInvitations();
      onUpdate();
    } catch (error) {
      console.error("Error accepting invitation:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke akseptere invitasjonen",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectClick = (invitation: Invitation) => {
    setInvitationToReject(invitation);
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!invitationToReject) return;

    setProcessingId(invitationToReject.id);
    try {
      const { error } = await supabase
        .from("shared_tender_links")
        .update({
          status: "rejected",
          rejected_at: new Date().toISOString(),
        })
        .eq("id", invitationToReject.id);

      if (error) throw error;

      toast({
        title: "Invitasjon avvist",
        description: "Invitasjonen er avvist",
      });

      loadInvitations();
    } catch (error) {
      console.error("Error rejecting invitation:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke avvise invitasjonen",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
      setRejectDialogOpen(false);
      setInvitationToReject(null);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Ingen frist";
    const date = new Date(dateString);
    return date.toLocaleDateString("no-NO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Invitasjoner</CardTitle>
          <CardDescription>
            Du har {invitations.length} ventende invitasjon{invitations.length !== 1 ? "er" : ""} til samarbeid
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between border rounded-lg p-4"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{invitation.cached_tender_title || "Anbud"}</h4>
                    {invitation.cached_tender_doffin_url && (
                      <a
                        href={invitation.cached_tender_doffin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">
                      {invitation.sourceOrg?.name || invitation.cached_tender_client || "Partner"}
                    </span>{" "}
                    inviterer deg til samarbeid
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Oppdragsgiver: {invitation.cached_tender_client || "N/A"}</span>
                    <span>•</span>
                    <span>Frist: {formatDate(invitation.cached_tender_deadline)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleAccept(invitation)}
                    disabled={processingId === invitation.id}
                  >
                    {processingId === invitation.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Aksepter
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRejectClick(invitation)}
                    disabled={processingId === invitation.id}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Avvis
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Avvis invitasjon?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil avvise denne invitasjonen til samarbeid?
              Du kan ikke angre denne handlingen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReject}>
              Avvis
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
