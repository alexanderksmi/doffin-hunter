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

  useEffect(() => {
    setComments(savedTender.comments || "");
    setRelevanceScore(savedTender.relevance_score || 50);
    setTimeCriticality(savedTender.time_criticality || "middels");
    
    // Load profile keywords
    const loadProfileKeywords = async () => {
      // Get keywords from lead profile
      if (savedTender.evaluation.lead_profile_id) {
        const { data: leadKeywords } = await supabase
          .from("minimum_requirements")
          .select("keyword")
          .eq("profile_id", savedTender.evaluation.lead_profile_id);
        
        const leadMatched = (savedTender.evaluation.met_minimum_requirements || [])
          .filter((req: any) => 
            leadKeywords?.some(k => k.keyword.toLowerCase() === req.keyword.toLowerCase())
          );
        setLeadProfileKeywords(leadMatched);
      }

      // Get keywords from partner profile if it's a match
      if (savedTender.evaluation.combination_type === 'with_partner' && 
          savedTender.evaluation.partner_profile_id) {
        const { data: partnerKeywords } = await supabase
          .from("minimum_requirements")
          .select("keyword")
          .eq("profile_id", savedTender.evaluation.partner_profile_id);
        
        const partnerMatched = (savedTender.evaluation.met_minimum_requirements || [])
          .filter((req: any) => 
            partnerKeywords?.some(k => k.keyword.toLowerCase() === req.keyword.toLowerCase())
          );
        setPartnerProfileKeywords(partnerMatched);
      } else {
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
          <DialogDescription>
            <div className="space-y-2 mt-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Oppdragsgiver:</span>
                <span>{savedTender.tender.client || "N/A"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Frist:</span>
                <span>{formatDate(savedTender.tender.deadline)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Score:</span>
                <Badge variant="default">
                  {savedTender.evaluation.total_score}
                </Badge>
              </div>
              {savedTender.evaluation.combination_type === 'with_partner' && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Partner:</span>
                  <Badge variant="secondary">
                    {savedTender.evaluation.partner_name || "Partner"}
                  </Badge>
                </div>
              )}
              {leadProfileKeywords.length > 0 && (
                <div className="mt-2">
                  <span className="font-medium text-sm">Dine treff:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {leadProfileKeywords.map((req: any, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
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
                    {partnerProfileKeywords.map((req: any, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {req.keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

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
