import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS origin whitelist from secret (comma-separated). Fallback to *
const ALLOWED_ORIGINS = Deno.env.get("ALLOWED_ORIGINS")?.split(",").map((o) => o.trim()) || [];

const BUCKET = "stylepack-ref"; // Storage bucket for stylepack references (can be private)

type ErrorCode =
  | "INVALID_BODY"
  | "AT_LEAST_3_IMAGES"
  | "SIGNED_URL_ERROR"
  | "FETCH_SOURCE_FAILED"
  | "INTERNAL";

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : ["*"];
  let isAllowed = false;
  if (origin) {
    isAllowed = allowedOrigins.some((allowed) => {
      if (allowed === "*") return true;
      if (allowed === origin) return true;
      if (allowed.includes("*")) {
        const pattern = allowed.replace("https://*.", "");
        return origin.includes(pattern);
      }
      return false;
    });
  }
  const allowOrigin = isAllowed && origin ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, content-type, x-request-id, x-client-info, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function respond({
  status = 200,
  requestId,
  corsHeaders,
  body,
}: {
  status?: number;
  requestId: string;
  corsHeaders: Record<string, string>;
  body: Record<string, unknown> & { requestId?: string };
}) {
  return new Response(
    JSON.stringify({ requestId, error: null, message: "OK", ...body }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function respondError({
  status = 500,
  requestId,
  corsHeaders,
  code,
  message,
  extra = {},
}: {
  status?: number;
  requestId: string;
  corsHeaders: Record<string, string>;
  code: ErrorCode;
  message: string;
  extra?: Record<string, unknown>;
}) {
  return new Response(
    JSON.stringify({ requestId, error: code, message, ...extra }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const corsHeaders = getCorsHeaders(origin);

  console.log(`[stylepack-analyze] [${requestId}] ${req.method} from ${origin}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respondError({
      status: 405,
      requestId,
      corsHeaders,
      code: "INVALID_BODY",
      message: "Only POST is supported",
    });
  }

  try {
    let payload: any = {};
    try {
      payload = await req.json();
    } catch (e) {
      console.error(`[stylepack-analyze] [${requestId}] JSON parse error`, e);
      return respondError({
        status: 400,
        requestId,
        corsHeaders,
        code: "INVALID_BODY",
        message: "Request body must be JSON { imagePaths: string[] }",
      });
    }

    const imagePaths: string[] = Array.isArray(payload?.imagePaths)
      ? payload.imagePaths
      : [];

    if (imagePaths.length === 0) {
      return respondError({
        status: 400,
        requestId,
        corsHeaders,
        code: "INVALID_BODY",
        message: "imagePaths array required",
      });
    }

    if (imagePaths.length < 3) {
      return respondError({
        status: 400,
        requestId,
        corsHeaders,
        code: "AT_LEAST_3_IMAGES",
        message: "Provide at least 3 images for analysis",
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      console.error("Missing Supabase envs");
      return respondError({
        status: 500,
        requestId,
        corsHeaders,
        code: "INTERNAL",
        message: "Server configuration error",
      });
    }

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return respondError({
        status: 500,
        requestId,
        corsHeaders,
        code: "INTERNAL",
        message: "AI gateway is not configured",
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    console.log(`[stylepack-analyze] [${requestId}] images: ${imagePaths.length}`);

    // Create signed GET URLs and validate reachability with a light range request
    const signedUrls: string[] = [];
    for (const p of imagePaths) {
      console.log(`[stylepack-analyze] [${requestId}] signing: ${BUCKET}/${p}`);
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(p, 600);
      if (error || !data?.signedUrl) {
        console.error(`[stylepack-analyze] [${requestId}] sign error`, error);
        return respondError({
          status: 500,
          requestId,
          corsHeaders,
          code: "SIGNED_URL_ERROR",
          message: `Failed to create signed URL for ${p}`,
        });
      }

      // Fetch a small byte range to make sure the URL is valid and accessible
      const headResp = await fetch(data.signedUrl, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
      });
      if (!headResp.ok) {
        console.error(
          `[stylepack-analyze] [${requestId}] fetch failed for ${p}: ${headResp.status}`
        );
        return respondError({
          status: headResp.status,
          requestId,
          corsHeaders,
          code: "FETCH_SOURCE_FAILED",
          message: `Could not fetch ${p}`,
        });
      }

      signedUrls.push(data.signedUrl);
    }

    const analysisPrompt = `Analyze these cake reference images and extract two fields strictly:
- palette: array of distinct dominant colors as hex strings like "#FFFFFF" (5-7 values)
- textures: array of short technique/style descriptors like "rosette", "metallic", "fondant"
Return ONLY valid JSON with schema: { "palette": string[], "textures": string[] }`;

    const messages: any[] = [
      { role: "system", content: "You are a cake design analysis expert. Return only valid JSON." },
      { role: "user", content: analysisPrompt },
    ];

    for (const url of signedUrls.slice(0, 5)) {
      messages.push({
        role: "user",
        content: [{ type: "image_url", image_url: { url } }],
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error(`[stylepack-analyze] [${requestId}] AI error ${aiResp.status}:`, t);
      return respondError({
        status: aiResp.status,
        requestId,
        corsHeaders,
        code: "INTERNAL",
        message: "AI gateway error",
        extra: { details: t },
      });
    }

    const completion = await aiResp.json();
    let raw = completion.choices?.[0]?.message?.content;

    console.log(`[stylepack-analyze] [${requestId}] Raw AI response (first 200 chars):`, 
      typeof raw === "string" ? raw.substring(0, 200) : raw);

    // Remove Markdown code blocks (```json ... ``` or ``` ... ```)
    if (typeof raw === "string") {
      raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      console.log(`[stylepack-analyze] [${requestId}] After removing markdown (first 200 chars):`, 
        raw.substring(0, 200));
    }

    let parsed: any;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      console.log(`[stylepack-analyze] [${requestId}] Successfully parsed JSON`);
    } catch (e) {
      console.error(`[stylepack-analyze] [${requestId}] JSON parse failed`, e);
      console.error(`[stylepack-analyze] [${requestId}] Raw value:`, raw);
      return respondError({
        status: 500,
        requestId,
        corsHeaders,
        code: "INTERNAL",
        message: "Failed to parse AI output",
      });
    }

    // Handle array response (multiple image analyses) or single object
    let palette: string[] = [];
    let textures: string[] = [];

    if (Array.isArray(parsed)) {
      console.log(`[stylepack-analyze] [${requestId}] Got array of ${parsed.length} image analyses`);
      
      // Merge all palettes and textures from multiple image analyses
      const allPalettes: string[] = [];
      const allTextures: string[] = [];
      
      for (const item of parsed) {
        if (Array.isArray(item?.palette)) {
          allPalettes.push(...item.palette
            .map((c: any) => typeof c === "string" ? c.trim().toUpperCase() : c?.hex?.trim().toUpperCase())
            .filter(Boolean)
          );
        }
        if (Array.isArray(item?.textures)) {
          allTextures.push(...item.textures
            .filter((t: any) => typeof t === "string")
            .map((t: string) => t.trim())
          );
        }
      }
      
      // Remove duplicates
      palette = [...new Set(allPalettes)];
      textures = [...new Set(allTextures)];
      
      console.log(`[stylepack-analyze] [${requestId}] Merged: ${palette.length} colors, ${textures.length} textures`);
    } else {
      // Single object response
      palette = Array.isArray(parsed?.palette)
        ? parsed.palette
            .map((c: any) => (typeof c === "string" ? c : c?.hex))
            .filter((v: any) => typeof v === "string")
            .map((v: string) => v.trim().toUpperCase())
        : [];

      textures = Array.isArray(parsed?.textures)
        ? parsed.textures.filter((t: any) => typeof t === "string").map((t: string) => t.trim())
        : [];
    }

    console.log(
      `[stylepack-analyze] [${requestId}] analysis done palette=${palette.length} textures=${textures.length}`
    );

    return respond({ requestId, corsHeaders, status: 200, body: { palette, textures } });
  } catch (e) {
    console.error(`[stylepack-analyze] [${requestId}] fatal`, e);
    return respondError({
      status: 500,
      requestId,
      corsHeaders,
      code: "INTERNAL",
      message: e instanceof Error ? e.message : "Unknown error",
    });
  }
});
