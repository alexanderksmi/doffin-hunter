import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface TenderEvaluation {
  id: string;
  tender_id: string;
  combination_type: string;
  all_minimum_requirements_met: boolean;
  total_score: number;
  explanation: string;
  met_minimum_requirements: any[];
  lead_profile_id: string;
  partner_profile_id: string | null;
  tender: {
    title: string;
    client: string;
    deadline: string;
    published_date: string;
    doffin_url: string;
  };
  lead_profile: {
    profile_name: string;
  };
  partner_profile: {
    profile_name: string;
  } | null;
}

export const RadarTab = () => {
  const { organizationId } = useAuth();
  const [evaluations, setEvaluations] = useState<TenderEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCombination, setSelectedCombination] = useState<string>("all");
  const [noiseFilter, setNoiseFilter] = useState(true);
  const [combinations, setCombinations] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (organizationId) {
      fetchCombinations();
      fetchEvaluations();
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      fetchEvaluations();
    }
  }, [selectedCombination, noiseFilter, organizationId]);

  const fetchCombinations = async () => {
    const { data: profiles } = await supabase
      .from('company_profiles')
      .select('id, profile_name, is_own_profile')
      .eq('organization_id', organizationId);

    if (!profiles) return;

    const ownProfile = profiles.find(p => p.is_own_profile);
    if (!ownProfile) return;

    const combos: any[] = [
      { id: 'solo', label: `Solo (${ownProfile.profile_name})`, type: 'solo' }
    ];

    const { data: graphs } = await supabase
      .from('partner_graph')
      .select(`
        id,
        combination_type,
        lead_profile:lead_profile_id(profile_name),
        partner_profile:partner_profile_id(profile_name)
      `)
      .eq('organization_id', organizationId);

    if (graphs) {
      graphs.forEach((g: any) => {
        const label = g.combination_type === 'lead_partner' 
          ? `${g.lead_profile.profile_name} leder + ${g.partner_profile.profile_name}`
          : `${g.partner_profile.profile_name} leder + ${g.lead_profile.profile_name}`;
        combos.push({ id: g.id, label, type: g.combination_type });
      });
    }

    setCombinations(combos);
  };

  const fetchEvaluations = async () => {
    setLoading(true);

    let query = supabase
      .from('tender_evaluations')
      .select(`
        *,
        tender:tender_id (
          title,
          client,
          deadline,
          published_date,
          doffin_url
        ),
        lead_profile:lead_profile_id (profile_name),
        partner_profile:partner_profile_id (profile_name)
      `)
      .eq('organization_id', organizationId)
      .order('total_score', { ascending: false });

    // Apply noise filter
    if (noiseFilter) {
      query = query.eq('all_minimum_requirements_met', true);
    }

    // Apply combination filter
    if (selectedCombination !== 'all') {
      if (selectedCombination === 'solo') {
        query = query.eq('combination_type', 'solo');
      } else {
        query = query.eq('combination_id', selectedCombination);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching evaluations:', error);
    } else {
      setEvaluations((data || []) as any);
    }

    setLoading(false);
  };

  const getCombinationLabel = (evaluation: TenderEvaluation) => {
    if (evaluation.combination_type === 'solo') {
      return evaluation.lead_profile.profile_name;
    }
    
    if (evaluation.combination_type === 'lead_partner') {
      return `${evaluation.lead_profile.profile_name} (lead) + ${evaluation.partner_profile?.profile_name || '?'}`;
    }
    
    return `${evaluation.partner_profile?.profile_name || '?'} (lead) + ${evaluation.lead_profile.profile_name}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Trigger re-evaluation of tenders
      const { error } = await supabase.functions.invoke('evaluate-tenders', {
        body: { organizationId }
      });

      if (error) throw error;

      // Fetch updated evaluations
      await fetchEvaluations();

      toast({
        title: "Oppdatert",
        description: "Anbudsdata er oppdatert",
      });
    } catch (error) {
      console.error('Error refreshing:', error);
      toast({
        title: "Feil",
        description: "Kunne ikke oppdatere data",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex items-center gap-2">
          <Label>Kombinasjon:</Label>
          <Select value={selectedCombination} onValueChange={setSelectedCombination}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle kombinasjoner</SelectItem>
              {combinations.map(combo => (
                <SelectItem key={combo.id} value={combo.id}>
                  {combo.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="noise-filter"
            checked={noiseFilter}
            onCheckedChange={setNoiseFilter}
          />
          <Label htmlFor="noise-filter">
            Støybryter (kun fulle treff)
          </Label>
        </div>

        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Oppdater
        </Button>

        <div className="ml-auto text-sm text-muted-foreground">
          {evaluations.length} anbud
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Link</TableHead>
              <TableHead className="w-[30%]">Tittel</TableHead>
              <TableHead>Oppdragsgiver</TableHead>
              <TableHead>Kombinasjon</TableHead>
              <TableHead className="w-16">Score</TableHead>
              <TableHead>Krav</TableHead>
              <TableHead>Forklaring</TableHead>
              <TableHead>Frist</TableHead>
              <TableHead>Publisert</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Laster...
                </TableCell>
              </TableRow>
            ) : evaluations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  <div className="space-y-2">
                    <p className="font-medium">Ingen anbud funnet</p>
                    <p className="text-sm">
                      {noiseFilter 
                        ? "Minimumskrav er strenge dørvakter. Prøv å slå av støybryteren for å se nær-treff."
                        : "Ingen anbud matcher dine profiler ennå."
                      }
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              evaluations.map(evaluation => (
                <TableRow key={evaluation.id}>
                  <TableCell>
                    <a
                      href={evaluation.tender.doffin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center text-primary hover:text-primary/80"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </TableCell>
                  <TableCell className="font-medium">
                    {evaluation.tender.title}
                  </TableCell>
                  <TableCell className="text-sm">
                    {evaluation.tender.client || "N/A"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {getCombinationLabel(evaluation)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={evaluation.all_minimum_requirements_met ? "default" : "secondary"}>
                      {evaluation.total_score}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(evaluation.met_minimum_requirements as any[]).map((req: any, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {req.keyword}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {evaluation.explanation}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(evaluation.tender.deadline)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(evaluation.tender.published_date)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
