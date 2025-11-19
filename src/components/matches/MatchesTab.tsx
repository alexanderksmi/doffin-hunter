import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, Edit, Bookmark, Trash2 } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SavedTenderDialog } from "./SavedTenderDialog";
import { getPartnerColor } from "@/lib/partnerColors";

type SavedTender = {
  id: string;
  tender_id: string;
  evaluation_id: string;
  combination_type: string;
  lead_profile_id: string | null;
  partner_profile_id: string | null;
  relevance_score: number | null;
  time_criticality: string | null;
  comments: string | null;
  status: string;
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

export const MatchesTab = () => {
  const { userRole, organizationId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savedTenders, setSavedTenders] = useState<SavedTender[]>([]);
  const [selectedTender, setSelectedTender] = useState<SavedTender | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tenderToDelete, setTenderToDelete] = useState<SavedTender | null>(null);
  const [partnerIndexMap, setPartnerIndexMap] = useState<Map<string, number>>(new Map());
  const [filterType, setFilterType] = useState<"all" | "partner">("all");

  const isAdmin = userRole === "admin";
  const isEditor = userRole === "editor";
  const canEdit = isAdmin || isEditor;
  const canView = isAdmin || isEditor || userRole === "viewer";

  const filteredTenders = filterType === "partner" 
    ? savedTenders.filter(tender => tender.combination_type !== 'solo')
    : savedTenders;

  useEffect(() => {
    if (organizationId) {
      loadPartnerIndexes();
      loadSavedTenders();
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

  const loadSavedTenders = async () => {
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
            doffin_url
          ),
          evaluation:evaluation_id (
            total_score,
            met_minimum_requirements
          )
        `)
        .eq("organization_id", organizationId)
        .eq("status", "vurdering")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Enrich with partner profile names using saved_tenders' own combination data
      const enrichedData = await Promise.all((data || []).map(async (tender: any) => {
        let partnerName = null;
        // Use combination_type and partner_profile_id from saved_tenders directly
        if (tender.combination_type === 'combination' && tender.partner_profile_id) {
          const { data: partnerProfile } = await supabase
            .from("company_profiles")
            .select("profile_name")
            .eq("id", tender.partner_profile_id)
            .single();
          partnerName = partnerProfile?.profile_name;
        }
        return { ...tender, partnerName };
      }));

      setSavedTenders(enrichedData);
    } catch (error) {
      console.error("Error loading saved tenders:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke laste lagrede anbud",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditTender = (tender: SavedTender) => {
    setSelectedTender(tender);
    setDialogOpen(true);
  };

  const handleDeleteClick = (tender: SavedTender) => {
    setTenderToDelete(tender);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!tenderToDelete) return;
    
    try {
      const { error } = await supabase
        .from("saved_tenders")
        .delete()
        .eq("id", tenderToDelete.id);

      if (error) throw error;

      toast({
        title: "Slettet",
        description: "Anbudet er slettet",
      });
      
      loadSavedTenders();
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
          Du har ikke tilgang til Matches-fanen.
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Lagrede anbud</h2>
          <p className="text-muted-foreground">
            Anbud du har lagret for videre vurdering
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="filter-type">Filtrer:</Label>
            <select
              id="filter-type"
              className="border rounded-md px-3 py-1.5 text-sm"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as "all" | "partner")}
            >
              <option value="all">Alle</option>
              <option value="partner">Partnermatches</option>
            </select>
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredTenders.length} lagrede anbud
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
              <TableHead>Relevans</TableHead>
              <TableHead>Tidskritisk</TableHead>
              <TableHead>Frist</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTenders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Bookmark className="h-8 w-8 text-muted-foreground/50" />
                    <p className="font-medium">
                      {filterType === "partner" ? "Ingen partnermatches" : "Ingen lagrede anbud"}
                    </p>
                    <p className="text-sm">
                      {filterType === "partner" 
                        ? "Ingen anbud med partnere funnet" 
                        : "Gå til Radar-fanen for å lagre anbud"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredTenders.map((saved) => (
                <TableRow key={saved.id}>
                  <TableCell>
                    <a
                      href={saved.tender.doffin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center text-primary hover:text-primary/80"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </TableCell>
                  <TableCell className="font-medium">
                    {saved.tender.title}
                  </TableCell>
                  <TableCell className="text-sm">
                    {saved.tender.client || "N/A"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {saved.combination_type === 'combination' ? (
                      (() => {
                        const partnerIndex = saved.partner_profile_id ? partnerIndexMap.get(saved.partner_profile_id) ?? 0 : 0;
                        const colors = getPartnerColor(partnerIndex);
                        return (
                          <Badge variant="secondary" className={`${colors.bg} ${colors.text}`}>
                            {saved.partnerName || "Partner"}
                          </Badge>
                        );
                      })()
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {saved.relevance_score ? (
                      <Badge variant="outline">{saved.relevance_score}/100</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {saved.time_criticality ? (
                      <Badge
                        variant={
                          saved.time_criticality === "høy"
                            ? "destructive"
                            : saved.time_criticality === "middels"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {saved.time_criticality}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(saved.tender.deadline)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTender(saved)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(saved)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
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
        <SavedTenderDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          savedTender={selectedTender}
          onUpdate={loadSavedTenders}
          readOnly={!canEdit}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett lagret anbud</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette dette anbudet? Dette kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
