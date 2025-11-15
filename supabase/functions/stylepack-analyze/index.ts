import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hexToOKLab } from '../_shared/color-utils.ts';

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

    const imageMessages = signedUrls.slice(0, 5).map(url => ({ 
      type: "image_url", 
      image_url: { url } 
    }));

    const messages: any[] = [
      { 
        role: "system", 
        content: "You are a cake design analyzer. Analyze the provided cake images and extract color palette, textures, and decoration density. Return ONLY valid JSON with the exact structure specified." 
      },
      { 
        role: "user", 
        content: [
          {
            type: "text",
            text: `Analyze these ${signedUrls.length} cake images and extract:
1. Color Palette: Identify 3-7 dominant colors with their hex codes and approximate ratios (must sum to ~1.0)
2. Textures: List texture types seen (e.g., "smooth fondant", "textured buttercream", "ruffled", "piped details", "fresh flowers")
3. Density: Overall decoration density - MUST be exactly one of: "low" (minimal/clean), "mid" (moderate), or "high" (elaborate/heavily decorated)

Return ONLY this JSON structure (no markdown, no explanations):
{
  "palette": [
    {"hex": "#FFFFFF", "ratio": 0.5},
    {"hex": "#F5E6D3", "ratio": 0.3},
    {"hex": "#C4A57B", "ratio": 0.2}
  ],
  "textures": ["smooth fondant", "fresh flowers", "gold accents"],
  "density": "mid"
}

CRITICAL: density MUST be exactly "low", "mid", or "high" - no other values allowed.`
          },
          ...imageMessages
        ]
      }
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, response_format: { type: "json_object" } }),
    });

    if (!aiResp.ok) return respondError({ status: 500, requestId, corsHeaders, code: "INTERNAL", message: "AI error" });

    const completion = await aiResp.json();
    let raw = completion.choices?.[0]?.message?.content;
    console.log('[AI Response]:', raw);
    
    if (typeof raw === "string") {
      raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    }
    
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    console.log('[Parsed]:', JSON.stringify(parsed, null, 2));
    
    const palette = Array.isArray(parsed?.palette) && parsed.palette.length > 0 ? parsed.palette : [];
    const textures = Array.isArray(parsed?.textures) && parsed.textures.length > 0 ? parsed.textures : [];
    
    // Normalize density to match CHECK constraint (low, mid, high)
    let rawDensity = (parsed?.density || "mid").toLowerCase();
    let density = "mid";
    if (rawDensity.includes("low") || rawDensity.includes("minimal") || rawDensity.includes("sparse")) {
      density = "low";
    } else if (rawDensity.includes("high") || rawDensity.includes("elaborate") || rawDensity.includes("dense") || rawDensity.includes("heavy")) {
      density = "high";
    } else if (rawDensity.includes("mid") || rawDensity.includes("medium") || rawDensity.includes("moderate")) {
      density = "mid";
    }
    
    console.log(`[Extracted] Palette: ${palette.length} colors, Textures: ${textures.length} items, Density: ${density}`);

    // Phase 4: Generate embeddings and upsert to stylepack_ref_images with error tracking
    const errors: Array<{ imagePath: string; error: string }> = [];
    let successCount = 0;
    
    for (const imagePath of imagePaths) {
      const fileName = imagePath.split('/').pop();
      
      try {
        if (fileName) {
          // Get public URL for embedding generation
          const publicUrl = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/${BUCKET}/${imagePath}`;
          
          // Generate IMAGE-based embedding using the actual image
          let embedding = null;
          let description = null;
          try {
            const embeddingResponse = await supabase.functions.invoke('generate-embeddings', {
              body: { 
                imageUrl: publicUrl,
                type: 'image'
              }
            });
            
            if (embeddingResponse.data?.embedding) {
              embedding = embeddingResponse.data.embedding;
              description = embeddingResponse.data.description;
              console.log(`✅ Generated IMAGE embedding (${embedding.length}D) for ${fileName}`);
            }
          } catch (embError) {
            console.error('Failed to generate image embedding for', fileName, embError);
            // Continue without embedding - not critical
          }

          // Convert palette to include ratios AND OKLab coordinates
          const paletteWithRatios = palette.map((item: any) => {
            const hexValue = typeof item === 'string' ? item : item.hex;
            const ratio = typeof item === 'string' ? parseFloat((1 / palette.length).toFixed(3)) : item.ratio;
            
            try {
              const oklabCoords = hexToOKLab(hexValue);
              return { 
                hex: hexValue, 
                ratio: ratio,
                oklab: oklabCoords
              };
            } catch (e) {
              console.warn(`Failed to convert ${hexValue} to OKLab:`, e);
              return { hex: hexValue, ratio: ratio };
            }
          });

          // Phase 4.1: UPSERT stylepack_ref_images with analysis results
          const { error: upsertError } = await supabase
            .from('stylepack_ref_images')
            .upsert({
              stylepack_id: stylepackId,
              key: imagePath,
              url: publicUrl,
              palette: paletteWithRatios,
              texture_tags: textures,
              density,
              embedding: embedding,
              meta: { 
                analyzed_at: new Date().toISOString(), 
                request_id: requestId,
                description: description
              },
              mime: imagePath.endsWith('.png') ? 'image/png' : 
                    imagePath.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
              size_bytes: 0,
              uploaded_by: null
            }, {
              onConflict: 'stylepack_id,key'
            });

          if (upsertError) {
            throw new Error(`UPSERT failed: ${upsertError.message}`);
          }

          successCount++;
          console.log(`[${requestId}] ✓ Upserted stylepack_ref_images for ${imagePath} (${successCount}/${imagePaths.length})`);
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Unknown error';
        errors.push({ imagePath, error: errorMessage });
        console.error(`[${requestId}] ❌ Failed to process ${imagePath}:`, errorMessage);
      }
    }

    // Update stylepacks.reference_stats with actual success count
    await supabase.from('stylepacks').update({
      reference_stats: { 
        palette_colors: palette, 
        common_textures: textures, 
        avg_density: density, 
        analyzed_count: successCount, 
        last_analyzed: new Date().toISOString() 
      }
    }).eq('id', stylepackId);

    // Return response with success/error info (Phase 4.1)
    if (errors.length > 0) {
      console.warn(`[${requestId}] ⚠️ Partial success: ${successCount}/${imagePaths.length} images processed`);
      return respond({ 
        status: 200, 
        requestId, 
        corsHeaders, 
        body: { 
          success: successCount > 0,
          palette, 
          textures, 
          density,
          processed: successCount,
          total: imagePaths.length,
          errors: errors
        } 
      });
    }

    console.log(`[${requestId}] ✅ All ${successCount} images processed successfully`);
    return respond({ 
      status: 200, 
      requestId, 
      corsHeaders, 
      body: { 
        success: true,
        palette, 
        textures, 
        density,
        processed: successCount,
        total: imagePaths.length
      } 
    });
  } catch (err: any) {
    return respondError({ status: 500, requestId, corsHeaders, code: "INTERNAL", message: err.message || "Error" });
  }
});
