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

// Maximum tenders to process per sync
const MAX_TENDERS_PER_SYNC = 500;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let syncLogId: string | null = null;
  
  try {
    console.log('Starting Doffin tender fetch...');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body to check for specific organization ID
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const specificOrgId = body.organizationId;

    // Create sync log entry
    const { data: syncLog, error: syncLogError } = await supabase
      .from('tender_sync_log')
      .insert({ status: 'running' })
      .select()
      .single();
    
    if (syncLogError) {
      console.error('Error creating sync log:', syncLogError);
    } else {
      syncLogId = syncLog.id;
    }

    // Delete old/expired tenders first (cleanup)
    console.log("Cleaning up old/expired tenders...");
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { error: cleanupError } = await supabase
      .from('tenders')
      .delete()
      .or(`deadline.lt.${oneDayAgo},created_at.lt.${sevenDaysAgo}`);
    
    if (cleanupError) {
      console.error("Error cleaning up tenders:", cleanupError);
    }

    // Fetch organizations (specific one if provided, otherwise all)
    let organizations;
    if (specificOrgId) {
      console.log(`Fetching tenders for specific organization: ${specificOrgId}`);
      const { data, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', specificOrgId)
        .single();
      
      if (orgError) {
        throw new Error(`Failed to fetch organization: ${orgError.message}`);
      }
      organizations = [data];
    } else {
      console.log("Fetching tenders for all organizations");
      const { data, error: orgError } = await supabase
        .from('organizations')
        .select('id');
      
      if (orgError) {
        throw new Error(`Failed to fetch organizations: ${orgError.message}`);
      }
      organizations = data;
    }
    
    if (!organizations || organizations.length === 0) {
      console.log('No organizations found, skipping sync');
      return new Response(
        JSON.stringify({ success: true, message: 'No organizations to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Found ${organizations.length} organizations to sync`);

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
      numHitsPerPage: '500',
      page: '1',
      sortBy: 'PUBLICATION_DATE_DESC'
    });
    
    // Add notice type filters to include all relevant categories
    params.append('noticeType', 'PIN');
    params.append('noticeType', 'QS');
    params.append('noticeType', 'CN');
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

    // Limit to MAX_TENDERS_PER_SYNC
    const limitedNotices = notices.slice(0, MAX_TENDERS_PER_SYNC);
    console.log(`Processing ${limitedNotices.length} tenders (max ${MAX_TENDERS_PER_SYNC})`);

    let totalProcessed = 0;
    let totalSaved = 0;

    // Process tenders for each organization
    for (const org of organizations) {
      console.log(`Processing tenders for org ${org.id}...`);
      let orgSavedCount = 0;

      for (const tender of limitedNotices) {
        totalProcessed++;
        
        const doffinId = tender.doffinReferenceNumber || tender.noticeId || tender.id;
        const title = tender.heading || tender.title || '';
        const body = tender.description || '';
        
        // Check if tender already exists for this organization
        const { data: existingTender } = await supabase
          .from('tenders')
          .select('id, source_updated_at')
          .eq('doffin_id', doffinId)
          .eq('org_id', org.id)
          .maybeSingle();

        // Skip if tender already exists (no updates for now)
        if (existingTender) {
          continue;
        }

        // Extract tender data
        const sourceUpdatedAt = tender.lastUpdated || tender.modifiedDate || tender.publicationDate;
        const cpvCodes = tender.cpvCodes || [];
        const client = tender.buyer?.[0]?.name || null;
        const deadline = tender.deadline || null;
        const publishedDate = tender.publicationDate || null;
        const doffinUrl = `https://doffin.no/Notice/Details/${doffinId}`;
        
        console.log(`Saving tender ${doffinId} for org ${org.id}`);
        
        // Save tender with empty matched_keywords (scoring happens client-side)
        const { error: insertError } = await supabase
          .from('tenders')
          .insert({
            doffin_id: doffinId,
            title: title,
            body: body,
            client: client,
            deadline: deadline,
            cpv_codes: cpvCodes,
            score: 0, // Will be calculated client-side
            matched_keywords: [],
            published_date: publishedDate,
            doffin_url: doffinUrl,
            org_id: org.id,
            source_updated_at: sourceUpdatedAt || new Date().toISOString()
          });

        if (insertError) {
          // Check if it's a duplicate error (race condition)
          if (insertError.code === '23505') {
            console.log(`Tender ${doffinId} already exists for org ${org.id} (race condition)`);
            continue;
          }
          console.error('Error inserting tender:', insertError);
        } else {
          orgSavedCount++;
          totalSaved++;
        }
      }
      
      console.log(`Saved ${orgSavedCount} tenders for org ${org.id}`);
    }

    console.log(`Processed ${totalProcessed} tenders, saved ${totalSaved} total across all orgs`);

    // Update last_tender_sync_at for all affected organizations
    for (const org of organizations) {
      await supabase
        .from('organizations')
        .update({ last_tender_sync_at: new Date().toISOString() })
        .eq('id', org.id);
    }

    // Update sync log
    if (syncLogId) {
      await supabase
        .from('tender_sync_log')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          fetched_count: limitedNotices.length,
          saved_count: totalSaved
        })
        .eq('id', syncLogId);
    }

    // Trigger evaluation of all tenders
    console.log('Triggering tender evaluation...');
    const evalResponse = await fetch(`${supabaseUrl}/functions/v1/evaluate-tenders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!evalResponse.ok) {
      console.error('Evaluation error:', await evalResponse.text());
    } else {
      console.log('Evaluation completed successfully');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: totalProcessed, 
        saved: totalSaved,
        organizations: organizations.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-doffin-tenders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Update sync log with error
    if (syncLogId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase
        .from('tender_sync_log')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: errorMessage
        })
        .eq('id', syncLogId);
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
