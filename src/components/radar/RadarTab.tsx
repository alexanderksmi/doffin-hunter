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
  const [deadlineFilter, setDeadlineFilter] = useState<string>("all");
  const [publishedFilter, setPublishedFilter] = useState<string>("all");
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
  }, [selectedCombination, minScore, deadlineFilter, publishedFilter, organizationId]);

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

    const combos: any[] = [
      { id: 'own', profileId: ownProfile.id, label: `Kun egne (${ownProfile.profile_name})`, type: 'own' }
    ];

    // Add partner profiles
    const partnerProfiles = profiles.filter(p => !p.is_own_profile);
    partnerProfiles.forEach(partner => {
      combos.push({ 
        id: `partner_${partner.id}`,
        profileId: partner.id,
        label: `Kun ${partner.profile_name}`, 
        type: 'partner'
      });
    });

    // Add combination matches (both own AND each partner)
    partnerProfiles.forEach(partner => {
      combos.push({
        id: `combo_${ownProfile.id}_${partner.id}`,
        ownProfileId: ownProfile.id,
        partnerProfileId: partner.id,
        label: `${ownProfile.profile_name} + ${partner.profile_name}`,
        type: 'combination'
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

      const filtered = (allEvals || []).filter((evaluation: any) => {
        const deadline = evaluation.tender?.deadline;
        if (deadlineFilter === 'expired') {
          if (!deadline || new Date(deadline) > now) return false;
        } else if (deadlineFilter === 'active') {
          if (!deadline || new Date(deadline) <= now) return false;
        }
        
        const published = evaluation.tender?.published_date;
        if (publishedFilter !== 'all' && published) {
          const publishedDate = new Date(published);
          const daysAgo = Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (publishedFilter === '7days' && daysAgo > 7) return false;
          if (publishedFilter === '14days' && daysAgo > 14) return false;
          if (publishedFilter === '30days' && daysAgo > 30) return false;
        }

        if (evaluation.total_score < scoreThreshold) return false;

        return true;
      });

      setEvaluations(filtered as any);
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
        const deadline = evaluation.tender?.deadline;
        if (deadlineFilter === 'expired') {
          if (!deadline || new Date(deadline) > now) return false;
        } else if (deadlineFilter === 'active') {
          if (!deadline || new Date(deadline) <= now) return false;
        }
        
        const published = evaluation.tender?.published_date;
        if (publishedFilter !== 'all' && published) {
          const publishedDate = new Date(published);
          const daysAgo = Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (publishedFilter === '7days' && daysAgo > 7) return false;
          if (publishedFilter === '14days' && daysAgo > 14) return false;
          if (publishedFilter === '30days' && daysAgo > 30) return false;
        }

        if (evaluation.total_score < scoreThreshold) return false;

        return true;
      });

      setEvaluations(filtered as any);
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

      // Get evaluations for matched tenders
      const combinedEvals = (ownEvals || []).filter((e: any) => bothTenderIds.includes(e.tender_id));

      const filtered = combinedEvals.filter((evaluation: any) => {
        const deadline = evaluation.tender?.deadline;
        if (deadlineFilter === 'expired') {
          if (!deadline || new Date(deadline) > now) return false;
        } else if (deadlineFilter === 'active') {
          if (!deadline || new Date(deadline) <= now) return false;
        }
        
        const published = evaluation.tender?.published_date;
        if (publishedFilter !== 'all' && published) {
          const publishedDate = new Date(published);
          const daysAgo = Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (publishedFilter === '7days' && daysAgo > 7) return false;
          if (publishedFilter === '14days' && daysAgo > 14) return false;
          if (publishedFilter === '30days' && daysAgo > 30) return false;
        }

        if (evaluation.total_score < scoreThreshold) return false;

        return true;
      });

      setEvaluations(filtered as any);
      setLoading(false);
    }
  };

  const getCombinationLabel = (evaluation: TenderEvaluation) => {
    return `Solo (${evaluation.lead_profile.profile_name})`;
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
          <Label>Frist:</Label>
          <Select value={deadlineFilter} onValueChange={setDeadlineFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="active">Aktive</SelectItem>
              <SelectItem value="expired">Utgåtte</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label>Publisert:</Label>
          <Select value={publishedFilter} onValueChange={setPublishedFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="7days">Siste 7 dager</SelectItem>
              <SelectItem value="14days">Siste 14 dager</SelectItem>
              <SelectItem value="30days">Siste 30 dager</SelectItem>
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
                    {evaluation.combination_type === 'solo' ? (
                      <Badge variant={evaluation.all_minimum_requirements_met ? "default" : "secondary"}>
                        {evaluation.total_score}
                      </Badge>
                    ) : (
                      <div className="flex gap-1">
                        <Badge variant="default" className="bg-blue-600">
                          {(evaluation.met_minimum_requirements as any[]).filter((r: any) => r.source === 'lead').length}
                        </Badge>
                        <Badge variant="default" className="bg-green-600">
                          {(evaluation.met_minimum_requirements as any[]).filter((r: any) => r.source === 'partner').length}
                        </Badge>
                      </div>
                    )}
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
