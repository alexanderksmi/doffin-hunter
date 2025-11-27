import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, Eye, FolderOpen, Trash2, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TenderWorkflowDialog } from "./TenderWorkflowDialog";
import { getPartnerColor } from "@/lib/partnerColors";
import { CreateTenderDialog } from "./CreateTenderDialog";
import { TenderInvitations } from "./TenderInvitations";
import { useRealtimeInvitations } from "@/hooks/useRealtimeInvitations";
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

type MineLopTender = {
  id: string;
  tender_id: string;
  evaluation_id: string;
  combination_type: string;
  partner_profile_id: string | null;
  current_stage: string;
  relevance_score: number | null;
  time_criticality: string | null;
  comments: string | null;
  stage_notes: any;
  created_at: string;
  partnerName?: string;
  tender: {
    id: string;
    title: string;
    client: string;
    deadline: string;
    published_date: string;
    doffin_url: string;
  };
  evaluation: {
    total_score: number;
    met_minimum_requirements: any[];
  };
};

const stageLabels: Record<string, string> = {
  kvalifisering: "Kvalifisering",
  analyse_planlegging: "Analyse / Planlegging",
  svarer_anbud: "Svarer anbud",
  kvalitetssikring: "Kvalitetssikring",
  godkjenning: "Godkjenning",
  laring: "Læring",
};

export const MineLopTab = () => {
  const { userRole, organizationId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [mineLopTenders, setMineLopTenders] = useState<MineLopTender[]>([]);
  const [selectedTender, setSelectedTender] = useState<MineLopTender | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tenderToDelete, setTenderToDelete] = useState<MineLopTender | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [partnerIndexMap, setPartnerIndexMap] = useState<Map<string, number>>(new Map());

  const isAdmin = userRole === "admin";
  const isEditor = userRole === "editor";
  const canEdit = isAdmin || isEditor;
  const canView = isAdmin || isEditor || userRole === "viewer";

  // Realtime subscriptions for shared tenders updates
  const handleRealtimeUpdate = useCallback(() => {
    loadMineLopTenders();
  }, []);

  useRealtimeInvitations({ onUpdate: handleRealtimeUpdate });

  // Subscribe to saved_tenders changes in Mine Løp
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel(`minelop:${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "saved_tenders",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          console.log("Mine Løp tender changed:", payload);
          if (payload.new && (payload.new as any).status === "pagar") {
            handleRealtimeUpdate();
          } else if (payload.eventType === "DELETE") {
            handleRealtimeUpdate();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, handleRealtimeUpdate]);

  useEffect(() => {
    if (organizationId) {
      loadPartnerIndexes();
      loadMineLopTenders();
    }
  }, [organizationId]);

  const loadPartnerIndexes = async () => {
    const { data: profiles } = await supabase
      .from('company_profiles')
      .select('id, is_own_profile, created_at')
      .eq('organization_id', organizationId)
      .eq('is_own_profile', false)
      .order('created_at', { ascending: true });

    if (profiles) {
      const indexMap = new Map<string, number>();
      profiles.forEach((partner, index) => {
        indexMap.set(partner.id, index);
      });
      setPartnerIndexMap(indexMap);
    }
  };

  const loadMineLopTenders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("saved_tenders")
        .select(`
          *,
          tender:tender_id (
            id,
            title,
            client,
            deadline,
            published_date,
            doffin_url
          ),
          evaluation:evaluation_id (
            total_score,
            met_minimum_requirements
          )
        `)
        .eq("organization_id", organizationId)
        .eq("status", "pagar")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Enrich with partner names and fallback to cached data
      const enrichedData = await Promise.all((data || []).map(async (tender: any) => {
        let partnerName = null;
        
        // For shared tenders, get partner name from shared_tender_links
        if (tender.is_shared) {
          const { data: linkData } = await supabase
            .from('shared_tender_links')
            .select('source_saved_tender_id, target_saved_tender_id, cached_source_org_name, cached_target_org_name')
            .or(`source_saved_tender_id.eq.${tender.id},target_saved_tender_id.eq.${tender.id}`)
            .eq('status', 'accepted')
            .single();
          
          if (linkData) {
            // If we are the target, show source org name as partner
            // If we are the source, show target org name as partner
            partnerName = linkData.target_saved_tender_id === tender.id 
              ? linkData.cached_source_org_name 
              : linkData.cached_target_org_name;
          }
        } else if ((tender.combination_type === 'lead_partner' || tender.combination_type === 'partner_led') && tender.partner_profile_id) {
          const { data: partnerProfile } = await supabase
            .from("company_profiles")
            .select("profile_name")
            .eq("id", tender.partner_profile_id)
            .single();
          partnerName = partnerProfile?.profile_name;
        }

        // Use cached data as fallback if tender relation is null (for shared tenders)
        const tenderData = tender.tender || {
          id: tender.tender_id,
          title: tender.cached_title,
          client: tender.cached_client,
          deadline: tender.cached_deadline,
          doffin_url: tender.cached_doffin_url,
          published_date: null,
        };

        return { ...tender, tender: tenderData, partnerName };
      }));

      setMineLopTenders(enrichedData);
    } catch (error) {
      console.error("Error loading Mine Løp tenders:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke laste Mine Løp",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewTender = (tender: MineLopTender) => {
    setSelectedTender(tender);
    setDialogOpen(true);
  };

  const handleDeleteClick = (tender: MineLopTender) => {
    setTenderToDelete(tender);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!tenderToDelete) return;

    try {
      // First check if this is a manually created tender
      const { data: tenderData } = await supabase
        .from("tenders")
        .select("doffin_id")
        .eq("id", tenderToDelete.tender_id)
        .single();

      // Delete the saved_tender first
      const { error: savedError } = await supabase
        .from("saved_tenders")
        .delete()
        .eq("id", tenderToDelete.id);

      if (savedError) throw savedError;

      // If it's a manual tender (doffin_id starts with "manual-"), delete the tender itself
      if (tenderData?.doffin_id?.startsWith("manual-")) {
        const { error: tenderError } = await supabase
          .from("tenders")
          .delete()
          .eq("id", tenderToDelete.tender_id);

        if (tenderError) throw tenderError;
      }

      toast({
        title: "Slettet",
        description: "Anbudet er fjernet fra Mine Løp",
      });
      loadMineLopTenders();
    } catch (error) {
      console.error("Error deleting tender:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke slette anbudet",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setTenderToDelete(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Ingen frist";
    const date = new Date(dateString);
    return date.toLocaleDateString("no-NO", { day: "numeric", month: "short", year: "numeric" });
  };

  if (!canView) {
    return (
      <Alert>
        <AlertDescription>
          Du har ikke tilgang til Mine Løp-fanen.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TenderInvitations onUpdate={loadMineLopTenders} />
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Mine Løp</h2>
          <p className="text-muted-foreground">
            Anbudsprosesser du er en del av
          </p>
        </div>
        <div className="flex items-center gap-4">
          {canEdit && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Opprett manuelt
            </Button>
          )}
          <div className="text-sm text-muted-foreground">
            {mineLopTenders.length} aktive løp
          </div>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Link</TableHead>
              <TableHead className="w-[25%]">Tittel</TableHead>
              <TableHead>Oppdragsgiver</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Fase</TableHead>
              <TableHead>Relevans</TableHead>
              <TableHead>Frist</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mineLopTenders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
                    <p className="font-medium">Ingen aktive løp</p>
                    <p className="text-sm">Overfør anbud fra Matches for å starte et løp</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              mineLopTenders.map((tender) => (
                <TableRow key={tender.id}>
                  <TableCell>
                    <a
                      href={tender.tender.doffin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center text-primary hover:text-primary/80"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </TableCell>
                  <TableCell className="font-medium">
                    {tender.tender.title}
                  </TableCell>
                  <TableCell className="text-sm">
                    {tender.tender.client || "N/A"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {(tender.combination_type === 'lead_partner' || tender.combination_type === 'partner_led') ? (
                      (() => {
                        const partnerIndex = tender.partner_profile_id ? partnerIndexMap.get(tender.partner_profile_id) ?? 0 : 0;
                        const colors = getPartnerColor(partnerIndex);
                        return (
                          <Badge variant="secondary" className={`${colors.bg} ${colors.text}`}>
                            {tender.partnerName || "Partner"}
                          </Badge>
                        );
                      })()
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {stageLabels[tender.current_stage] || tender.current_stage}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {tender.relevance_score ? (
                      <Badge variant="outline">{tender.relevance_score}/100</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(tender.tender.deadline)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewTender(tender)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(tender)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selectedTender && (
      <TenderWorkflowDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tender={selectedTender}
        onUpdate={loadMineLopTenders}
        readOnly={!canEdit}
      />
      )}

      <CreateTenderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={loadMineLopTenders}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett anbud fra Mine Løp?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil fjerne dette anbudet fra Mine Løp? Dette vil
              slette alle tilknyttede notater, kontaktpersoner, anbudseiere og oppgaver.
              Denne handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
