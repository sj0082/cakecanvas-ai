import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { filterForbiddenTerms } from '../_shared/forbidden-filter.ts';
import { getFullNegativePrompt } from '../_shared/constants.ts';
import { validatePaletteLock, extractColorsFromText } from '../_shared/color-utils.ts';

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

    // Fetch reference images for the stylepack WITH embeddings
    const { data: refImages } = await supabase
      .from('stylepack_ref_images')
      .select('id, url, palette, texture_tags, density, embedding')
      .eq('stylepack_id', stylepack.id)
      .limit(3);

    // HARD CONSTRAINT: Enforce minimum 2 reference images requirement
    if (!refImages || refImages.length < 2) {
      throw new Error(`StylePack "${stylepack.name}" requires at least 2 reference images for generation. Currently has ${refImages?.length || 0}.`);
    }

    console.log(`✅ Using ${refImages.length} reference images for style matching`);
    
    // Extract user text EARLY for all validations
    let userText = request.user_text || '';
    
    // HARD CONSTRAINT: Generate layout mask based on tier structure
    let layoutMaskUrl = null;
    if (sizeCategory.tiers_spec) {
      console.log('🎨 Generating layout mask for tier structure:', JSON.stringify(sizeCategory.tiers_spec));
      
      try {
        const { data: maskData, error: maskError } = await supabase.functions.invoke(
          'generate-layout-mask',
          { 
            body: { 
              tiersSpec: sizeCategory.tiers_spec,
              outputFormat: 'svg'
            } 
          }
        );
        
        if (maskError) {
          console.error('⚠️ Failed to generate layout mask:', maskError);
        } else if (maskData?.maskUrl) {
          layoutMaskUrl = maskData.maskUrl;
          console.log('✅ Layout mask generated:', layoutMaskUrl);
        }
      } catch (maskErr) {
        console.error('⚠️ Layout mask generation error:', maskErr);
      }
    }
    
    // HARD CONSTRAINT: Validate palette lock (ΔE ≤ 10)
    const requestedColors = extractColorsFromText(userText);
    let paletteViolations: Array<{color: string; closestMatch: string; deltaE: number}> = [];
    
    if (stylepack.palette_lock >= 0.9 && requestedColors.length > 0 && stylepack.palette_range) {
      console.log('🎨 Validating palette lock constraint (ΔE ≤ 10)...');
      console.log('Requested colors:', requestedColors);
      
      const paletteToValidate = Array.isArray(stylepack.palette_range) 
        ? stylepack.palette_range 
        : (stylepack.palette_range.primary || []);
      
      const validation = validatePaletteLock(requestedColors, paletteToValidate);
      
      if (!validation.isValid) {
        paletteViolations = validation.violations;
        console.warn('⚠️ Palette violations detected:', paletteViolations.length);
        
        // Log each violation for audit
        for (const violation of paletteViolations) {
          console.log(`  - ${violation.color} → ${violation.closestMatch} (ΔE: ${violation.deltaE.toFixed(2)})`);
          
          await supabase.from('logs_audit').insert({
            action: 'palette_lock_violation',
            request_id: requestId,
            note: `Color ${violation.color} violated palette lock (ΔE: ${violation.deltaE.toFixed(2)}). Closest match: ${violation.closestMatch}`,
          });
        }
        
        // Auto-correct: replace violating colors with closest matches in the text
        for (const violation of paletteViolations) {
          const colorNames: Record<string, string> = {
            '#FF0000': 'red', '#0000FF': 'blue', '#00FF00': 'green',
            '#FFFF00': 'yellow', '#FFA500': 'orange', '#800080': 'purple',
            '#FFC0CB': 'pink', '#FFD700': 'gold', '#C0C0C0': 'silver'
          };
          
          const violatingName = colorNames[violation.color];
          const matchName = colorNames[violation.closestMatch];
          
          if (violatingName && matchName) {
            userText = userText.replace(new RegExp(violatingName, 'gi'), matchName);
            console.log(`🔧 Auto-corrected "${violatingName}" → "${matchName}" in user text`);
          }
        }
      } else {
        console.log('✅ All requested colors within palette lock tolerance (ΔE ≤ 10)');
      }
    }

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
    
    const filterResult = filterForbiddenTerms(userText);
    userText = filterResult.cleanedText;
    
    if (filterResult.replacements.length > 0) {
      console.log('Filtered forbidden terms:', filterResult.replacements);
      // Log to audit table
      for (const replacement of filterResult.replacements) {
        await supabase.from('logs_audit').insert({
          action: 'forbidden_term_replaced',
          request_id: requestId,
          note: `Replaced "${replacement.original}" with "${replacement.replacement}"`,
        });
      }
    }

    // Validate palette lock if enabled
    if (paletteLock >= 0.9 && paletteRange.primary) {
      const requestedColors = extractColorsFromText(userText);
      if (requestedColors.length > 0) {
        const validation = validatePaletteLock(requestedColors, paletteRange.primary);
        if (!validation.isValid) {
          console.log('Palette lock violations detected:', validation.violations);
          // Log violations but continue (will adjust colors in prompt)
          await supabase.from('logs_audit').insert({
            action: 'palette_lock_violation',
            request_id: requestId,
            note: `${validation.violations.length} color(s) violated palette lock constraint`,
          });
        }
      }
    }
    
    // Reference images for style guidance
    const referenceImages = stylepack.images || [];
    
    // Extract StylePack trend keywords from database
    const styleTrendKeywords = (stylepack.trend_keywords as string[]) || [];
    const styleTrendTechniques = (stylepack.trend_techniques as string[]) || [];
    
    // Define 3 variants with different creative approaches and trend differentiation
    const variants = [
      {
        name: 'conservative',
        label: 'V1-Conservative',
        description: 'Safe, classic design staying close to proven style references',
        creativityLevel: 'low',
        promptModifier: 'Classic, traditional, elegant design. Stay very close to reference style. Minimal embellishments, timeless and sophisticated.',
        trendKeywords: [
          'Timeless elegance with subtle modern touches',
          'Refined classic aesthetics with 2025 contemporary color palettes',
          'Sophisticated minimalism with premium materials',
          'Elegant simplicity inspired by luxury wedding trends',
          ...styleTrendKeywords.slice(0, 2)
        ],
        trendTechniques: [
          'Subtle texture variations',
          'Refined color blocking',
          'Premium material finishes',
          'Delicate pearl dust accents',
          ...styleTrendTechniques.slice(0, 2)
        ]
      },
      {
        name: 'standard',
        label: 'V2-Standard',
        description: 'Balanced design with moderate creative interpretation',
        creativityLevel: 'medium',
        promptModifier: 'Well-balanced design with creative touches. Harmonious blend of classic and contemporary elements. Moderate decoration density.',
        trendKeywords: [
          'Modern romantic aesthetics with organic textures',
          'Instagram-worthy designs with trending color combinations (sage green + terracotta, dusty rose + champagne)',
          'Contemporary elegance with fresh botanical elements',
          '2025 wedding cake trends: textured buttercream, natural flowers, geometric accents',
          ...styleTrendKeywords.slice(0, 3)
        ],
        trendTechniques: [
          'Textured buttercream finishes',
          'Fresh flower arrangements',
          'Geometric pattern accents',
          'Ombré color gradients',
          'Wafer paper flowers',
          ...styleTrendTechniques.slice(0, 3)
        ]
      },
      {
        name: 'bold',
        label: 'V3-Bold',
        description: 'Creative, eye-catching design pushing style boundaries',
        creativityLevel: 'high',
        promptModifier: 'Bold, eye-catching design with creative flair. Modern interpretation with striking visual impact. Rich decoration and dramatic presentation.',
        trendKeywords: [
          'Cutting-edge 2025 design trends with bold visual statements',
          'Viral Instagram cake aesthetics: dramatic textures, unexpected color combinations',
          'Avant-garde decoration techniques: wafer paper art, metallic accents, sculptural elements',
          'Pinterest trending: maximalist designs, artistic brushstrokes, contemporary art influences',
          ...styleTrendKeywords
        ],
        trendTechniques: [
          'Dramatic texture contrasts',
          'Bold color combinations',
          'Sculptural decoration elements',
          'Artistic brushstroke techniques',
          'Metallic and matte finish combinations',
          'Wafer paper art installations',
          'Abstract geometric patterns',
          ...styleTrendTechniques
        ]
      }
    ];

    const negativePrompt = getFullNegativePrompt() + ', ' + [
      ...bannedTerms,
      'cartoon', 'anime', 'toy', 'plastic', 'floating', 'impossible structure', 
      'logo', 'trademark', 'text', 'words', 'licensed character', 'low quality',
      'blurry', 'distorted', 'deformed', 'amateur',
      // Exclude outdated design elements
      'outdated design', 'old-fashioned', 'vintage 1990s style', 'vintage 2000s style',
      'overly ornate traditional', 'excessive piping borders', 'dated color schemes',
      'cheap looking decorations', 'artificial plastic flowers', 'tacky decorations',
      '2010s style', 'fondant roses overload', 'heavy traditional piping'
    ].join(', ');

    // Build reference context with color ratios
    const refContextForPrompt = refImages.length > 0 ? `
REFERENCE IMAGES (${refImages.length} provided - MANDATORY to match):
${refImages.map((img: any, i: number) => {
  const paletteColors = img.palette?.colors || img.palette || [];
  const colorStr = Array.isArray(paletteColors) 
    ? paletteColors.map((c: any) => `${c.hex || c} (${((c.ratio || 0.1) * 100).toFixed(0)}%)`).join(', ')
    : 'not analyzed';
  return `
  ${i + 1}. Color Palette: ${colorStr}
     Texture Tags: ${img.texture_tags?.join(', ') || 'smooth fondant'}
     Density Level: ${img.density || 'medium'}`;
}).join('\n')}

CRITICAL CONSTRAINT: Match the visual style, exact color palette proportions, and texture details from these ${refImages.length} reference images. Palette lock is ${paletteLock >= 0.9 ? 'ACTIVE - colors must match exactly (ΔE ≤ 10)' : 'flexible'}.
` : '';

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
          paletteLock,
          // Pass variant-specific trend data
          variantName: variant.name,
          trendKeywords: variant.trendKeywords,
          trendTechniques: variant.trendTechniques
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

    const proposalsToInsert = generatedProposals.map((imgData: any, index: number) => ({
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
      // New fields for improved tracking
      seed_class: Math.floor((imgData.seed % 5) + 1), // Map seed to 1-5 class
      stage: 1, // Stage 1: Initial generation (will be 2 for refinement, 3 for upscaling)
      engine: provider === 'gemini' ? 'google/gemini-2.5-flash-image' : provider,
      payload: {
        stylepack_id: request.stylepack_id,
        size_category_id: request.size_category_id,
        user_text: userText,
        variant_type: imgData.variantType,
        style_params: {
          style_strength: styleStrength,
          sharpness,
          realism,
          complexity,
          palette_lock: paletteLock
        },
        trend_keywords: styleTrendKeywords,
        trend_techniques: styleTrendTechniques,
        reference_images: referenceImages
      },
      scores: null, // Will be populated by quality evaluation
      rank_score: null, // Will be populated by reranking
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
  referenceContext?: string;
  styleStrength: number;
  sharpness: number;
  realism: number;
  complexity: number;
  paletteLock: number;
  variantName: string;
  trendKeywords?: string[];
  trendTechniques?: string[];
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
    negativePrompt,
    referenceContext = '',
    styleStrength,
    sharpness,
    realism,
    complexity,
    paletteLock,
    variantName,
    trendKeywords = [],
    trendTechniques = []
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

  // Build variant-specific trend section
  const trendSection = variantName === 'conservative'
    ? [
        '2025 TREND INSPIRATION (Refined Classic):',
        '- Timeless elegance with subtle contemporary updates',
        '- Premium material finishes: satin buttercream, pearl dust accents',
        '- Refined color palettes: muted pastels, sophisticated neutrals',
        '- Classic shapes with modern proportions',
        ...trendKeywords.map(k => `- ${k}`)
      ]
    : variantName === 'standard'
    ? [
        '2025 TREND INSPIRATION (Modern Romantic):',
        '- Instagram-worthy aesthetics: natural lighting, organic textures',
        '- Trending techniques: textured buttercream, fresh botanicals, geometric patterns',
        '- Contemporary color combinations: sage green + terracotta, dusty rose + champagne',
        '- Pinterest-inspired: ombré effects, wafer paper flowers, gold leaf accents',
        ...trendKeywords.map(k => `- ${k}`),
        trendTechniques && trendTechniques.length > 0 
          ? `- Recommended techniques: ${trendTechniques.join(', ')}`
          : ''
      ]
    : [ // bold
        '2025 TREND INSPIRATION (Avant-Garde):',
        '- Cutting-edge design trends: maximalist aesthetics, artistic expressions',
        '- Viral Instagram styles: dramatic textures, unexpected color combinations',
        '- Contemporary art influences: sculptural elements, abstract patterns',
        '- Pinterest trending: bold statements, artistic brushstrokes, mixed media',
        ...trendKeywords.map(k => `- ${k}`),
        trendTechniques && trendTechniques.length > 0
          ? `- Advanced techniques: ${trendTechniques.join(', ')}`
          : ''
      ];

  // Build structured, detailed prompt with variant-specific 2025 trends
  const sections = [
    `Professional cake design photography in ${stylepackName} style.`,
    stylepackDescription ? `Style essence: ${stylepackDescription}` : '',
    `Design approach: ${variantModifier}`,
    '',
    ...trendSection.filter(Boolean),
    '',
    referenceContext, // Add reference image context
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
    
    // Add detailed analysis instructions
    messageContent.unshift({
      type: "text",
      text: `REFERENCE IMAGE ANALYSIS INSTRUCTIONS:
Study these reference images carefully and extract the most modern, trending elements:
- Color combinations and palettes that are popular in 2025
- Texture techniques (smooth buttercream, textured surfaces, artistic finishes)
- Decoration styles and placement patterns
- Overall aesthetic appeal that would trend on Instagram and Pinterest
- Modern proportions and contemporary design language

Focus on elements that make these designs visually appealing and commercially successful.`
    });
    
    // Add each reference image
    for (const refUrl of referencesToUse) {
      messageContent.push({
        type: "image_url",
        image_url: { url: refUrl }
      });
    }
    
    // Add improved generation requirements
    messageContent.push({
      type: "text",
      text: `GENERATION REQUIREMENTS:
Create a NEW, TREND-FORWARD cake design that:
1. Incorporates the most modern and appealing elements from the reference images
2. Updates classic styles with 2025 trends (textured buttercream, natural botanicals, contemporary color palettes)
3. Creates an Instagram-worthy, Pinterest-pinnable design that customers want to purchase
4. Maintains commercial viability - must be achievable by a skilled baker
5. Follows the specific style requirements and parameters below
6. Avoids outdated design elements from 2010s-2020s (overly ornate piping, dated color schemes)

Generate a cake that customers would be excited to order for their special occasion in 2025:`
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
