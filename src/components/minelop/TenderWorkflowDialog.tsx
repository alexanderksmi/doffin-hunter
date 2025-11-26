import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeSharedTender } from "@/hooks/useRealtimeSharedTender";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Check, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeDomain } from "@/lib/utils";
import { StageNotes } from "./StageNotes";
import { TenderContacts } from "./TenderContacts";
import { TenderOwners } from "./TenderOwners";
import { Separator } from "@/components/ui/separator";

type TenderWorkflowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tender: any;
  onUpdate: () => void;
  readOnly?: boolean;
};

const stages = [
  { key: "kvalifisering", label: "Kvalifisering" },
  { key: "analyse_planlegging", label: "Analyse / Planlegging" },
  { key: "svarer_anbud", label: "Svarer anbud" },
  { key: "kvalitetssikring", label: "Kvalitetssikring" },
  { key: "godkjenning", label: "Godkjenning" },
  { key: "laring", label: "Læring" },
];

export const TenderWorkflowDialog = ({
  open,
  onOpenChange,
  tender,
  onUpdate,
  readOnly = false,
}: TenderWorkflowDialogProps) => {
  const { toast } = useToast();
  const { organizationId } = useAuth();
  const [currentStage, setCurrentStage] = useState(tender.current_stage);
  const [stageNotes, setStageNotes] = useState<Record<string, string>>(
    tender.stage_notes || {}
  );
  const [saving, setSaving] = useState(false);
  const [invitationStatus, setInvitationStatus] = useState<string | null>(null);
  const [sendingInvitation, setSendingInvitation] = useState(false);

  // Enable realtime sync for shared tenders
  useRealtimeSharedTender({
    savedTenderId: tender.id,
    onUpdate: onUpdate,
  });

  useEffect(() => {
    setCurrentStage(tender.current_stage);
    setStageNotes(tender.stage_notes || {});
  }, [tender]);

  // Check invitation status when dialog opens
  useEffect(() => {
    const checkInvitationStatus = async () => {
      if (!tender.partner_profile_id || !organizationId) return;

      const { data, error } = await supabase
        .from("shared_tender_links")
        .select("status")
        .eq("source_saved_tender_id", tender.id)
        .maybeSingle();

      if (!error && data) {
        setInvitationStatus(data.status);
      } else {
        setInvitationStatus(null);
      }
    };

    if (open) {
      checkInvitationStatus();
    }
  }, [open, tender.id, tender.partner_profile_id, organizationId]);

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("saved_tenders")
        .update({
          current_stage: currentStage,
          stage_notes: stageNotes,
        })
        .eq("id", tender.id);

      if (error) throw error;

      toast({
        title: "Lagret",
        description: "Endringene er lagret",
      });
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke lagre endringer",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStageChange = (stageKey: string) => {
    if (!readOnly) {
      setCurrentStage(stageKey);
    }
  };

  const handleNoteChange = (stageKey: string, value: string) => {
    if (!readOnly) {
      setStageNotes((prev) => ({
        ...prev,
        [stageKey]: value,
      }));
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Ingen frist";
    const date = new Date(dateString);
    return date.toLocaleDateString("no-NO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getCurrentStageIndex = () => {
    return stages.findIndex((s) => s.key === currentStage);
  };

  const handleSendInvitation = async () => {
    if (!tender.partner_profile_id || !organizationId) return;

    setSendingInvitation(true);
    try {
      // Get partner domain via company_profiles -> partners
      const { data: partnerProfile } = await supabase
        .from("company_profiles")
        .select("partner_id, partners(partner_domain)")
        .eq("id", tender.partner_profile_id)
        .single();

      if (partnerProfile?.partners?.partner_domain) {
        const rawDomain = partnerProfile.partners.partner_domain;
        const partnerDomain = normalizeDomain(rawDomain);

        // Find partner organization by domain
        const { data: allOrgs } = await supabase
          .from("organizations")
          .select("id, domain");
        
        const partnerOrg = allOrgs?.find(org => 
          normalizeDomain(org.domain) === partnerDomain
        );

        if (partnerOrg) {
          // Create shared tender link
          const { error: linkError } = await supabase
            .from("shared_tender_links")
            .insert({
              source_organization_id: organizationId,
              source_saved_tender_id: tender.id,
              target_organization_id: partnerOrg.id,
              status: "pending",
              invited_at: new Date().toISOString(),
            });

          if (linkError) throw linkError;

          // Mark source tender as shared
          await supabase
            .from("saved_tenders")
            .update({ is_shared: true })
            .eq("id", tender.id);

          setInvitationStatus("pending");

          toast({
            title: "Invitasjon sendt",
            description: "Partnerorganisasjonen har mottatt en invitasjon til å samarbeide",
          });

          onUpdate();
        } else {
          throw new Error("Partnerorganisasjon ikke funnet");
        }
      } else {
        throw new Error("Partnerdomene ikke funnet");
      }
    } catch (error) {
      console.error("Error sending invitation:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke sende invitasjon",
        variant: "destructive",
      });
    } finally {
      setSendingInvitation(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tender.tender.title}
            <a
              href={tender.tender.doffin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </DialogTitle>
          <DialogDescription>
            <div className="space-y-2 mt-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Oppdragsgiver:</span>
                <span className="text-sm">{tender.tender.client || "N/A"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Frist:</span>
                <span className="text-sm">{formatDate(tender.tender.deadline)}</span>
              </div>
              {tender.comments && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <span className="text-sm font-medium">Kommentarer:</span>
                  <p className="text-sm mt-1">{tender.comments}</p>
                </div>
              )}
              {tender.partner_profile_id && !readOnly && (
                <div className="mt-4">
                  {invitationStatus === null ? (
                    <Button
                      onClick={handleSendInvitation}
                      disabled={sendingInvitation}
                      className="w-full"
                    >
                      {sendingInvitation ? (
                        <>Sender invitasjon...</>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send invitasjon til samarbeid
                        </>
                      )}
                    </Button>
                  ) : invitationStatus === "pending" ? (
                    <Badge variant="outline" className="w-full justify-center py-2">
                      Invitasjon sendt - Venter på svar
                    </Badge>
                  ) : invitationStatus === "accepted" ? (
                    <Badge variant="default" className="w-full justify-center py-2">
                      Invitasjon akseptert
                    </Badge>
                  ) : invitationStatus === "rejected" ? (
                    <Badge variant="destructive" className="w-full justify-center py-2">
                      Invitasjon avvist
                    </Badge>
                  ) : null}
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Visual Timeline */}
        <div className="py-6">
          <div className="flex items-center justify-between">
            {stages.map((stage, index) => {
              const isActive = stage.key === currentStage;
              const isPast = index < getCurrentStageIndex();
              const isFuture = index > getCurrentStageIndex();

              return (
                <div key={stage.key} className="flex items-center flex-1">
                  <button
                    onClick={() => handleStageChange(stage.key)}
                    className={cn(
                      "flex flex-col items-center gap-2 transition-all",
                      "hover:opacity-80"
                    )}
                  >
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all",
                        isActive &&
                          "border-primary bg-primary text-primary-foreground scale-110",
                        isPast &&
                          "border-green-600 bg-green-600 text-white",
                        isFuture && "border-muted bg-muted text-muted-foreground"
                      )}
                    >
                      {isPast ? (
                        <Check className="h-6 w-6" />
                      ) : (
                        <span className="text-sm font-bold">{index + 1}</span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-xs text-center max-w-[80px]",
                        isActive && "font-bold text-primary",
                        isPast && "text-green-600",
                        isFuture && "text-muted-foreground"
                      )}
                    >
                      {stage.label}
                    </span>
                  </button>
                  {index < stages.length - 1 && (
                    <div className="flex-1 h-0.5 mx-2 bg-border" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Separator className="my-6" />

        {/* Current Stage Content */}
        <div className="space-y-6 py-4">
          <div className="space-y-6">
            <StageNotes
              stageKey={currentStage}
              stageLabel={stages.find((s) => s.key === currentStage)?.label || ""}
              notes={stageNotes[currentStage] || ""}
              onChange={(value) => handleNoteChange(currentStage, value)}
              readOnly={readOnly}
            />

            <Separator />

            <TenderOwners savedTenderId={tender.id} readOnly={readOnly} />

            <Separator />

            <TenderContacts savedTenderId={tender.id} readOnly={readOnly} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Lukk
          </Button>
          {!readOnly && (
            <Button onClick={handleSaveNotes} disabled={saving}>
              Lagre endringer
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
