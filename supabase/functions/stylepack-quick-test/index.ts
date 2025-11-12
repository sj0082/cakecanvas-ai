import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { referenceImagePath, stylePackName, params, lockSeed } = await req.json();

    console.log(`[stylepack-quick-test] [${requestId}] Request:`, {
      referenceImagePath,
      stylePackName,
      params,
      lockSeed
    });

    if (!referenceImagePath) {
      return new Response(
        JSON.stringify({ error: 'referenceImagePath is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get signed URL for reference image
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('stylepack-ref')
      .createSignedUrl(referenceImagePath, 300);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error(`[stylepack-quick-test] [${requestId}] Signed URL error:`, signedUrlError);
      return new Response(
        JSON.stringify({ error: 'Failed to get reference image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[stylepack-quick-test] [${requestId}] Got signed URL for reference image`);

    // Generate AI image
    const prompt = `Create a beautiful ${stylePackName || 'wedding'} cake with these visual characteristics. Maintain the style, colors, and decorative elements from the reference image. The cake should be elegant, realistic, and professionally photographed.`;

    console.log(`[stylepack-quick-test] [${requestId}] Calling AI with prompt: ${prompt.substring(0, 100)}...`);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: signedUrlData.signedUrl }
              }
            ]
          }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!aiResp.ok) {
      const errorText = await aiResp.text();
      console.error(`[stylepack-quick-test] [${requestId}] AI error:`, aiResp.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI generation failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const completion = await aiResp.json();
    const generatedImageBase64 = completion.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImageBase64) {
      console.error(`[stylepack-quick-test] [${requestId}] No image in AI response`);
      return new Response(
        JSON.stringify({ error: 'No image generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[stylepack-quick-test] [${requestId}] AI image generated, uploading to storage...`);

    // Extract base64 data (remove data:image/png;base64, prefix)
    const base64Data = generatedImageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Upload to storage
    const timestamp = Date.now();
    const fileName = `test-${timestamp}.jpg`;
    const uploadPath = `stylepack-tests/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('cake-inspiration')
      .upload(uploadPath, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      console.error(`[stylepack-quick-test] [${requestId}] Upload error:`, uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload image', details: uploadError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('cake-inspiration')
      .getPublicUrl(uploadPath);

    const generationTime = Date.now() - startTime;

    console.log(`[stylepack-quick-test] [${requestId}] Success in ${generationTime}ms`);

    return new Response(
      JSON.stringify({
        imageUrl: publicUrlData.publicUrl,
        generationTime,
        params: params || {}
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[stylepack-quick-test] [${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
