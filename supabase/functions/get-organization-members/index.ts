import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { organizationId } = await req.json();

    if (!organizationId) {
      return new Response(JSON.stringify({ error: "Organization ID required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get all user roles for the organization
    const { data: roles, error: rolesError } = await supabaseClient
      .from("user_roles")
      .select("id, user_id, role")
      .eq("organization_id", organizationId);

    if (rolesError) throw rolesError;

    // Get user emails using admin API
    const membersWithEmails = await Promise.all(
      (roles || []).map(async (role) => {
        const { data: userData, error: emailError } = await supabaseClient.auth.admin.getUserById(role.user_id);
        
        return {
          id: role.id,
          user_id: role.user_id,
          role: role.role,
          email: userData?.user?.email || "Ukjent bruker",
        };
      })
    );

    return new Response(JSON.stringify({ members: membersWithEmails }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
