import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOOP_INTERVAL_MS = 3000; // Check for jobs every 3 seconds
const MAX_LOOP_DURATION_MS = 50000; // Run for max 50 seconds (edge function limit is 60s)

interface Job {
  job_id: string;
  organization_id: string;
  affected_profile_ids: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🚀 Evaluation worker started');

  try {
    const startTime = Date.now();
    let processedJobs = 0;

    // Self-running loop: process jobs until timeout or no more jobs
    while (Date.now() - startTime < MAX_LOOP_DURATION_MS) {
      const job = await claimNextJob(supabase);
      
      if (!job) {
        console.log('📭 No pending jobs. Waiting...');
        await sleep(LOOP_INTERVAL_MS);
        continue;
      }

      console.log(`📦 Processing job ${job.job_id} for org ${job.organization_id}`);
      
      try {
        // Broadcast evaluation_started event
        await broadcastEvent(supabase, job.organization_id, {
          type: 'evaluation_started',
          job_id: job.job_id,
          organization_id: job.organization_id,
          affected_profile_ids: job.affected_profile_ids,
          timestamp: new Date().toISOString(),
        });

        // Execute set-based evaluation with automatic cleanup
        const stats = await processJob(supabase, job);

        // Mark job as completed
        await markJobCompleted(supabase, job.job_id);

        // Broadcast evaluation_done event WITH STATISTICS
        await broadcastEvent(supabase, job.organization_id, {
          type: 'evaluation_done',
          job_id: job.job_id,
          organization_id: job.organization_id,
          affected_profile_ids: job.affected_profile_ids,
          upserted_count: stats?.upserted || 0,
          pruned_count: stats?.pruned || 0,
          timestamp: new Date().toISOString(),
        });

        processedJobs++;
        console.log(`✅ Job ${job.job_id} completed (${stats?.upserted || 0} upserted, ${stats?.pruned || 0} pruned)`);

      } catch (error) {
        console.error(`❌ Job ${job.job_id} failed:`, error);
        await handleJobError(supabase, job.job_id, error);
      }
    }

    console.log(`🏁 Worker finished. Processed ${processedJobs} jobs in ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed_jobs: processedJobs,
        runtime_ms: Date.now() - startTime
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('💥 Worker fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

// Claim next pending job atomically
async function claimNextJob(supabase: any): Promise<Job | null> {
  const { data, error } = await supabase.rpc('claim_next_evaluation_job');

  if (error) {
    console.error('Error claiming job:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return {
    job_id: data[0].job_id,
    organization_id: data[0].organization_id,
    affected_profile_ids: data[0].affected_profile_ids,
  };
}

// Process job: run set-based evaluation and upsert results with automatic cleanup
async function processJob(supabase: any, job: Job) {
  console.log(`🔍 Evaluating tenders for ${job.affected_profile_ids.length} profiles`);

  // Call set-based evaluation function (now includes criteria_fingerprint)
  const { data: evaluations, error: evalError } = await supabase.rpc(
    'evaluate_tenders_batch',
    {
      _org_id: job.organization_id,
      _profile_ids: job.affected_profile_ids,
    }
  );

  if (evalError) {
    throw new Error(`Evaluation failed: ${evalError.message}`);
  }

  console.log(`📊 Found ${evaluations?.length || 0} qualified tenders`);

  // Group evaluations by profile for batch upsert + cleanup
  const profileGroups = new Map<string, { results: any[], fingerprint: string }>();
  
  for (const eval_result of evaluations || []) {
    const profileId = eval_result.profile_id;
    const fingerprint = eval_result.criteria_fingerprint;
    
    if (!profileGroups.has(profileId)) {
      profileGroups.set(profileId, { results: [], fingerprint });
    }
    profileGroups.get(profileId)!.results.push(eval_result);
  }

  // Track statistics for realtime event
  let totalUpserted = 0;
  let totalPruned = 0;

  // Batch upsert + cleanup results per profile in single transaction
  for (const [profileId, { results, fingerprint }] of profileGroups) {
    const formattedResults = results.map(r => ({
      tender_id: r.tender_id,
      total_score: r.total_score,
      matched_keywords: r.matched_keywords,
    }));

    const { data: stats, error: upsertError } = await supabase.rpc(
      'upsert_evaluation_results_with_cleanup',
      {
        _org_id: job.organization_id,
        _profile_id: profileId,
        _combination_type: 'solo',
        _results: formattedResults,
        _criteria_fingerprint: fingerprint,
      }
    );

    if (upsertError) {
      throw new Error(`Upsert+cleanup failed for profile ${profileId}: ${upsertError.message}`);
    }

    if (stats && stats.length > 0) {
      totalUpserted += stats[0].upserted_count || 0;
      totalPruned += stats[0].pruned_count || 0;
    }
  }

  // Also cleanup profiles that now have ZERO matches (fingerprint changed, no new matches)
  for (const profileId of job.affected_profile_ids) {
    if (!profileGroups.has(profileId)) {
      // This profile has no matches anymore - cleanup all its old evaluations
      const { data: stats, error: cleanupError } = await supabase.rpc(
        'upsert_evaluation_results_with_cleanup',
        {
          _org_id: job.organization_id,
          _profile_id: profileId,
          _combination_type: 'solo',
          _results: [],  // Empty result set
          _criteria_fingerprint: 'no-matches',  // Different fingerprint triggers cleanup
        }
      );

      if (cleanupError) {
        console.error(`Cleanup failed for profile ${profileId}:`, cleanupError);
      } else if (stats && stats.length > 0) {
        totalPruned += stats[0].pruned_count || 0;
      }
    }
  }

  console.log(`💾 Upserted ${totalUpserted}, pruned ${totalPruned} evaluations`);
  return { upserted: totalUpserted, pruned: totalPruned };
}

// Mark job as completed
async function markJobCompleted(supabase: any, jobId: string) {
  const { error } = await supabase
    .from('evaluation_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error('Error marking job completed:', error);
    throw error;
  }
}

// Handle job error with exponential backoff
async function handleJobError(supabase: any, jobId: string, error: any) {
  // Fetch current retry count
  const { data: job, error: fetchError } = await supabase
    .from('evaluation_jobs')
    .select('retry_count, max_retries')
    .eq('id', jobId)
    .single();

  if (fetchError) {
    console.error('Error fetching job for retry:', fetchError);
    return;
  }

  const retryCount = (job?.retry_count || 0) + 1;
  const maxRetries = job?.max_retries || 5;

  if (retryCount > maxRetries) {
    // Dead letter: permanent failure
    console.error(`☠️ Job ${jobId} exceeded max retries. Moving to dead_letter.`);
    await supabase
      .from('evaluation_jobs')
      .update({
        status: 'dead_letter',
        error_message: error instanceof Error ? error.message : String(error),
        error_code: 'MAX_RETRIES_EXCEEDED',
        retry_count: retryCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  } else {
    // Exponential backoff: 2^retryCount seconds
    const backoffSeconds = Math.pow(2, retryCount);
    const runNotBefore = new Date(Date.now() + backoffSeconds * 1000).toISOString();

    console.warn(`🔄 Job ${jobId} failed. Retry ${retryCount}/${maxRetries}. Next run: ${runNotBefore}`);

    await supabase
      .from('evaluation_jobs')
      .update({
        status: 'pending',
        error_message: error instanceof Error ? error.message : String(error),
        error_code: getErrorCode(error),
        retry_count: retryCount,
        run_not_before: runNotBefore,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}

// Extract error code from error
function getErrorCode(error: any): string {
  if (error?.code) return error.code;
  if (error?.message?.includes('tsquery')) return 'TSQUERY_PARSE_ERROR';
  if (error?.message?.includes('RLS')) return 'RLS_DENIED';
  if (error?.message?.includes('timeout')) return 'TIMEOUT';
  return 'UNKNOWN_ERROR';
}

// Broadcast realtime event to organization channel
async function broadcastEvent(supabase: any, orgId: string, payload: any) {
  try {
    const channel = supabase.channel(`eval:${orgId}`);
    await channel.send({
      type: 'broadcast',
      event: payload.type,
      payload,
    });
    console.log(`📡 Broadcasted ${payload.type} to eval:${orgId}`);
  } catch (error) {
    console.error('Error broadcasting event:', error);
    // Non-fatal: don't throw
  }
}

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
