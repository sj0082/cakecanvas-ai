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

    // Generate AI image with style parameters
    const styleIntensity = params?.strength >= 0.8 ? "very closely matching" : 
                          params?.strength >= 0.6 ? "strongly inspired by" : 
                          "loosely inspired by";
    
    const detailLevel = params?.cfg >= 0.7 ? "with highly detailed decorations and precise textures" :
                       params?.cfg >= 0.5 ? "with elegant decorative elements" :
                       "with subtle, minimalist decorations";

    const prompt = `Generate a completely NEW ${stylePackName || 'wedding'} cake design that is ${styleIntensity} the visual style of the reference image. Create a different cake with unique composition and structure, but use similar colors, textures, and decorative style elements from the reference. The new cake should be ${detailLevel}. Make it elegant, realistic, and professionally photographed in a similar lighting style.`;

    console.log(`[stylepack-quick-test] [${requestId}] Calling AI with params:`, { strength: params?.strength, cfg: params?.cfg, seed: params?.seed });
    console.log(`[stylepack-quick-test] [${requestId}] Prompt: ${prompt.substring(0, 150)}...`);

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
        modalities: ["image", "text"],
        ...(lockSeed && params?.seed ? { seed: params.seed } : {})
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
    console.log(`[stylepack-quick-test] [${requestId}] AI response structure:`, {
      hasChoices: !!completion.choices,
      choicesLength: completion.choices?.length,
      hasMessage: !!completion.choices?.[0]?.message,
      hasImages: !!completion.choices?.[0]?.message?.images
    });

    const generatedImageBase64 = completion.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImageBase64) {
      console.error(`[stylepack-quick-test] [${requestId}] No image in AI response. Full response:`, JSON.stringify(completion).substring(0, 500));
      return new Response(
        JSON.stringify({ error: 'No image generated', details: 'AI did not return an image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[stylepack-quick-test] [${requestId}] AI image generated successfully (base64 length: ${generatedImageBase64.length}), uploading to storage...`);

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
