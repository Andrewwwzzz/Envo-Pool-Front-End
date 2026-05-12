import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://api.envopoolsg.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("DEVICE_API_KEY");
  if (!apiKey) return json({ error: "Server misconfigured" }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

  // Admin-only access
  const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
    _user_id: claimsData.claims.sub,
    _role: "admin",
  });
  if (roleErr || !isAdmin) return json({ error: "Forbidden" }, 403);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { action, hardwareId, state } = body ?? {};
  if (!hardwareId || typeof hardwareId !== "string") {
    return json({ error: "hardwareId is required" }, 400);
  }

  let url: string;
  let init: RequestInit;

  if (action === "status") {
    url = `${BASE_URL}/api/device/${encodeURIComponent(hardwareId)}`;
    init = { method: "GET", headers: { "x-api-key": apiKey } };
  } else if (action === "control") {
    if (state !== "ON" && state !== "OFF") return json({ error: "state must be ON or OFF" }, 400);
    url = `${BASE_URL}/api/device-control/control/${encodeURIComponent(hardwareId)}`;
    init = {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ state }),
    };
  } else if (action === "clear") {
    url = `${BASE_URL}/api/device-control/clear/${encodeURIComponent(hardwareId)}`;
    init = {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    };
  } else {
    return json({ error: "Invalid action" }, 400);
  }

  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return json(data, res.ok ? 200 : res.status);
  } catch (err: any) {
    return json({ error: err?.message || "Upstream error" }, 502);
  }
});
