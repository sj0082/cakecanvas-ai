import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
};

const idempotencyCache = new Map<string, any>();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { requestId } = await req.json();
    const idempotencyKey = req.headers.get('idempotency-key');

    if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
      console.log('Returning cached result for idempotency key:', idempotencyKey);
      return new Response(JSON.stringify(idempotencyCache.get(idempotencyKey)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: request, error: reqError } = await supabase
      .from('requests')
      .select(`
        *,
        stylepacks!inner(*),
        size_categories!inner(*)
      `)
      .eq('id', requestId)
      .single();

    if (reqError || !request) {
      return new Response(JSON.stringify({ error: 'Request not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: existing } = await supabase
      .from('proposals')
      .select('*')
      .eq('request_id', requestId);

    if (existing && existing.length > 0) {
      console.log('Proposals already exist for request:', requestId);
      return new Response(JSON.stringify({ proposals: existing }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const stylepack = request.stylepacks;
    const sizeCategory = request.size_categories;

    const seed = Math.floor(Math.random() * 1000000);
    const provider = stylepack.generator_provider || 'gemini';

    const hardConstraints = [
      `Shape: ${stylepack.shape_template || 'round, tiered'}`,
      `Palette: ${JSON.stringify(stylepack.palette_range || {})}`,
      `Accents: ${(stylepack.allowed_accents || []).join(', ')}`
    ].join(' | ');

    const softConstraints = request.user_text || '';

    const prompt = `Professional cake design photography. ${hardConstraints}. ${softConstraints}. High quality, realistic, bakery product photo.`;
    
    const negativePrompt = [
      ...(stylepack.banned_terms || []),
      'cartoon', 'anime', 'toy', 'plastic', 'floating', 'impossible structure', 
      'logo', 'trademark', 'licensed character', 'low quality'
    ].join(', ');

    const referenceImages = stylepack.images || [];

    let generatedProposals = [];

    try {
      const geminiResult = await generateWithGemini({
        prompt,
        referenceImages,
        numImages: 3,
        supabase
      });
      generatedProposals = geminiResult.images;
    } catch (error) {
      console.error('Generation failed:', error);
      throw error;
    }

    const proposalsToInsert = generatedProposals.map((imgData: any, idx: number) => ({
      request_id: requestId,
      variant: `V${idx + 1}`,
      image_url: imgData.url,
      spec_json: {
        prompt,
        negativePrompt,
        seed: seed + idx,
        provider
      },
      generator_request: {
        prompt,
        negative_prompt: negativePrompt,
        reference_images: referenceImages,
        seed: seed + idx,
        provider
      },
      generator_response: imgData.metadata || {},
      seed: seed + idx,
      price_range_min: sizeCategory.base_price_min,
      price_range_max: sizeCategory.base_price_max,
      badges: []
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('proposals')
      .insert(proposalsToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting proposals:', insertError);
      throw insertError;
    }

    await supabase
      .from('requests')
      .update({ status: 'READY' })
      .eq('id', requestId);

    const result = { proposals: inserted };

    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, result);
      setTimeout(() => idempotencyCache.delete(idempotencyKey), 5 * 60 * 1000);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in generate-proposals:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Generation failed' 
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function generateWithGemini(params: any) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  const images = [];
  
  for (let i = 0; i < params.numImages; i++) {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          { role: "user", content: params.prompt }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini generation failed: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl) {
      const url = await uploadBase64Image(imageUrl.replace('data:image/png;base64,', ''), `gemini-${Date.now()}-${i}`, params.supabase);
      images.push({ url, metadata: { provider: 'gemini' } });
    }
  }

  return { images };
}

async function uploadBase64Image(base64: string, filename: string, supabase: any): Promise<string> {
  const binaryData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  
  const path = `proposals/${filename}.png`;
  
  const { error: uploadError } = await supabase.storage
    .from('cake-inspiration')
    .upload(path, binaryData, {
      contentType: 'image/png',
      upsert: true
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage
    .from('cake-inspiration')
    .getPublicUrl(path);

  return data.publicUrl;
}
