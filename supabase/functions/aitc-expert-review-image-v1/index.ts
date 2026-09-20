import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, authorization, apikey",
  "access-control-allow-methods": "POST, OPTIONS",
  "cache-control": "no-store",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: cors });

  try {
    const body = await req.json();
    const token = String(body?.token ?? "");
    const blindId = String(body?.blindId ?? "");
    if (token.length < 20 || blindId.length < 20) {
      return Response.json({ error: "INVALID_REQUEST" }, { status: 400, headers: cors });
    }

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !serviceKey) return Response.json({ error: "SERVER_CONFIG" }, { status: 500, headers: cors });

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: ref, error: refError } = await supabase.rpc("ai_thiet_chan_expert_review_image_ref_v1", {
      p_token: token,
      p_blind_id: blindId,
    });
    if (refError || !ref?.ok) return Response.json({ error: "REVIEW_ACCESS_DENIED" }, { status: 403, headers: cors });

    const path = String(ref.storagePath ?? "");
    if (!path) return Response.json({ error: "STORAGE_PATH_UNAVAILABLE" }, { status: 404, headers: cors });

    const { data, error } = await supabase.storage.from("aitc-case-images").createSignedUrl(path, 600);
    if (error || !data?.signedUrl) return Response.json({ error: "SIGNED_URL_FAILED" }, { status: 503, headers: cors });

    return Response.json({ ok: true, kind: "signed", url: data.signedUrl, expiresIn: 600 }, { headers: cors });
  } catch {
    return Response.json({ error: "BAD_REQUEST" }, { status: 400, headers: cors });
  }
});