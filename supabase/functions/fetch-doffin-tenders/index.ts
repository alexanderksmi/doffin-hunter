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

    // Fetch keywords from database
    const { data: keywords, error: keywordsError } = await supabase
      .from('keywords')
      .select('keyword, weight, category');

    if (keywordsError) {
      console.error('Error fetching keywords:', keywordsError);
      throw keywordsError;
    }

    console.log(`Fetched ${keywords?.length || 0} keywords`);

    // Fetch tenders from Doffin Public API v2
    const doffinUrl = 'https://api.doffin.no/public/v2/search';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (doffinApiKey) {
      headers['Ocp-Apim-Subscription-Key'] = doffinApiKey;
    } else {
      throw new Error('DOFFIN_API_KEY is not configured');
    }

    // Search parameters - get recent notices
    const searchParams = new URLSearchParams({
      limit: '100',
      sortOrder: 'desc',
      sortBy: 'publishedDate'
    });

    console.log('Fetching tenders from Doffin API v2...');
    console.log(`Request URL: ${doffinUrl}?${searchParams}`);
    const doffinResponse = await fetch(`${doffinUrl}?${searchParams}`, { headers });
    
    console.log(`Response status: ${doffinResponse.status}`);
    
    if (!doffinResponse.ok) {
      const errorText = await doffinResponse.text();
      console.error(`API error response: ${errorText}`);
      throw new Error(`Doffin API error: ${doffinResponse.status} - ${errorText}`);
    }

    const doffinData = await doffinResponse.json();
    console.log(`Response data:`, JSON.stringify(doffinData).substring(0, 500));
    
    const notices = Array.isArray(doffinData) ? doffinData : (doffinData.notices || doffinData.results || []);
    console.log(`Fetched ${notices.length} tenders from Doffin`);

    let processedCount = 0;
    let savedCount = 0;

    for (const tender of notices) {
      // Hard filter on CPV codes
      const tenderCpvCodes = tender.cpv_codes || [];
      const hasMatchingCpv = tenderCpvCodes.some((code: string) => 
        TARGET_CPV_CODES.some(targetCode => code.startsWith(targetCode))
      );

      if (!hasMatchingCpv) {
        continue;
      }

      processedCount++;

      // Check if tender already exists
      const { data: existingTender } = await supabase
        .from('tenders')
        .select('id')
        .eq('doffin_id', tender.notice_id)
        .maybeSingle();

      if (existingTender) {
        continue; // Skip already processed tenders
      }

      // Calculate score based on keywords
      const title = tender.title || '';
      const body = tender.description || '';
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

      // Only save tenders with score >= 3
      if (score >= 3) {
        const { error: insertError } = await supabase
          .from('tenders')
          .insert({
            doffin_id: tender.notice_id,
            title: tender.title,
            body: tender.description,
            client: tender.authority_name,
            deadline: tender.deadline,
            cpv_codes: tenderCpvCodes,
            score,
            matched_keywords: matchedKeywords,
            published_date: tender.published_date,
            doffin_url: `https://doffin.no/Notice/Details/${tender.notice_id}`
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
