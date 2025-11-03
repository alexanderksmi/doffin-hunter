import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
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
  const [combinations, setCombinations] = useState<any[]>([]);
  const [minScore, setMinScore] = useState<string>("1");
  const [viewFilter, setViewFilter] = useState<string>("published_desc");
  const { toast } = useToast();

  useEffect(() => {
    if (organizationId) {
      fetchCombinations();
      checkAndSyncTenders();
    }
  }, [organizationId]);

  const checkAndSyncTenders = async () => {
    try {
      // Check when last sync happened
      const { data: org } = await supabase
        .from('organizations')
        .select('last_tender_sync_at')
        .eq('id', organizationId)
        .single();

      const lastSync = org?.last_tender_sync_at ? new Date(org.last_tender_sync_at) : null;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // If no sync or last sync was over 1 hour ago, trigger sync
      if (!lastSync || lastSync < oneHourAgo) {
        console.log('Triggering automatic tender sync...');
        setLoading(true);
        await supabase.functions.invoke('fetch-doffin-tenders', {
          body: { organizationId }
        });
        setLoading(false);
      }

      // Fetch evaluations regardless
      fetchEvaluations();
    } catch (error) {
      console.error('Error checking/syncing tenders:', error);
      fetchEvaluations();
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchEvaluations();
    }
  }, [selectedCombination, minScore, viewFilter, organizationId]);

  // Subscribe to realtime updates for tender evaluations
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel('tender_evaluations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tender_evaluations',
          filter: `organization_id=eq.${organizationId}`
        },
        () => {
          // Refresh evaluations when data changes
          fetchEvaluations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  const fetchCombinations = async () => {
    const { data: profiles } = await supabase
      .from('company_profiles')
      .select('id, profile_name, is_own_profile')
      .eq('organization_id', organizationId);

    if (!profiles) return;

    const ownProfile = profiles.find(p => p.is_own_profile);
    if (!ownProfile) return;

    const combos: any[] = [];

    // Add combination matches first (both own AND each partner)
    const partnerProfiles = profiles.filter(p => !p.is_own_profile);
    partnerProfiles.forEach(partner => {
      combos.push({
        id: `combo_${ownProfile.id}_${partner.id}`,
        ownProfileId: ownProfile.id,
        partnerProfileId: partner.id,
        label: `${ownProfile.profile_name} + ${partner.profile_name}`,
        type: 'combination',
        ownProfileName: ownProfile.profile_name,
        partnerProfileName: partner.profile_name
      });
    });

    combos.push({ 
      id: 'own', 
      profileId: ownProfile.id, 
      label: `Kun ${ownProfile.profile_name}`, 
      type: 'own' 
    });

    // Add partner profiles
    partnerProfiles.forEach(partner => {
      combos.push({ 
        id: `partner_${partner.id}`,
        profileId: partner.id,
        label: `Kun ${partner.profile_name}`, 
        type: 'partner'
      });
    });

    setCombinations(combos);
  };

  const fetchEvaluations = async () => {
    setLoading(true);

    const now = new Date();
    const scoreThreshold = parseInt(minScore) || 0;

    // Determine which evaluations to fetch based on filter
    if (selectedCombination === 'all') {
      // Fetch all evaluations
      const { data: allEvals, error } = await supabase
        .from('tender_evaluations')
        .select(`
          *,
          tender:tender_id (
            id,
            title,
            client,
            deadline,
            published_date,
            doffin_url,
            body
          ),
          lead_profile:lead_profile_id (profile_name),
          partner_profile:partner_profile_id (profile_name)
        `)
        .eq('organization_id', organizationId)
        .gte('total_score', 1)
        .order('total_score', { ascending: false });

      if (error) {
        console.error('Error fetching evaluations:', error);
        setLoading(false);
        return;
      }

      // Also create combination evaluations for "Alle treff"
      const allCombinedEvals: any[] = [];
      
      for (const combo of combinations) {
        if (combo.type === 'combination') {
          // Fetch evaluations for both profiles
          const { data: ownEvals } = await supabase
            .from('tender_evaluations')
            .select(`
              *,
              tender:tender_id (
                id,
                title,
                client,
                deadline,
                published_date,
                doffin_url,
                body
              ),
              lead_profile:lead_profile_id (profile_name)
            `)
            .eq('organization_id', organizationId)
            .eq('lead_profile_id', combo.ownProfileId)
            .gte('total_score', 1);

          const { data: partnerEvals } = await supabase
            .from('tender_evaluations')
            .select(`
              *,
              tender:tender_id (
                id,
                title,
                client,
                deadline,
                published_date,
                doffin_url,
                body
              ),
              lead_profile:lead_profile_id (profile_name)
            `)
            .eq('organization_id', organizationId)
            .eq('lead_profile_id', combo.partnerProfileId)
            .gte('total_score', 1);

          // Find tenders that match BOTH profiles
          const ownTenderIds = new Set((ownEvals || []).map((e: any) => e.tender_id));
          const partnerTenderIds = new Set((partnerEvals || []).map((e: any) => e.tender_id));
          const bothTenderIds = [...ownTenderIds].filter(id => partnerTenderIds.has(id));

          // Create combined evaluations
          const combinedEvals = bothTenderIds.map(tenderId => {
            const ownEval = ownEvals?.find((e: any) => e.tender_id === tenderId);
            const partnerEval = partnerEvals?.find((e: any) => e.tender_id === tenderId);
            
            if (!ownEval || !partnerEval) return null;

            const ownReqs = ((ownEval.met_minimum_requirements as any) || []).map((req: any) => ({
              ...req,
              source: 'lead'
            }));
            const partnerReqs = ((partnerEval.met_minimum_requirements as any) || []).map((req: any) => ({
              ...req,
              source: 'partner'
            }));

            const allReqs = [...ownReqs, ...partnerReqs];
            const uniqueReqs = Array.from(
              new Map(allReqs.map(req => [req.keyword.toLowerCase(), req])).values()
            );

            const combinedScore = uniqueReqs.length;

            return {
              ...ownEval,
              met_minimum_requirements: uniqueReqs,
              total_score: combinedScore,
              combination_type: 'combination',
              explanation: `${combo.ownProfileName}: ${ownReqs.length} krav, ${combo.partnerProfileName}: ${partnerReqs.length} krav`,
              _combo_label: `${combo.ownProfileName} + ${combo.partnerProfileName}`
            };
          }).filter(Boolean);

          allCombinedEvals.push(...combinedEvals);
        }
      }

      // Merge solo and combination evaluations, keeping the one with highest score per tender
      const tenderMap = new Map<string, any>();
      
      // Add solo evaluations
      (allEvals || []).forEach((evaluation: any) => {
        const existing = tenderMap.get(evaluation.tender_id);
        if (!existing || evaluation.total_score > existing.total_score) {
          tenderMap.set(evaluation.tender_id, evaluation);
        }
      });

      // Add combination evaluations (may override solo if score is higher)
      allCombinedEvals.forEach((evaluation: any) => {
        const existing = tenderMap.get(evaluation.tender_id);
        if (!existing || evaluation.total_score > existing.total_score) {
          tenderMap.set(evaluation.tender_id, evaluation);
        }
      });

      const allEvalsWithCombos = Array.from(tenderMap.values());

      const filtered = allEvalsWithCombos.filter((evaluation: any) => {
        if (evaluation.total_score < scoreThreshold) return false;
        return true;
      });

      // Apply sorting based on viewFilter
      const sorted = applySorting(filtered, viewFilter);
      setEvaluations(sorted as any);
      setLoading(false);
      return;
    }

    const combo = combinations.find(c => c.id === selectedCombination);
    if (!combo) {
      setLoading(false);
      return;
    }

    if (combo.type === 'own' || combo.type === 'partner') {
      // Fetch evaluations for single profile
      const { data: evals, error } = await supabase
        .from('tender_evaluations')
        .select(`
          *,
          tender:tender_id (
            id,
            title,
            client,
            deadline,
            published_date,
            doffin_url,
            body
          ),
          lead_profile:lead_profile_id (profile_name),
          partner_profile:partner_profile_id (profile_name)
        `)
        .eq('organization_id', organizationId)
        .eq('lead_profile_id', combo.profileId)
        .gte('total_score', 1)
        .order('total_score', { ascending: false });

      if (error) {
        console.error('Error fetching evaluations:', error);
        setLoading(false);
        return;
      }

      const filtered = (evals || []).filter((evaluation: any) => {
        if (evaluation.total_score < scoreThreshold) return false;
        return true;
      });

      // Apply sorting based on viewFilter
      const sorted = applySorting(filtered, viewFilter);
      setEvaluations(sorted as any);
      setLoading(false);
      return;
    }

    if (combo.type === 'combination') {
      // Fetch evaluations for BOTH profiles
      const { data: ownEvals, error: ownError } = await supabase
        .from('tender_evaluations')
        .select(`
          *,
          tender:tender_id (
            id,
            title,
            client,
            deadline,
            published_date,
            doffin_url,
            body
          ),
          lead_profile:lead_profile_id (profile_name)
        `)
        .eq('organization_id', organizationId)
        .eq('lead_profile_id', combo.ownProfileId)
        .gte('total_score', 1);

      const { data: partnerEvals, error: partnerError } = await supabase
        .from('tender_evaluations')
        .select(`
          *,
          tender:tender_id (
            id,
            title,
            client,
            deadline,
            published_date,
            doffin_url,
            body
          ),
          lead_profile:lead_profile_id (profile_name)
        `)
        .eq('organization_id', organizationId)
        .eq('lead_profile_id', combo.partnerProfileId)
        .gte('total_score', 1);

      if (ownError || partnerError) {
        console.error('Error fetching combination evaluations');
        setLoading(false);
        return;
      }

      // Find tenders that match BOTH profiles
      const ownTenderIds = new Set((ownEvals || []).map((e: any) => e.tender_id));
      const partnerTenderIds = new Set((partnerEvals || []).map((e: any) => e.tender_id));
      const bothTenderIds = [...ownTenderIds].filter(id => partnerTenderIds.has(id));

      // Merge evaluations for matched tenders
      const combinedEvals = bothTenderIds.map(tenderId => {
        const ownEval = ownEvals?.find((e: any) => e.tender_id === tenderId);
        const partnerEval = partnerEvals?.find((e: any) => e.tender_id === tenderId);
        
        if (!ownEval || !partnerEval) return null;

        // Merge met_minimum_requirements from both profiles
        const ownReqs = ((ownEval.met_minimum_requirements as any) || []).map((req: any) => ({
          ...req,
          source: 'lead'
        }));
        const partnerReqs = ((partnerEval.met_minimum_requirements as any) || []).map((req: any) => ({
          ...req,
          source: 'partner'
        }));

        // Combine and remove duplicates based on keyword
        const allReqs = [...ownReqs, ...partnerReqs];
        const uniqueReqs = Array.from(
          new Map(allReqs.map(req => [req.keyword.toLowerCase(), req])).values()
        );

        // Calculate combined score as the total number of unique met requirements
        const combinedScore = uniqueReqs.length;

        return {
          ...ownEval,
          met_minimum_requirements: uniqueReqs,
          total_score: combinedScore,
          combination_type: 'combination',
          explanation: `${combo.ownProfileName}: ${ownReqs.length} krav, ${combo.partnerProfileName}: ${partnerReqs.length} krav`
        };
      }).filter(Boolean);

      const filtered = combinedEvals.filter((evaluation: any) => {
        if (!evaluation || evaluation.total_score < scoreThreshold) return false;
        return true;
      });

      // Apply sorting based on viewFilter
      const sorted = applySorting(filtered, viewFilter);
      setEvaluations(sorted as any);
      setLoading(false);
    }
  };

  const applySorting = (evals: any[], sortType: string) => {
    const sorted = [...evals];
    
    switch (sortType) {
      case 'published_desc':
        return sorted.sort((a, b) => {
          const dateA = a.tender?.published_date ? new Date(a.tender.published_date).getTime() : 0;
          const dateB = b.tender?.published_date ? new Date(b.tender.published_date).getTime() : 0;
          const dateDiff = dateB - dateA;
          if (dateDiff !== 0) return dateDiff;
          return b.total_score - a.total_score;
        });
      case 'published_asc':
        return sorted.sort((a, b) => {
          const dateA = a.tender?.published_date ? new Date(a.tender.published_date).getTime() : 0;
          const dateB = b.tender?.published_date ? new Date(b.tender.published_date).getTime() : 0;
          const dateDiff = dateA - dateB;
          if (dateDiff !== 0) return dateDiff;
          return b.total_score - a.total_score;
        });
      case 'deadline_desc':
        return sorted.sort((a, b) => {
          const dateA = a.tender?.deadline ? new Date(a.tender.deadline).getTime() : Infinity;
          const dateB = b.tender?.deadline ? new Date(b.tender.deadline).getTime() : Infinity;
          const dateDiff = dateB - dateA;
          if (dateDiff !== 0) return dateDiff;
          return b.total_score - a.total_score;
        });
      case 'deadline_asc':
        return sorted.sort((a, b) => {
          const dateA = a.tender?.deadline ? new Date(a.tender.deadline).getTime() : Infinity;
          const dateB = b.tender?.deadline ? new Date(b.tender.deadline).getTime() : Infinity;
          const dateDiff = dateA - dateB;
          if (dateDiff !== 0) return dateDiff;
          return b.total_score - a.total_score;
        });
      default:
        return sorted.sort((a, b) => b.total_score - a.total_score);
    }
  };

  const getCombinationLabel = (evaluation: any) => {
    // Check if we have a cached combo label (from "Alle treff")
    if (evaluation._combo_label) {
      return evaluation._combo_label;
    }
    
    if (evaluation.combination_type === 'combination') {
      const combo = combinations.find(c => c.type === 'combination');
      if (combo) {
        return `${combo.ownProfileName} + ${combo.partnerProfileName}`;
      }
    }
    return evaluation.lead_profile.profile_name;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex items-center gap-2">
          <Label>Filtrer:</Label>
          <Select value={selectedCombination} onValueChange={setSelectedCombination}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle treff</SelectItem>
              {combinations.map(combo => (
                <SelectItem key={combo.id} value={combo.id}>
                  {combo.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label>Min poeng:</Label>
          <Select value={minScore} onValueChange={setMinScore}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1+</SelectItem>
              <SelectItem value="2">2+</SelectItem>
              <SelectItem value="3">3+</SelectItem>
              <SelectItem value="4">4+</SelectItem>
              <SelectItem value="5">5+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label>Visning:</Label>
          <Select value={viewFilter} onValueChange={setViewFilter}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="published_desc">Publiseringsdato: Ny til gammel</SelectItem>
              <SelectItem value="published_asc">Publiseringsdato: Gammel til ny</SelectItem>
              <SelectItem value="deadline_desc">Frist: Sen til snart</SelectItem>
              <SelectItem value="deadline_asc">Frist: Snart til sen</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
              <TableHead>Filtrer</TableHead>
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
                  <p className="font-medium">Ingen anbud funnet med minst 1 oppfylt minimumskrav</p>
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
                    <Badge 
                      variant="default" 
                      className={
                        evaluation.lead_profile.profile_name === 'Documaster' 
                          ? 'bg-blue-600' 
                          : 'bg-green-600'
                      }
                    >
                      {evaluation.total_score}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(evaluation.met_minimum_requirements as any[]).map((req: any, idx: number) => (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className={`text-xs ${
                            req.source === 'partner' ? 'border-green-600 text-green-600' : 
                            req.source === 'lead' && evaluation.combination_type !== 'solo' ? 'border-blue-600 text-blue-600' : ''
                          }`}
                        >
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
