import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, ExternalLink } from "lucide-react";
import { getPartnerColor } from "@/lib/partnerColors";

type SavedTenderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedTender: any;
  onUpdate: () => void;
};

export const SavedTenderDialog = ({
  open,
  onOpenChange,
  savedTender,
  onUpdate,
}: SavedTenderDialogProps) => {
  const { toast } = useToast();
  const { organizationId } = useAuth();
  const [comments, setComments] = useState(savedTender.comments || "");
  const [relevanceScore, setRelevanceScore] = useState(
    savedTender.relevance_score || 50
  );
  const [timeCriticality, setTimeCriticality] = useState(
    savedTender.time_criticality || "middels"
  );
  const [saving, setSaving] = useState(false);
  const [leadProfileKeywords, setLeadProfileKeywords] = useState<any[]>([]);
  const [partnerProfileKeywords, setPartnerProfileKeywords] = useState<any[]>([]);
  const [partnerIndex, setPartnerIndex] = useState<number>(0);
  const [combinedScore, setCombinedScore] = useState(0);

  useEffect(() => {
    setComments(savedTender.comments || "");
    setRelevanceScore(savedTender.relevance_score || 50);
    setTimeCriticality(savedTender.time_criticality || "middels");
    
    // Load profile keywords using saved_tender's own combination data
    const loadProfileKeywords = async () => {
      let leadMatched: any[] = [];
      let partnerMatched: any[] = [];

      if (savedTender.combination_type === 'combination') {
        // For combinations, fetch both evaluations to get all met requirements
        if (savedTender.lead_profile_id) {
          const { data: leadEval } = await supabase
            .from("tender_evaluations")
            .select("met_minimum_requirements")
            .eq("tender_id", savedTender.tender_id)
            .eq("lead_profile_id", savedTender.lead_profile_id)
            .maybeSingle();
          
          if (leadEval?.met_minimum_requirements) {
            leadMatched = (leadEval.met_minimum_requirements as any[]).map((req: any) => ({ 
              ...req, 
              source: 'lead' 
            }));
            setLeadProfileKeywords(leadMatched);
          }
        }

        if (savedTender.partner_profile_id) {
          const { data: partnerEval } = await supabase
            .from("tender_evaluations")
            .select("met_minimum_requirements")
            .eq("tender_id", savedTender.tender_id)
            .eq("lead_profile_id", savedTender.partner_profile_id)
            .maybeSingle();
          
          if (partnerEval?.met_minimum_requirements) {
            partnerMatched = (partnerEval.met_minimum_requirements as any[]).map((req: any) => ({ 
              ...req, 
              source: 'partner' 
            }));
            setPartnerProfileKeywords(partnerMatched);
          }

          // Get partner index
          const { data: profiles } = await supabase
            .from('company_profiles')
            .select('id, created_at')
            .eq('organization_id', organizationId!)
            .eq('is_own_profile', false)
            .order('created_at', { ascending: true });

          if (profiles) {
            const index = profiles.findIndex(p => p.id === savedTender.partner_profile_id);
            setPartnerIndex(index >= 0 ? index : 0);
          }
        }

        // Calculate combined score
        const allKeywords = [...leadMatched, ...partnerMatched];
        const uniqueKeywords = Array.from(
          new Map(allKeywords.map(req => [req.keyword.toLowerCase(), req])).values()
        );
        setCombinedScore(uniqueKeywords.length);
      } else {
        // For solo, just use the evaluation data
        if (savedTender.lead_profile_id) {
          const { data: leadKeywords } = await supabase
            .from("minimum_requirements")
            .select("keyword")
            .eq("profile_id", savedTender.lead_profile_id);
          
          leadMatched = (savedTender.evaluation.met_minimum_requirements || [])
            .filter((req: any) => 
              leadKeywords?.some(k => k.keyword.toLowerCase() === req.keyword.toLowerCase())
            )
            .map((req: any) => ({ ...req, source: 'lead' }));
          setLeadProfileKeywords(leadMatched);
        }
        setCombinedScore(savedTender.evaluation.total_score);
        setPartnerProfileKeywords([]);
      }
    };

    loadProfileKeywords();
  }, [savedTender]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("saved_tenders")
        .update({
          comments,
          relevance_score: relevanceScore,
          time_criticality: timeCriticality,
        })
        .eq("id", savedTender.id);

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

  const handleMoveToMineLop = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("saved_tenders")
        .update({
          status: "pagar",
          current_stage: "kvalifisering",
          comments,
          relevance_score: relevanceScore,
          time_criticality: timeCriticality,
        })
        .eq("id", savedTender.id);

      if (error) throw error;

      toast({
        title: "Flyttet til Mine Løp",
        description: "Anbudet er nå i Mine Løp",
      });
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error("Error moving to Mine Løp:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke flytte anbudet",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {savedTender.tender.title}
            <a
              href={savedTender.tender.doffin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Oppdragsgiver:</span>
            <span>{savedTender.tender.client || "N/A"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Frist:</span>
            <span>{formatDate(savedTender.tender.deadline)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Score:</span>
            <Badge variant="default">
              {combinedScore}
            </Badge>
          </div>
          {savedTender.combination_type === 'combination' && savedTender.partnerName && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Partner:</span>
              <Badge variant="secondary" className={`${getPartnerColor(partnerIndex).bg} ${getPartnerColor(partnerIndex).text}`}>
                {savedTender.partnerName}
              </Badge>
            </div>
          )}
          {savedTender.combination_type === 'combination' ? (
            <>
              {leadProfileKeywords.length > 0 && (
                <div className="mt-2">
                  <span className="font-medium text-sm">Dine treff:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {leadProfileKeywords.map((req: any, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs border-blue-600 text-blue-600">
                        {req.keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {partnerProfileKeywords.length > 0 && (
                <div className="mt-2">
                  <span className="font-medium text-sm">Partner treff:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {partnerProfileKeywords.map((req: any, idx: number) => {
                      const colors = getPartnerColor(partnerIndex);
                      return (
                        <Badge key={idx} variant="outline" className={`text-xs ${colors.border} ${colors.text}`}>
                          {req.keyword}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            leadProfileKeywords.length > 0 && (
              <div className="mt-2">
                <span className="font-medium text-sm">Treff:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {leadProfileKeywords.map((req: any, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {req.keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="comments">Egne kommentarer</Label>
            <Textarea
              id="comments"
              placeholder="Legg til kommentarer om anbudet..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="relevance">
              Relevans: {relevanceScore}/100
            </Label>
            <Slider
              id="relevance"
              min={1}
              max={100}
              step={1}
              value={[relevanceScore]}
              onValueChange={(value) => setRelevanceScore(value[0])}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="criticality">Tidskritisk</Label>
            <Select value={timeCriticality} onValueChange={setTimeCriticality}>
              <SelectTrigger id="criticality">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lav">Lav</SelectItem>
                <SelectItem value="middels">Middels</SelectItem>
                <SelectItem value="høy">Høy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="default"
            onClick={handleMoveToMineLop}
            disabled={saving}
          >
            <ArrowRight className="mr-2 h-4 w-4" />
            Overfør til Mine Løp
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              Lagre
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
