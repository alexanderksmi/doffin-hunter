import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const doffinApiKey = Deno.env.get('DOFFIN_API_KEY');

// CPV codes to filter on
const TARGET_CPV_CODES = ['48000000', '48311000', '72200000', '72500000', '79995100'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Doffin tender fetch...');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if custom keywords were provided in request body
    const body = await req.json().catch(() => ({}));
    let keywords = body.keywords;

    // If no custom keywords provided, fetch from database (standard)
    if (!keywords || keywords.length === 0) {
      const { data: dbKeywords, error: keywordsError } = await supabase
        .from('keywords')
        .select('keyword, weight, category');

      if (keywordsError) {
        console.error('Error fetching keywords:', keywordsError);
        throw keywordsError;
      }
      
      keywords = dbKeywords;
      console.log(`Using standard keywords from database: ${keywords?.length || 0}`);
    } else {
      console.log(`Using custom keywords from request: ${keywords.length}`);
    }

    // Fetch tenders from Doffin Public API v2
    const baseUrl = 'https://api.doffin.no/public/v2/search';
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': doffinApiKey || '',
    };
    
    if (!doffinApiKey) {
      throw new Error('DOFFIN_API_KEY is not configured');
    }

    // Build search parameters
    const params = new URLSearchParams({
      numHitsPerPage: '100',
      page: '1',
      sortBy: 'PUBLICATION_DATE_DESC'
    });
    
    // Add CPV code filters
    TARGET_CPV_CODES.forEach(code => {
      params.append('cpvCode', code);
    });
    
    // Add notice type filters to include all relevant categories
    // PIN (Prior Information Notice) - Forhåndskunngjøring
    params.append('noticeType', 'PIN');
    // QS (Qualification System) - Kvalifikasjonsordning
    params.append('noticeType', 'QS');
    // CN (Contract Notice) - Kunngjøring av konkurranse
    params.append('noticeType', 'CN');
    // DPS (Dynamic Purchasing System) - Dynamisk innkjøpsordning
    params.append('noticeType', 'DPS');

    const searchUrl = `${baseUrl}?${params.toString()}`;
    console.log('Fetching tenders from Doffin API v2...');
    console.log(`URL: ${searchUrl}`);
    
    const doffinResponse = await fetch(searchUrl, { headers });
    
    console.log(`Response status: ${doffinResponse.status}`);
    
    if (!doffinResponse.ok) {
      const errorText = await doffinResponse.text();
      console.error(`API error: ${errorText}`);
      throw new Error(`Doffin API error: ${doffinResponse.status}`);
    }

    const doffinData = await doffinResponse.json();
    console.log(`Response structure:`, Object.keys(doffinData));
    
    const notices = doffinData.notices || doffinData.results || doffinData.hits || [];
    console.log(`Fetched ${notices.length} tenders from Doffin`);

    let processedCount = 0;
    let savedCount = 0;

    for (const tender of notices) {
      processedCount++;
      
      // Log first tender structure for debugging
      if (processedCount === 1) {
        console.log('First tender structure:', JSON.stringify(tender, null, 2));
        console.log('Available fields:', Object.keys(tender));
      }

      // Check if tender already exists
      const doffinId = tender.doffinReferenceNumber || tender.noticeId || tender.id;
      const { data: existingTender } = await supabase
        .from('tenders')
        .select('id')
        .eq('doffin_id', doffinId)
        .maybeSingle();

      if (existingTender) {
        continue;
      }

      // Calculate score based on keywords
      const title = tender.heading || tender.title || '';
      const body = tender.description || '';
      
      console.log(`Tender ${doffinId} - title: "${title}", body length: ${body.length}`);
      
      const searchText = `${title} ${body}`.toLowerCase();
      
      let score = 0;
      const matchedKeywords: Array<{keyword: string, weight: number, category: string}> = [];

      for (const kw of keywords || []) {
        if (searchText.includes(kw.keyword.toLowerCase())) {
          const weight = kw.category === 'negative' ? -kw.weight : kw.weight;
          score += weight;
          matchedKeywords.push({
            keyword: kw.keyword,
            weight: kw.weight,
            category: kw.category
          });
        }
      }

      // REQUIRED: Tender MUST contain at least one of these keywords
      const requiredKeywords = ['arkiv', 'arkivkjerne', 'eiendomsarkiv'];
      const hasRequiredKeyword = matchedKeywords.some(mk => 
        requiredKeywords.includes(mk.keyword.toLowerCase())
      );

      if (!hasRequiredKeyword) {
        console.log(`Tender ${doffinId} - ${matchedKeywords.length} matches but missing required keywords (arkiv/arkivkjerne/eiendomsarkiv): SKIPPING`);
        continue;
      }

      // New scoring rules (only apply if required keyword is present):
      // 1. 1 keyword match: Save only if weight >= 3
      // 2. 2 keyword matches: Save if totalScore >= 4
      // 3. 3+ keyword matches: Always save
      const numMatches = matchedKeywords.length;
      let shouldSave = false;

      if (numMatches === 1 && matchedKeywords[0].weight >= 3) {
        shouldSave = true;
        console.log(`Tender ${doffinId} - 1 match with weight ${matchedKeywords[0].weight} >= 3: SAVING`);
      } else if (numMatches === 2 && score >= 4) {
        shouldSave = true;
        console.log(`Tender ${doffinId} - 2 matches with score ${score} >= 4: SAVING`);
      } else if (numMatches >= 3) {
        shouldSave = true;
        console.log(`Tender ${doffinId} - ${numMatches} matches: SAVING`);
      } else {
        console.log(`Tender ${doffinId} - ${numMatches} matches with score ${score}: SKIPPING`);
      }

      if (shouldSave) {
        const cpvCodes = tender.cpvCodes || [];
        const client = tender.buyer?.[0]?.name || null;
        
        console.log(`Saving tender ${doffinId} - client: "${client}"`);
        
        const { error: insertError } = await supabase
          .from('tenders')
          .insert({
            doffin_id: doffinId,
            title: title,
            body: body,
            client: client,
            deadline: tender.deadline,
            cpv_codes: cpvCodes,
            score,
            matched_keywords: matchedKeywords,
            published_date: tender.publicationDate,
            doffin_url: `https://doffin.no/Notice/Details/${doffinId}`
          });

        if (insertError) {
          console.error('Error inserting tender:', insertError);
        } else {
          savedCount++;
        }
      }
    }

    console.log(`Processed ${processedCount} relevant tenders, saved ${savedCount} with score >= 3`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedCount, 
        saved: savedCount 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-doffin-tenders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
