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
  type: 'solo';
  profile: Profile;
  profile_id: string;
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
    const { mode = 'incremental' } = await req.json().catch(() => ({ mode: 'incremental' }));
    console.log(`Starting tender evaluation in ${mode} mode...`);
    
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
      await evaluateOrganization(supabase, org.id, mode);
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

async function evaluateOrganization(supabase: any, orgId: string, mode: string = 'incremental') {
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

  // Evaluate both own profile (solo) and each partner profile separately
  const combinations: Combination[] = [];

  // Add solo combination (own profile only)
  combinations.push({
    id: null,
    type: 'solo',
    profile: ownProfile as any,
    profile_id: ownProfile.id
  });

  // Add each partner profile as separate evaluation (also with id: null since they're not combinations)
  const partnerProfiles = profiles.filter((p: any) => !p.is_own_profile);
  for (const partner of partnerProfiles) {
    combinations.push({
      id: null,
      type: 'solo',
      profile: partner as any,
      profile_id: partner.id
    });
  }

  console.log(`Built ${combinations.length} combinations (1 own + ${partnerProfiles.length} partners)`);

  // Fetch tenders for this org
  let { data: tenders, error: tendersError } = await supabase
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

  // Filter tenders based on mode
  if (mode === 'incremental') {
    // Get all tender IDs that already have evaluations for this org
    const { data: existingEvals } = await supabase
      .from('tender_evaluations')
      .select('tender_id')
      .eq('organization_id', orgId);
    
    const evaluatedTenderIds = new Set(existingEvals?.map((e: any) => e.tender_id) || []);
    
    // Only evaluate tenders that don't have evaluations yet
    tenders = tenders.filter((t: any) => !evaluatedTenderIds.has(t.id));
    
    console.log(`Incremental mode: ${tenders.length} new tenders to evaluate (${evaluatedTenderIds.size} already evaluated)`);
    
    if (tenders.length === 0) {
      console.log(`No new tenders to evaluate for org ${orgId}`);
      return;
    }
  } else {
    console.log(`Full mode: Evaluating all ${tenders.length} tenders`);
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

  // Get minimum requirements from the profile
  const minReqs = combination.profile.minimum_requirements || [];

  // Step 1: Qualification - check requirements
  const metMinReqs: any[] = [];
  const missingMinReqs: string[] = [];

  for (const req of minReqs) {
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

  // At least 1 minimum requirement must be met
  const allMinimumRequirementsMet = metMinReqs.length > 0;

  // If minimum requirements not met (none found), score is 0
  if (!allMinimumRequirementsMet) {
    await supabase
      .from('tender_evaluations')
      .upsert({
        tender_id: tender.id,
        organization_id: orgId,
        combination_id: combination.id,
        combination_type: combination.type,
        lead_profile_id: combination.profile_id,
        partner_profile_id: null,
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
        explanation: `Oppfyller ikke minst ett minimumskrav`
      }, {
        onConflict: 'tender_id,organization_id,combination_id'
      });
    
    return;
  }

  // Step 2: Relevance - Support keywords with weights
  // Each keyword only scores ONCE per tender, regardless of frequency
  // No title multiplier - same points for title or description
  let supportScore = 0;
  const matchedSupportKeywords: any[] = [];
  const matchedKeywordSet = new Set<string>();

  console.log(`\n--- Evaluating support keywords for tender ${tender.id.substring(0, 8)} ---`);
  console.log(`Profile has ${combination.profile.support_keywords?.length || 0} support keywords`);

  for (const kw of (combination.profile.support_keywords || [])) {
    const keyword = kw.keyword.toLowerCase();
    
    // Skip if we already scored this keyword
    if (matchedKeywordSet.has(keyword)) {
      console.log(`  Skipping duplicate keyword: "${keyword}"`);
      continue;
    }

    let foundIn: string | null = null;

    if (titleText.includes(keyword)) {
      foundIn = 'title';
    } else if (descriptionText.includes(keyword)) {
      foundIn = 'description';
    }

    if (foundIn) {
      console.log(`  ✓ Matched "${keyword}" in ${foundIn}, weight: ${kw.weight}`);
      supportScore += kw.weight;
      matchedKeywordSet.add(keyword);
      matchedSupportKeywords.push({
        keyword: kw.keyword,
        weight: kw.weight,
        found_in: foundIn,
        effective_weight: kw.weight
      });
    }
  }
  
  console.log(`Total support score: ${supportScore} from ${matchedSupportKeywords.length} unique keywords`);

  // Step 3: Negative keywords
  // Each keyword only scores ONCE per tender, regardless of frequency
  // No title multiplier - same points for title or description
  let negativeScore = 0;
  const matchedNegativeKeywords: any[] = [];
  const matchedNegativeSet = new Set<string>();

  for (const kw of (combination.profile.negative_keywords || [])) {
    const keyword = kw.keyword.toLowerCase();
    
    // Skip if we already scored this keyword
    if (matchedNegativeSet.has(keyword)) {
      continue;
    }

    let foundIn: string | null = null;

    if (titleText.includes(keyword)) {
      foundIn = 'title';
    } else if (descriptionText.includes(keyword)) {
      foundIn = 'description';
    }

    if (foundIn) {
      negativeScore += kw.weight; // weight is already negative
      matchedNegativeSet.add(keyword);
      matchedNegativeKeywords.push({
        keyword: kw.keyword,
        weight: kw.weight,
        found_in: foundIn,
        effective_weight: kw.weight
      });
    }
  }

  // Step 4: CPV bonus
  let cpvScore = 0;
  const matchedCpvCodes: any[] = [];

  for (const cpv of (combination.profile.cpv_codes || [])) {
    const code = cpv.cpv_code;
    if (cpvCodes.some(tenderCode => tenderCode.startsWith(code))) {
      cpvScore += cpv.weight;
      matchedCpvCodes.push({
        cpv_code: code,
        weight: cpv.weight
      });
    }
  }

  // No synergy bonus needed for single profile evaluations
  const synergyBonus = 0;

  // Score = ONLY support keywords + negative keywords + CPV codes + synergy bonus
  // Minimum requirements DO NOT give points, they are only a binary check
  const totalScore = supportScore + negativeScore + cpvScore + synergyBonus;

  // Build explanation showing both minimum requirements (no points) and scoring keywords
  let explanation = '';
  const parts: string[] = [];
  
  // Always show which minimum requirements were met (but no points)
  if (metMinReqs.length > 0) {
    parts.push(`Minstekrav: ${metMinReqs.map(r => r.keyword).join(', ')}`);
  }
  
  // Show scoring breakdown
  if (supportScore > 0) {
    const keywords = matchedSupportKeywords.map(k => k.keyword).join(', ');
    parts.push(`Støtteord: ${keywords} (+${supportScore})`);
  }
  if (negativeScore < 0) {
    const keywords = matchedNegativeKeywords.map(k => k.keyword).join(', ');
    parts.push(`Negative: ${keywords} (${negativeScore})`);
  }
  if (cpvScore > 0) {
    const codes = matchedCpvCodes.map(c => c.cpv_code).join(', ');
    parts.push(`CPV: ${codes} (+${cpvScore})`);
  }
  
  explanation = parts.length > 0 ? `${parts.join(' | ')} = ${totalScore} poeng` : 'Ingen treff';

  // Save evaluation (combination_id is always NULL for solo profile evaluations)
  const { error: saveError } = await supabase
    .from('tender_evaluations')
    .upsert({
      tender_id: tender.id,
      organization_id: orgId,
      combination_id: null,
      combination_type: 'solo',
      lead_profile_id: combination.profile_id,
      partner_profile_id: null,
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
      onConflict: 'tender_id,organization_id,lead_profile_id'
    });

  if (saveError) {
    console.error(`ERROR saving evaluation for profile ${combination.profile_id}:`, saveError);
  }
}
