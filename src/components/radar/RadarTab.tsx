import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Bookmark, RefreshCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getPartnerColor } from "@/lib/partnerColors";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { toast } = useToast();
  const [evaluations, setEvaluations] = useState<TenderEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedCombination, setSelectedCombination] = useState<string>("all");
  const [combinations, setCombinations] = useState<any[]>([]);
  const [partnerIndexMap, setPartnerIndexMap] = useState<Map<string, number>>(new Map());
  const [minScore, setMinScore] = useState<string>("1");
  const [viewFilter, setViewFilter] = useState<string>("score_desc");
  const [savedTenderIds, setSavedTenderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (organizationId) {
      fetchCombinations();
      checkAndSyncTenders();
      loadSavedTenderIds();
    }
  }, [organizationId]);

  const loadSavedTenderIds = async () => {
    const { data } = await supabase
      .from('saved_tenders')
      .select('tender_id')
      .eq('organization_id', organizationId);
    
    if (data) {
      setSavedTenderIds(new Set(data.map(st => st.tender_id)));
    }
  };

  const pollSyncStatus = async (syncLogId: string) => {
    const maxAttempts = 60; // Max 5 minutes (60 * 5 seconds)
    let attempts = 0;

    while (attempts < maxAttempts) {
      const { data: syncLog } = await supabase
        .from('tender_sync_log')
        .select('status')
        .eq('id', syncLogId)
        .single();

      if (syncLog?.status === 'completed' || syncLog?.status === 'failed') {
        return syncLog.status;
      }

      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;
    }

    return 'timeout';
  };

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
        setIsSyncing(true);
        setLoading(true);

        // Trigger fetch tenders
        await supabase.functions.invoke('fetch-doffin-tenders', {
          body: { organizationId }
        });

        // Wait a bit for sync log to be created, then get latest sync log to poll
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data: latestSync } = await supabase
          .from('tender_sync_log')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Poll sync status if we have a sync log id
        if (latestSync?.id) {
          const status = await pollSyncStatus(latestSync.id);
          console.log('Fetch completed with status:', status);
        }

        // Now trigger evaluation of tenders
        console.log('Triggering tender evaluation...');
        await supabase.functions.invoke('evaluate-tenders');
        console.log('Evaluation completed');

        setIsSyncing(false);
      }

      // Fetch evaluations after sync completes
      fetchEvaluations();
    } catch (error) {
      console.error('Error checking/syncing tenders:', error);
      setIsSyncing(false);
      fetchEvaluations();
    }
  };

  const manualSyncTenders = async () => {
    try {
      setIsSyncing(true);
      setLoading(true);

      toast({
        title: "Synkroniserer anbud",
        description: "Henter nye anbud fra Doffin...",
      });

      // Trigger fetch tenders
      await supabase.functions.invoke('fetch-doffin-tenders', {
        body: { organizationId }
      });

      // Wait a bit for sync log to be created, then get latest sync log to poll
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { data: latestSync } = await supabase
        .from('tender_sync_log')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Poll sync status if we have a sync log id
      if (latestSync?.id) {
        const status = await pollSyncStatus(latestSync.id);
        console.log('Fetch completed with status:', status);
      }

      // Now trigger evaluation of tenders in incremental mode
      toast({
        title: "Evaluerer anbud",
        description: "Beregner relevans for nye anbud...",
      });

      await supabase.functions.invoke('evaluate-tenders', {
        body: { mode: 'incremental' }
      });
      
      toast({
        title: "Synkronisering fullført",
        description: "Alle nye anbud er oppdatert",
      });

      setIsSyncing(false);
      fetchEvaluations();
    } catch (error) {
      console.error('Error manually syncing tenders:', error);
      toast({
        title: "Feil ved synkronisering",
        description: "Kunne ikke synkronisere anbud",
        variant: "destructive",
      });
      setIsSyncing(false);
      fetchEvaluations();
    }
  };

  const fullReEvaluation = async () => {
    try {
      setLoading(true);

      toast({
        title: "Full re-evaluering",
        description: "Evaluerer alle anbud på nytt...",
      });

      await supabase.functions.invoke('evaluate-tenders', {
        body: { mode: 'full' }
      });
      
      toast({
        title: "Re-evaluering fullført",
        description: "Alle anbud er evaluert på nytt",
      });

      fetchEvaluations();
    } catch (error) {
      console.error('Error in full re-evaluation:', error);
      toast({
        title: "Feil ved re-evaluering",
        description: "Kunne ikke re-evaluere anbud",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId && (selectedCombination !== 'all' || combinations.length > 0)) {
      fetchEvaluations();
    }
  }, [selectedCombination, minScore, viewFilter, organizationId, combinations.length]);

  // Subscribe to realtime updates for tender evaluations (only when not syncing)
  useEffect(() => {
    if (!organizationId || isSyncing) return;

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
  }, [organizationId, isSyncing]);

  const fetchCombinations = async () => {
    const { data: profiles } = await supabase
      .from('company_profiles')
      .select('id, profile_name, is_own_profile, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });

    if (!profiles) return;

    const ownProfile = profiles.find(p => p.is_own_profile);
    if (!ownProfile) return;

    // Create partner index map
    const partnerProfiles = profiles.filter(p => !p.is_own_profile);
    const indexMap = new Map<string, number>();
    partnerProfiles.forEach((partner, index) => {
      indexMap.set(partner.id, index);
    });
    setPartnerIndexMap(indexMap);

    const combos: any[] = [];

    // Add combination matches first (both own AND each partner)
    partnerProfiles.forEach((partner, index) => {
      combos.push({
        id: `combo_${ownProfile.id}_${partner.id}`,
        ownProfileId: ownProfile.id,
        partnerProfileId: partner.id,
        label: `${ownProfile.profile_name} + ${partner.profile_name}`,
        type: 'combination',
        ownProfileName: ownProfile.profile_name,
        partnerProfileName: partner.profile_name,
        partnerIndex: index
      });
    });

    combos.push({ 
      id: 'own', 
      profileId: ownProfile.id, 
      label: `Kun ${ownProfile.profile_name}`, 
      type: 'own' 
    });

    // Add partner profiles
    partnerProfiles.forEach((partner, index) => {
      combos.push({ 
        id: `partner_${partner.id}`,
        profileId: partner.id,
        label: `Kun ${partner.profile_name}`, 
        type: 'partner',
        partnerIndex: index
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
      case 'score_desc':
        return sorted.sort((a, b) => b.total_score - a.total_score);
      case 'score_asc':
        return sorted.sort((a, b) => a.total_score - b.total_score);
      case 'published_desc':
        return sorted.sort((a, b) => {
          const dateA = a.tender?.published_date ? new Date(a.tender.published_date).getTime() : 0;
          const dateB = b.tender?.published_date ? new Date(b.tender.published_date).getTime() : 0;
          return dateB - dateA;
        });
      case 'published_asc':
        return sorted.sort((a, b) => {
          const dateA = a.tender?.published_date ? new Date(a.tender.published_date).getTime() : 0;
          const dateB = b.tender?.published_date ? new Date(b.tender.published_date).getTime() : 0;
          return dateA - dateB;
        });
      case 'deadline_desc':
        return sorted.sort((a, b) => {
          const dateA = a.tender?.deadline ? new Date(a.tender.deadline).getTime() : Infinity;
          const dateB = b.tender?.deadline ? new Date(b.tender.deadline).getTime() : Infinity;
          return dateB - dateA;
        });
      case 'deadline_asc':
        return sorted.sort((a, b) => {
          const dateA = a.tender?.deadline ? new Date(a.tender.deadline).getTime() : Infinity;
          const dateB = b.tender?.deadline ? new Date(b.tender.deadline).getTime() : Infinity;
          return dateA - dateB;
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

  const handleSaveTender = async (evaluation: any) => {
    try {
      // Determine if this is a combination or solo save
      const isCombination = evaluation.combination_type === 'combination';
      
      // Find the combo to get profile IDs
      let leadProfileId = evaluation.lead_profile_id;
      let partnerProfileId = evaluation.partner_profile_id;
      
      if (isCombination && !partnerProfileId) {
        // For "Alle treff" combinations, we need to find the combo
        const combo = combinations.find(c => c.type === 'combination');
        if (combo) {
          leadProfileId = combo.ownProfileId;
          partnerProfileId = combo.partnerProfileId;
        }
      }

      const { error } = await supabase
        .from("saved_tenders")
        .insert({
          tender_id: evaluation.tender_id,
          evaluation_id: evaluation.id,
          organization_id: organizationId,
          saved_by: (await supabase.auth.getUser()).data.user?.id,
          status: "vurdering",
          combination_type: isCombination ? 'combination' : 'solo',
          lead_profile_id: leadProfileId,
          partner_profile_id: isCombination ? partnerProfileId : null,
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Allerede lagret",
            description: "Dette anbudet er allerede lagret",
            variant: "destructive",
          });
        } else {
          throw error;
        }
      } else {
        // Update saved tender IDs
        setSavedTenderIds(prev => new Set(prev).add(evaluation.tender_id));
        toast({
          title: "Lagret",
          description: "Anbudet er lagret i Matches",
        });
      }
    } catch (error) {
      console.error("Error saving tender:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke lagre anbudet",
        variant: "destructive",
      });
    }
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
          <Label>Sorter:</Label>
          <Select value={viewFilter} onValueChange={setViewFilter}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score_desc">Score: Høy til lav</SelectItem>
              <SelectItem value="score_asc">Score: Lav til høy</SelectItem>
              <SelectItem value="published_desc">Publiseringsdato: Ny til gammel</SelectItem>
              <SelectItem value="published_asc">Publiseringsdato: Gammel til ny</SelectItem>
              <SelectItem value="deadline_desc">Frist: Sen til snart</SelectItem>
              <SelectItem value="deadline_asc">Frist: Snart til sen</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={manualSyncTenders} 
          disabled={isSyncing || loading}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? "Synkroniserer..." : "Sync anbud"}
        </Button>

        <Button 
          onClick={fullReEvaluation} 
          disabled={loading}
          variant="secondary"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading && !isSyncing ? 'animate-spin' : ''}`} />
          Full re-evaluering
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
              <TableHead>Filtrer</TableHead>
              <TableHead className="w-16">Score</TableHead>
              <TableHead>Søkeord</TableHead>
              <TableHead>Forklaring</TableHead>
              <TableHead>Frist</TableHead>
              <TableHead>Publisert</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isSyncing || loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                </TableRow>
              ))
            ) : evaluations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
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
                        evaluation.combination_type === 'combination' && evaluation.partner_profile_id
                          ? (() => {
                              const partnerIdx = partnerIndexMap.get(evaluation.partner_profile_id!) ?? 0;
                              const colors = getPartnerColor(partnerIdx);
                              return `${colors.bg} ${colors.text} border ${colors.border}`;
                            })()
                          : 'bg-blue-600'
                      }
                    >
                      {evaluation.total_score}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(evaluation.met_minimum_requirements as any[]).map((req: any, idx: number) => {
                        let badgeClass = "";
                        if (req.source === 'partner' && evaluation.partner_profile?.profile_name) {
                          // Get partner index from partner_profile_id
                          const partnerIndex = partnerIndexMap.get(evaluation.partner_profile_id!) ?? 0;
                          const colors = getPartnerColor(partnerIndex);
                          badgeClass = `${colors.border} ${colors.text}`;
                        } else if (req.source === 'lead' && evaluation.combination_type !== 'solo') {
                          badgeClass = 'border-blue-600 text-blue-600';
                        }
                        
                        return (
                          <Badge 
                            key={idx} 
                            variant="outline" 
                            className={`text-xs ${badgeClass}`}
                          >
                            {req.keyword}
                          </Badge>
                        );
                      })}
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
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSaveTender(evaluation)}
                      title="Lagre anbud"
                    >
                      <Bookmark 
                        className={`h-4 w-4 ${savedTenderIds.has(evaluation.tender_id) ? 'fill-current' : ''}`}
                      />
                    </Button>
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
