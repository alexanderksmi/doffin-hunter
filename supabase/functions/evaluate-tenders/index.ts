import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface MinimumRequirement {
  keyword: string;
}

interface SupportKeyword {
  keyword: string;
  weight: number;
}

interface NegativeKeyword {
  keyword: string;
  weight: number;
}

interface CpvCode {
  cpv_code: string;
  weight: number;
}

interface Profile {
  id: string;
  profile_name: string;
  minimum_requirements: MinimumRequirement[];
  support_keywords: SupportKeyword[];
  negative_keywords: NegativeKeyword[];
  cpv_codes: CpvCode[];
}

interface Combination {
  id: string | null;
  type: 'solo' | 'lead_partner' | 'partner_lead';
  lead_profile: Profile;
  partner_profile: Profile | null;
}

interface Tender {
  id: string;
  title: string;
  body: string;
  cpv_codes: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting tender evaluation...');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all organizations
    const { data: organizations, error: orgsError } = await supabase
      .from('organizations')
      .select('id');
    
    if (orgsError) throw orgsError;
    if (!organizations || organizations.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No organizations to evaluate' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Evaluating for ${organizations.length} organizations...`);

    for (const org of organizations) {
      await evaluateOrganization(supabase, org.id);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in evaluate-tenders:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function evaluateOrganization(supabase: any, orgId: string) {
  console.log(`\n=== Evaluating org ${orgId} ===`);

  // Fetch all profiles for this org with their keywords
  const { data: profiles, error: profilesError } = await supabase
    .from('company_profiles')
    .select(`
      id,
      profile_name,
      is_own_profile,
      minimum_requirements (keyword),
      support_keywords (keyword, weight),
      negative_keywords (keyword, weight),
      cpv_codes (cpv_code, weight)
    `)
    .eq('organization_id', orgId);

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
    return;
  }

  if (!profiles || profiles.length === 0) {
    console.log(`No profiles found for org ${orgId}, skipping`);
    return;
  }

  console.log(`Found ${profiles.length} profiles`);

  // Find own profile
  const ownProfile = profiles.find((p: any) => p.is_own_profile);
  if (!ownProfile) {
    console.log(`No own profile found for org ${orgId}, skipping`);
    return;
  }

  // Build combinations
  const combinations: Combination[] = [];

  // Solo combination
  combinations.push({
    id: null,
    type: 'solo',
    lead_profile: ownProfile as any,
    partner_profile: null
  });

  // Partner combinations from partner_graph
  const { data: partnerGraphs, error: graphError } = await supabase
    .from('partner_graph')
    .select('*')
    .eq('organization_id', orgId);

  if (!graphError && partnerGraphs) {
    for (const graph of partnerGraphs) {
      const leadProfile = profiles.find((p: any) => p.id === graph.lead_profile_id);
      const partnerProfile = profiles.find((p: any) => p.id === graph.partner_profile_id);

      if (leadProfile && partnerProfile) {
        combinations.push({
          id: graph.id,
          type: graph.combination_type,
          lead_profile: leadProfile as any,
          partner_profile: partnerProfile as any
        });
      }
    }
  }

  console.log(`Built ${combinations.length} combinations`);

  // Fetch tenders for this org
  const { data: tenders, error: tendersError } = await supabase
    .from('tenders')
    .select('id, title, body, cpv_codes')
    .eq('org_id', orgId);

  if (tendersError) {
    console.error('Error fetching tenders:', tendersError);
    return;
  }

  if (!tenders || tenders.length === 0) {
    console.log(`No tenders found for org ${orgId}`);
    return;
  }

  console.log(`Evaluating ${tenders.length} tenders against ${combinations.length} combinations...`);

  // Evaluate each tender against each combination
  for (const tender of tenders) {
    for (const combination of combinations) {
      await evaluateTenderCombination(supabase, orgId, tender, combination);
    }
  }

  console.log(`Completed evaluation for org ${orgId}`);
}

async function evaluateTenderCombination(
  supabase: any,
  orgId: string,
  tender: Tender,
  combination: Combination
) {
  const tenderText = `${tender.title} ${tender.body}`.toLowerCase();
  const titleText = tender.title.toLowerCase();
  const descriptionText = tender.body.toLowerCase();
  const cpvCodes = tender.cpv_codes || [];

  // Collect all minimum requirements from both profiles
  const allMinReqs: MinimumRequirement[] = [
    ...(combination.lead_profile.minimum_requirements || [])
  ];
  if (combination.partner_profile) {
    allMinReqs.push(...(combination.partner_profile.minimum_requirements || []));
  }

  // Step 1: Qualification - ALL minimum requirements must be present
  const metMinReqs: any[] = [];
  const missingMinReqs: string[] = [];

  for (const req of allMinReqs) {
    const keyword = req.keyword.toLowerCase();
    let foundIn: string | null = null;

    if (titleText.includes(keyword)) {
      foundIn = 'title';
    } else if (descriptionText.includes(keyword)) {
      foundIn = 'description';
    } else if (cpvCodes.some(code => code.toLowerCase().includes(keyword))) {
      foundIn = 'cpv';
    }

    if (foundIn) {
      metMinReqs.push({ keyword: req.keyword, found_in: foundIn });
    } else {
      missingMinReqs.push(req.keyword);
    }
  }

  const allMinimumRequirementsMet = missingMinReqs.length === 0;

  // If minimum requirements not met, score is 0
  if (!allMinimumRequirementsMet) {
    await supabase
      .from('tender_evaluations')
      .upsert({
        tender_id: tender.id,
        organization_id: orgId,
        combination_id: combination.id,
        combination_type: combination.type,
        lead_profile_id: combination.lead_profile.id,
        partner_profile_id: combination.partner_profile?.id || null,
        all_minimum_requirements_met: false,
        met_minimum_requirements: metMinReqs,
        missing_minimum_requirements: missingMinReqs,
        support_score: 0,
        negative_score: 0,
        cpv_score: 0,
        synergy_bonus: 0,
        total_score: 0,
        matched_support_keywords: [],
        matched_negative_keywords: [],
        matched_cpv_codes: [],
        explanation: `Mangler minimumskrav: ${missingMinReqs.join(', ')}`
      }, {
        onConflict: 'tender_id,organization_id,combination_id'
      });
    
    return;
  }

  // Step 2: Relevance - Support keywords with weights
  const TITLE_WEIGHT_MULTIPLIER = 2; // Title words count double
  let supportScore = 0;
  const matchedSupportKeywords: any[] = [];

  const allSupportKeywords = [
    ...(combination.lead_profile.support_keywords || [])
  ];
  if (combination.partner_profile) {
    allSupportKeywords.push(...(combination.partner_profile.support_keywords || []));
  }

  for (const kw of allSupportKeywords) {
    const keyword = kw.keyword.toLowerCase();
    let foundIn: string | null = null;
    let weight = kw.weight;

    if (titleText.includes(keyword)) {
      foundIn = 'title';
      weight *= TITLE_WEIGHT_MULTIPLIER;
    } else if (descriptionText.includes(keyword)) {
      foundIn = 'description';
    }

    if (foundIn) {
      supportScore += weight;
      matchedSupportKeywords.push({
        keyword: kw.keyword,
        weight: kw.weight,
        found_in: foundIn,
        effective_weight: weight
      });
    }
  }

  // Step 3: Negative keywords
  let negativeScore = 0;
  const matchedNegativeKeywords: any[] = [];

  const allNegativeKeywords = [
    ...(combination.lead_profile.negative_keywords || [])
  ];
  if (combination.partner_profile) {
    allNegativeKeywords.push(...(combination.partner_profile.negative_keywords || []));
  }

  for (const kw of allNegativeKeywords) {
    const keyword = kw.keyword.toLowerCase();
    let foundIn: string | null = null;
    let weight = kw.weight;

    if (titleText.includes(keyword)) {
      foundIn = 'title';
      weight *= TITLE_WEIGHT_MULTIPLIER;
    } else if (descriptionText.includes(keyword)) {
      foundIn = 'description';
    }

    if (foundIn) {
      negativeScore -= weight;
      matchedNegativeKeywords.push({
        keyword: kw.keyword,
        weight: kw.weight,
        found_in: foundIn,
        effective_weight: weight
      });
    }
  }

  // Step 4: CPV bonus
  let cpvScore = 0;
  const matchedCpvCodes: any[] = [];

  const allCpvCodes = [
    ...(combination.lead_profile.cpv_codes || [])
  ];
  if (combination.partner_profile) {
    allCpvCodes.push(...(combination.partner_profile.cpv_codes || []));
  }

  for (const cpv of allCpvCodes) {
    const code = cpv.cpv_code;
    if (cpvCodes.some(tenderCode => tenderCode.startsWith(code))) {
      cpvScore += cpv.weight;
      matchedCpvCodes.push({
        cpv_code: code,
        weight: cpv.weight
      });
    }
  }

  // Step 5: Synergy bonus - only if combination covers multiple distinct areas
  let synergyBonus = 0;
  if (combination.partner_profile && metMinReqs.length >= 2) {
    // Check if minimum requirements come from different profiles
    const leadMinReqs = combination.lead_profile.minimum_requirements?.map(r => r.keyword.toLowerCase()) || [];
    const partnerMinReqs = combination.partner_profile.minimum_requirements?.map(r => r.keyword.toLowerCase()) || [];
    
    const leadMatches = metMinReqs.filter(m => leadMinReqs.includes(m.keyword.toLowerCase())).length;
    const partnerMatches = metMinReqs.filter(m => partnerMinReqs.includes(m.keyword.toLowerCase())).length;
    
    if (leadMatches > 0 && partnerMatches > 0) {
      synergyBonus = 2; // Small bonus for covering multiple areas
    }
  }

  const totalScore = supportScore + negativeScore + cpvScore + synergyBonus;

  // Build explanation
  const explanationParts: string[] = [];
  
  matchedSupportKeywords.forEach(kw => {
    explanationParts.push(`${kw.keyword}(+${kw.effective_weight})`);
  });
  
  matchedNegativeKeywords.forEach(kw => {
    explanationParts.push(`${kw.keyword}(${kw.effective_weight})`);
  });
  
  if (cpvScore > 0) {
    explanationParts.push(`CPV(+${cpvScore})`);
  }
  
  if (synergyBonus > 0) {
    explanationParts.push(`synergi(+${synergyBonus})`);
  }

  const explanation = `${explanationParts.join(', ')} → ${totalScore} poeng`;

  // Save evaluation
  await supabase
    .from('tender_evaluations')
    .upsert({
      tender_id: tender.id,
      organization_id: orgId,
      combination_id: combination.id,
      combination_type: combination.type,
      lead_profile_id: combination.lead_profile.id,
      partner_profile_id: combination.partner_profile?.id || null,
      all_minimum_requirements_met: true,
      met_minimum_requirements: metMinReqs,
      missing_minimum_requirements: [],
      support_score: supportScore,
      negative_score: negativeScore,
      cpv_score: cpvScore,
      synergy_bonus: synergyBonus,
      total_score: totalScore,
      matched_support_keywords: matchedSupportKeywords,
      matched_negative_keywords: matchedNegativeKeywords,
      matched_cpv_codes: matchedCpvCodes,
      explanation: explanation
    }, {
      onConflict: 'tender_id,organization_id,combination_id'
    });
}
