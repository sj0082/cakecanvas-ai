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

  const startTime = Date.now();
  let requestId: string | null = null;

  try {
    const body = await req.json();
    requestId = body.requestId;
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

    // Extract StylePack constraints
    const paletteRange = stylepack.palette_range as any || {};
    const primaryColors = paletteRange.primary || [];
    const accentColors = paletteRange.accent || [];
    const allowedAccents = stylepack.allowed_accents || [];
    const bannedTerms = stylepack.banned_terms || [];
    const shapeTemplate = stylepack.shape_template || 'round, tiered';
    
    // Extract style control parameters
    const styleStrength = stylepack.style_strength ?? 0.75;
    const sharpness = stylepack.sharpness ?? 0.7;
    const realism = stylepack.realism ?? 0.8;
    const complexity = stylepack.complexity ?? 0.6;
    const paletteLock = stylepack.palette_lock ?? 0.9;
    
    // Extract Size Category info
    const tiersSpec = sizeCategory.tiers_spec as any || {};
    const tierCount = tiersSpec.tiers || 1;
    const servingRange = `${sizeCategory.serving_min}-${sizeCategory.serving_max}`;
    
    // User preferences
    const userText = request.user_text || '';
    
    // Reference images for style guidance
    const referenceImages = stylepack.images || [];
    
    // Define 3 variants with different creative approaches
    const variants = [
      {
        name: 'conservative',
        label: 'V1-Conservative',
        description: 'Safe, classic design staying close to proven style references',
        creativityLevel: 'low',
        promptModifier: 'Classic, traditional, elegant design. Stay very close to reference style. Minimal embellishments, timeless and sophisticated.'
      },
      {
        name: 'standard',
        label: 'V2-Standard',
        description: 'Balanced design with moderate creative interpretation',
        creativityLevel: 'medium',
        promptModifier: 'Well-balanced design with creative touches. Harmonious blend of classic and contemporary elements. Moderate decoration density.'
      },
      {
        name: 'bold',
        label: 'V3-Bold',
        description: 'Creative, eye-catching design pushing style boundaries',
        creativityLevel: 'high',
        promptModifier: 'Bold, eye-catching design with creative flair. Modern interpretation with striking visual impact. Rich decoration and dramatic presentation.'
      }
    ];

    const negativePrompt = [
      ...bannedTerms,
      'cartoon', 'anime', 'toy', 'plastic', 'floating', 'impossible structure', 
      'logo', 'trademark', 'text', 'words', 'licensed character', 'low quality',
      'blurry', 'distorted', 'deformed', 'amateur'
    ].join(', ');

    let generatedProposals = [];

    try {
      // Generate each variant with customized prompt (with timeout)
      const generationPromises = variants.map(async (variant, i) => {
        const detailedPrompt = buildDetailedPrompt({
          stylepackName: stylepack.name,
          stylepackDescription: stylepack.description || '',
          variantModifier: variant.promptModifier,
          tierCount,
          servingRange,
          primaryColors,
          accentColors,
          allowedAccents,
          shapeTemplate,
          userText,
          negativePrompt,
          // Pass style control parameters
          styleStrength,
          sharpness,
          realism,
          complexity,
          paletteLock
        });
        
        console.log(`Generating ${variant.label} with prompt:`, detailedPrompt);
        
        const imageData = await generateWithGemini({
          prompt: detailedPrompt,
          referenceImages,
          variant: variant.name,
          supabase
        });
        
        return {
          ...imageData,
          variant: variant.name,  // Use 'conservative', 'standard', 'bold' for DB
          variantLabel: variant.label,  // Keep 'V1-Conservative' etc. for UI
          variantType: variant.name,
          description: variant.description,
          prompt: detailedPrompt,
          seed: seed + i
        };
      });

      // Wait for all generations with 90 second timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Generation timeout after 90 seconds')), 90000)
      );
      
      generatedProposals = await Promise.race([
        Promise.all(generationPromises),
        timeoutPromise
      ]) as any[];
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`All variants generated successfully in ${elapsed}s`);
      
    } catch (error) {
      console.error('Generation failed:', error);
      
      // Update request status to FAILED
      if (requestId) {
        await supabase
          .from('requests')
          .update({ 
            status: 'FAILED',
            updated_at: new Date().toISOString()
          })
          .eq('id', requestId);
        console.log('Updated request status to FAILED:', requestId);
      }
      
      throw error;
    }

    const proposalsToInsert = generatedProposals.map((imgData: any) => ({
      request_id: requestId,
      variant: imgData.variant,
      image_url: imgData.url,
      spec_json: {
        prompt: imgData.prompt,
        negativePrompt,
        seed: imgData.seed,
        provider,
        variantType: imgData.variantType,
        variantLabel: imgData.variantLabel,  // Store UI-friendly label
        description: imgData.description
      },
      generator_request: {
        prompt: imgData.prompt,
        negative_prompt: negativePrompt,
        reference_images: referenceImages,
        seed: imgData.seed,
        provider,
        variant: imgData.variantType
      },
      generator_response: imgData.metadata || {},
      seed: imgData.seed,
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
    const errorMessage = error instanceof Error ? error.message : 'Generation failed';
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.error(`Generation failed after ${elapsed}s:`, errorMessage);
    
    // Ensure request is marked as FAILED
    if (requestId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase
          .from('requests')
          .update({ 
            status: 'FAILED',
            updated_at: new Date().toISOString()
          })
          .eq('id', requestId);
      } catch (updateError) {
        console.error('Failed to update request status:', updateError);
      }
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      requestId
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function buildDetailedPrompt(params: {
  stylepackName: string;
  stylepackDescription: string;
  variantModifier: string;
  tierCount: number;
  servingRange: string;
  primaryColors: string[];
  accentColors: string[];
  allowedAccents: string[];
  shapeTemplate: string;
  userText: string;
  negativePrompt: string;
  styleStrength: number;
  sharpness: number;
  realism: number;
  complexity: number;
  paletteLock: number;
}): string {
  const {
    stylepackName,
    stylepackDescription,
    variantModifier,
    tierCount,
    servingRange,
    primaryColors,
    accentColors,
    allowedAccents,
    shapeTemplate,
    userText,
    styleStrength,
    sharpness,
    realism,
    complexity,
    paletteLock
  } = params;

  // Build complexity description based on parameter
  const complexityText = complexity > 0.7
    ? 'Highly detailed with intricate decorations, multiple layers of embellishments, and rich textures'
    : complexity > 0.4
    ? 'Moderately decorated with elegant elements and balanced ornamentation'
    : 'Minimalist design with clean lines, subtle decorations, and refined simplicity';
  
  // Build realism description based on parameter
  const realismText = realism > 0.75
    ? 'Ultra-realistic, photographic quality with perfect lighting and texture detail'
    : realism > 0.5
    ? 'Natural and achievable design with realistic materials and proportions'
    : 'Stylized artistic interpretation while maintaining bakery feasibility';
  
  // Build sharpness description based on parameter
  const sharpnessText = sharpness > 0.75
    ? 'Crystal clear details, sharp edges, and crisp textures'
    : sharpness > 0.5
    ? 'Balanced focus with clear main features and soft background'
    : 'Soft focus with dreamy, gentle appearance';
  
  // Build style strength description
  const styleText = styleStrength > 0.8
    ? 'Stay extremely close to reference style with minimal creative deviation'
    : styleStrength > 0.6
    ? 'Follow reference style while allowing some creative interpretation'
    : 'Use reference as loose inspiration with significant creative freedom';
  
  // Build palette adherence description
  const paletteText = paletteLock > 0.85
    ? 'Strictly use only the specified colors with no variations'
    : paletteLock > 0.6
    ? 'Primarily use specified colors with subtle complementary tones'
    : 'Inspired by color palette with flexible color interpretation';

  // Build structured, detailed prompt with 2025 trends
  const sections = [
    `Professional cake design photography in ${stylepackName} style.`,
    stylepackDescription ? `Style essence: ${stylepackDescription}` : '',
    `Design approach: ${variantModifier}`,
    '',
    '2025 CAKE DESIGN TRENDS:',
    '- Modern minimalist aesthetics with organic textures',
    '- Sustainable and natural decoration elements',
    '- Instagram-worthy visual appeal with bold colors or elegant simplicity',
    '- Innovative use of fresh flowers, geometric patterns, or artistic brushstrokes',
    '- Contemporary color palettes: sage green, terracotta, dusty rose, champagne gold',
    '',
    'STYLE PARAMETERS:',
    `- Style adherence: ${styleText}`,
    `- Realism: ${realismText}`,
    `- Detail level: ${complexityText}`,
    `- Image quality: ${sharpnessText}`,
    `- Color accuracy: ${paletteText}`,
    '',
    'STRUCTURE REQUIREMENTS:',
    `- ${tierCount} tier${tierCount > 1 ? 's' : ''} cake (serving ${servingRange} people)`,
    `- Shape: ${shapeTemplate}`,
    `- Professional bakery quality construction with modern techniques`,
    '',
    'COLOR PALETTE:',
    primaryColors.length > 0 ? `- Primary colors: ${primaryColors.join(', ')}` : '',
    accentColors.length > 0 ? `- Accent colors: ${accentColors.join(', ')}` : '',
    '',
    'DECORATION ELEMENTS:',
    allowedAccents.length > 0 ? `- Allowed accents: ${allowedAccents.join(', ')}` : '',
    '- Use trending decoration techniques: textured buttercream, wafer paper flowers, gold leaf accents',
    '',
    userText ? `CUSTOMER PREFERENCES: ${userText}` : '',
    '',
    'PHOTOGRAPHY REQUIREMENTS:',
    '- Professional studio lighting with soft, flattering shadows',
    '- Clean white or soft neutral background for maximum elegance',
    '- Sharp focus on cake details and textures',
    '- High resolution product photography (Instagram/Pinterest quality)',
    '- Appetizing presentation angle (slightly elevated, 3/4 view)',
    '- No text, logos, watermarks, or brand names',
    '- Realistic, achievable design that a skilled baker can execute',
    '',
    'TRENDING VISUAL ELEMENTS (2025):',
    '- Natural lighting simulation for authentic appeal',
    '- Organic shapes and flowing decorations',
    '- Mix of matte and metallic finishes',
    '- Fresh botanicals or modern geometric patterns',
    '- Color gradients and ombré effects'
  ];

  return sections.filter(s => s).join('\n');
}

async function generateWithGemini(params: any) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  // Build multimodal message content with reference images
  const messageContent: any[] = [
    { type: "text", text: params.prompt }
  ];

  // Add reference images if available (up to 3 for best results)
  if (params.referenceImages && params.referenceImages.length > 0) {
    const referencesToUse = params.referenceImages.slice(0, 3);
    
    // Add style guidance text
    messageContent.unshift({
      type: "text",
      text: `Reference images for style guidance (study these styles carefully):`
    });
    
    // Add each reference image
    for (const refUrl of referencesToUse) {
      messageContent.push({
        type: "image_url",
        image_url: { url: refUrl }
      });
    }
    
    // Add instruction to use references
    messageContent.push({
      type: "text",
      text: `Generate a new cake design inspired by the reference images above, following the specific requirements below:`
    });
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [
        { 
          role: "user", 
          content: messageContent
        }
      ],
      modalities: ["image", "text"]
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);
    throw new Error(`Gemini generation failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  
  if (!imageUrl) {
    throw new Error('No image generated in response');
  }

  const url = await uploadBase64Image(
    imageUrl.replace('data:image/png;base64,', ''), 
    `${params.variant}-${Date.now()}`, 
    params.supabase
  );
  
  return { 
    url, 
    metadata: { 
      provider: 'gemini',
      model: 'gemini-2.5-flash-image',
      hasReferences: (params.referenceImages?.length || 0) > 0,
      referenceCount: params.referenceImages?.length || 0
    } 
  };
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
