import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = Deno.env.get("ALLOWED_ORIGINS")?.split(",").map((o) => o.trim()) || [];
const BUCKET = "stylepack-ref";

type ErrorCode = "INVALID_BODY" | "AT_LEAST_3_IMAGES" | "SIGNED_URL_ERROR" | "FETCH_SOURCE_FAILED" | "INTERNAL";

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : ["*"];
  let isAllowed = false;
  if (origin) {
    isAllowed = allowedOrigins.some((allowed) => {
      if (allowed === "*") return true;
      if (allowed === origin) return true;
      if (allowed.includes("*")) return origin.includes(allowed.replace("https://*.", ""));
      return false;
    });
  }
  return {
    "Access-Control-Allow-Origin": isAllowed && origin ? origin : "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-request-id, x-client-info, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function respond({ status = 200, requestId, corsHeaders, body }: any) {
  return new Response(JSON.stringify({ requestId, error: null, message: "OK", ...body }), 
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function respondError({ status = 500, requestId, corsHeaders, code, message, extra = {} }: any) {
  return new Response(JSON.stringify({ requestId, error: code, message, ...extra }), 
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return respondError({ status: 405, requestId, corsHeaders, code: "INVALID_BODY", message: "Only POST is supported" });

  try {
    const payload = await req.json();
    const imagePaths: string[] = Array.isArray(payload?.imagePaths) ? payload.imagePaths : [];
    const stylepackId = payload.stylepackId;

    if (!imagePaths.length) return respondError({ status: 400, requestId, corsHeaders, code: "INVALID_BODY", message: "imagePaths required" });
    if (imagePaths.length < 3) return respondError({ status: 400, requestId, corsHeaders, code: "AT_LEAST_3_IMAGES", message: "At least 3 images required" });
    if (!stylepackId) return respondError({ status: 400, requestId, corsHeaders, code: "INVALID_BODY", message: "stylepackId required" });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    
    const signedUrls: string[] = [];
    for (const p of imagePaths) {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(p, 600);
      if (error || !data?.signedUrl) return respondError({ status: 500, requestId, corsHeaders, code: "SIGNED_URL_ERROR", message: `Failed URL for ${p}` });
      signedUrls.push(data.signedUrl);
    }

    const messages: any[] = [
      { role: "system", content: "Return only valid JSON." },
      { role: "user", content: 'Extract: {"palette": [{"hex":"#FFF","ratio":0.3}], "textures": ["smooth"], "density": "mid"}' },
      ...signedUrls.slice(0, 5).map(url => ({ role: "user", content: [{ type: "image_url", image_url: { url } }] }))
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, response_format: { type: "json_object" } }),
    });

    if (!aiResp.ok) return respondError({ status: 500, requestId, corsHeaders, code: "INTERNAL", message: "AI error" });

    const completion = await aiResp.json();
    let raw = completion.choices?.[0]?.message?.content;
    if (typeof raw === "string") raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const palette = Array.isArray(parsed?.palette) ? parsed.palette : [];
    const textures = Array.isArray(parsed?.textures) ? parsed.textures : [];
    const density = parsed?.density || "mid";

    // Update stylepack_ref_images with analysis
    for (const imagePath of imagePaths) {
      const fileName = imagePath.split('/').pop();
      if (fileName) {
        await supabase.from('stylepack_ref_images').update({
          palette, texture_tags: textures, density,
          meta: { analyzed_at: new Date().toISOString(), request_id: requestId }
        }).eq('stylepack_id', stylepackId).ilike('key', `%${fileName}%`);
      }
    }

    // Update stylepacks.reference_stats
    await supabase.from('stylepacks').update({
      reference_stats: { palette_colors: palette, common_textures: textures, avg_density: density, analyzed_count: imagePaths.length, last_analyzed: new Date().toISOString() }
    }).eq('id', stylepackId);

    return respond({ status: 200, requestId, corsHeaders, body: { palette, textures, density } });
  } catch (err: any) {
    return respondError({ status: 500, requestId, corsHeaders, code: "INTERNAL", message: err.message || "Error" });
  }
});
