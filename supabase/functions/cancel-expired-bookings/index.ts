import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate: require valid Authorization header with service role or anon key
    const authHeader = req.headers.get("Authorization");
    const expectedKey = Deno.env.get("CRON_SECRET");
    if (!expectedKey || !authHeader || !authHeader.startsWith("Bearer ") || authHeader.replace("Bearer ", "") !== expectedKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete bookings that have been pending for more than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // First get the IDs to report count
    const { data: expired, error: fetchErr } = await supabase
      .from("bookings")
      .select("id")
      .eq("status", "pending")
      .lt("created_at", fiveMinutesAgo);

    if (fetchErr) throw fetchErr;

    if (expired && expired.length > 0) {
      const ids = expired.map((b) => b.id);

      // Delete related promo_usage first (foreign key)
      await supabase
        .from("promo_usage")
        .delete()
        .in("booking_id", ids);

      // Delete the expired bookings
      const { error } = await supabase
        .from("bookings")
        .delete()
        .in("id", ids);

      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ deleted: expired?.length ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
