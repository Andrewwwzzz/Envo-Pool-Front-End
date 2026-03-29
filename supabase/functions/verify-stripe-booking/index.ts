import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the user's JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { session_id } = await req.json();
    if (!session_id || typeof session_id !== "string") {
      return new Response(JSON.stringify({ error: "Missing session_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify with external payment API
    const verifyRes = await fetch(
      `https://api.envopoolsg.com/api/payments/verify-session?session_id=${encodeURIComponent(session_id)}`
    );

    if (!verifyRes.ok) {
      return new Response(
        JSON.stringify({ status: "retry", message: "Payment API unavailable" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paymentData = await verifyRes.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (paymentData.status === "confirmed") {
      // Only confirm the specific booking tied to this session_id
      const { data: pendingBookings } = await supabase
        .from("bookings")
        .select("id, final_price")
        .eq("user_id", user.id)
        .eq("payment_method", "stripe")
        .eq("status", "pending")
        .eq("stripe_session_id", session_id)
        .limit(1);

      if (pendingBookings && pendingBookings.length > 0) {
        const booking = pendingBookings[0];
        const { error: updateErr } = await supabase
          .from("bookings")
          .update({ status: "confirmed" })
          .eq("id", booking.id)
          .eq("status", "pending");

        if (!updateErr && booking.final_price > 0) {
          const earnedPoints = Math.floor(booking.final_price);
          if (earnedPoints > 0) {
            await supabase.from("reward_transactions").insert({
              user_id: user.id,
              type: "earn",
              points: earnedPoints,
              related_booking_id: booking.id,
            });

            const { data: profile } = await supabase
              .from("profiles")
              .select("reward_points, total_spent")
              .eq("user_id", user.id)
              .single();

            if (profile) {
              await supabase
                .from("profiles")
                .update({
                  reward_points: (profile.reward_points || 0) + earnedPoints,
                  total_spent:
                    (profile.total_spent || 0) + booking.final_price,
                })
                .eq("user_id", user.id);
            }
          }
        }
      }

      return new Response(JSON.stringify({ status: "confirmed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (paymentData.status === "expired") {
      // Mark only the specific booking tied to this session as expired
      await supabase
        .from("bookings")
        .update({ status: "expired" })
        .eq("user_id", user.id)
        .eq("payment_method", "stripe")
        .eq("status", "pending")
        .eq("stripe_session_id", session_id);

      return new Response(JSON.stringify({ status: "expired" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Processing or unknown — client should retry
    return new Response(
      JSON.stringify({ status: paymentData.status || "processing" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
