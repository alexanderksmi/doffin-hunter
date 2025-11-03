import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, Eye, FolderOpen } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TenderWorkflowDialog } from "./TenderWorkflowDialog";

type MineLopTender = {
  id: string;
  tender_id: string;
  evaluation_id: string;
  current_stage: string;
  relevance_score: number | null;
  time_criticality: string | null;
  comments: string | null;
  stage_notes: any;
  created_at: string;
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

  const isAdmin = userRole === "admin";

  useEffect(() => {
    if (organizationId) {
      loadMineLopTenders();
    }
  }, [organizationId]);

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
      setMineLopTenders(data as any || []);
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Ingen frist";
    const date = new Date(dateString);
    return date.toLocaleDateString("no-NO", { day: "numeric", month: "short", year: "numeric" });
  };

  if (!isAdmin) {
    return (
      <Alert>
        <AlertDescription>
          Du må være administrator for å se Mine Løp.
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
          <h2 className="text-2xl font-bold">Mine Løp</h2>
          <p className="text-muted-foreground">
            Anbudsprosesser du er en del av
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {mineLopTenders.length} aktive løp
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Link</TableHead>
              <TableHead className="w-[30%]">Tittel</TableHead>
              <TableHead>Oppdragsgiver</TableHead>
              <TableHead>Fase</TableHead>
              <TableHead>Relevans</TableHead>
              <TableHead>Frist</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mineLopTenders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewTender(tender)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
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
        />
      )}
    </div>
  );
};
