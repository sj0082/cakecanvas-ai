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
    
    // Parse user text to extract keywords and remove structural elements that conflict with StylePack
    function parseUserTextForStyleBlending(userText: string, tierCount: number) {
      if (!userText) return { keywords: [], inspiration: '', originalLength: 0, cleanedLength: 0 };
      
      // Structural patterns to remove (these come from size_category and StylePack)
      const structuralPatterns = [
        /\d+\s*tier/gi,
        /tiered/gi,
        /pedestal\s*stand/gi,
        /cake\s*stand/gi,
        /serving\s*\d+/gi,
        /people/gi,
        /\d+\s*inch/gi,
        /round\s*cake/gi,
        /square\s*cake/gi
      ];
      
      let cleanedText = userText;
      for (const pattern of structuralPatterns) {
        cleanedText = cleanedText.replace(pattern, '');
      }
      
      // Extract color keywords (for palette comparison)
      const colorKeywords = extractColorsFromText(cleanedText);
      
      // Extract decoration/material keywords
      const decorationKeywords = cleanedText.match(/\b(peonies|roses|hydrangeas|eucalyptus|pampas|ribbon|piping|quilted|pearls|lace|fondant|buttercream|flowers|botanicals|gold|silver)\b/gi) || [];
      
      // Extract style/mood keywords
      const styleKeywords = cleanedText.match(/\b(classic|elegant|luxury|luxurious|romantic|modern|traditional|minimalist|dramatic|bold|vintage|contemporary|sophisticated)\b/gi) || [];
      
      // Combine all keywords and remove duplicates
      const allKeywords = [
        ...colorKeywords.map(c => c.toLowerCase()),
        ...decorationKeywords.map(d => d.toLowerCase()),
        ...styleKeywords.map(s => s.toLowerCase())
      ].filter((v, i, a) => a.indexOf(v) === i);
      
      // Create inspiration text (cleaned of structural elements, max 200 chars)
      const inspiration = cleanedText
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200);
      
      return {
        keywords: allKeywords,
        inspiration: inspiration,
        originalLength: userText.length,
        cleanedLength: cleanedText.length,
        decorationKeywords: decorationKeywords.map(d => d.toLowerCase()),
        styleKeywords: styleKeywords.map(s => s.toLowerCase())
      };
    }
    
    const userTextParsed = parseUserTextForStyleBlending(userText, sizeCategory.tiers_spec?.length || 1);
    console.log(`📝 Parsed user text: ${userTextParsed.keywords.length} keywords extracted, ${userTextParsed.cleanedLength} chars after removing structural elements`);
    
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
      
      // Skip validation if palette is empty or invalid
      if (!Array.isArray(paletteToValidate) || paletteToValidate.length === 0) {
        console.warn('⚠️ No valid palette to validate against, skipping palette lock validation');
      } else {
        console.log('Palette to validate against:', paletteToValidate);
        
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
    
    // Reference images for style guidance - use analyzed images from stylepack_ref_images
    const referenceImages = refImages.map((img: any) => img.url).filter(Boolean);
    
    if (referenceImages.length === 0) {
      console.warn('⚠️ No reference image URLs found from stylepack_ref_images, falling back to stylepack.images');
      const fallbackImages = stylepack.images || [];
      referenceImages.push(...fallbackImages);
    }
    
    console.log(`📸 Using ${referenceImages.length} analyzed reference image URLs for generation`);
    
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

    // Build reference context with detailed analysis information
    const refContextForPrompt = refImages.length > 0 ? `
REFERENCE IMAGE ANALYSIS (${refImages.length} images - MANDATORY STYLE MATCHING):
${refImages.map((img: any, i: number) => {
  // Extract palette information
  const paletteColors = img.palette?.colors || img.palette || [];
  const colorStr = Array.isArray(paletteColors) 
    ? paletteColors.map((c: any) => {
        const hex = c.hex || c.color || c;
        const ratio = c.ratio || 0.1;
        const name = c.name || '';
        return `${hex}${name ? ` (${name})` : ''} ${(ratio * 100).toFixed(0)}%`;
      }).join(', ')
    : 'not analyzed';
  
  // Extract texture information
  const textures = img.texture_tags || [];
  const textureStr = textures.length > 0 
    ? textures.join(', ')
    : 'smooth fondant';
  
  // Extract density
  const density = img.density || 'medium';
  
  return `Reference Image ${i + 1}:
  - Color Palette: ${colorStr}
  - Texture Techniques: ${textureStr}
  - Decoration Density: ${density}
  - Style Characteristics: ${textures.includes('textured') ? 'Modern textured finish' : 'Smooth elegant finish'}, ${density === 'high' ? 'Richly decorated' : density === 'low' ? 'Minimalist' : 'Balanced decoration'}`;
}).join('\n')}

CRITICAL STYLE MATCHING REQUIREMENTS:
1. Match the EXACT color palette proportions from these reference images
2. Replicate the texture techniques (${refImages.map((img: any) => img.texture_tags?.join(', ') || 'smooth').join(', ')})
3. Follow the decoration density level (${refImages[0]?.density || 'medium'})
4. Maintain the overall aesthetic style and visual language
5. Incorporate 2025 trending elements while preserving the core style identity
6. Palette lock is ${paletteLock >= 0.9 ? 'ACTIVE - colors must match exactly (ΔE ≤ 10)' : 'flexible - inspired by palette'}

These reference images represent the seller's signature style. The generated design must feel like it belongs to the same collection while incorporating modern 2025 trends.
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
          userTextParsed,  // ✅ Pass parsed user text with keywords
          negativePrompt,
          referenceContext: refContextForPrompt,  // ✅ Pass analyzed reference context
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
          tierCount,  // ✅ Pass tier count for priority instructions
          shapeTemplate,  // ✅ Pass shape for priority instructions
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
  userTextParsed?: any;  // ✅ Add userTextParsed parameter
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
        ...trendKeywords.map(k => `- ${k}`),
        trendTechniques && trendTechniques.length > 0 
          ? `- Recommended techniques: ${trendTechniques.join(', ')}`
          : '',
        '- Instagram trending: Natural lighting, organic textures, contemporary aesthetics',
        '- Pinterest trending: Textured buttercream, fresh botanicals, geometric accents'
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
          : '',
        '- Instagram trending: Textured buttercream, natural botanicals, sculptural elements',
        '- Pinterest trending: Ombré gradients, wafer paper flowers, contemporary color palettes'
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
          : '',
        '- Instagram trending: Bold artistic statements, dramatic textures, unexpected materials',
        '- Pinterest trending: Sculptural designs, abstract patterns, mixed media finishes'
      ];

  // Build structured, detailed prompt with PRIORITIZED sections
  const sections = [
    `Professional cake design photography in ${stylepackName} style.`,
    stylepackDescription ? `Style essence: ${stylepackDescription}` : '',
    `Design approach: ${variantModifier}`,
    '',
    // ✅ PRIORITY 1: Reference context at the very top
    referenceContext,
    '',
    // ✅ PRIORITY 2: Style parameters (strength, realism, detail)
    'STYLE PARAMETERS:',
    `- Style adherence: ${styleText}`,
    `- Realism: ${realismText}`,
    `- Detail level: ${complexityText}`,
    `- Image quality: ${sharpnessText}`,
    `- Color accuracy: ${paletteText}`,
    '',
    // ✅ PRIORITY 3: Structure requirements (FIXED from size category, NOT customer)
    'STRUCTURE REQUIREMENTS (FIXED - from size category, NOT from customer input):',
    `- ${tierCount} tier${tierCount > 1 ? 's' : ''} cake (serving ${servingRange} people)`,
    `- Shape: ${shapeTemplate}`,
    `- Professional bakery quality construction with modern techniques`,
    `- Stand style: Match the StylePack's typical aesthetic (ignore any customer stand requests)`,
    '',
    // ✅ PRIORITY 4: Color palette (from StylePack reference images)
    'COLOR PALETTE (from StylePack reference images - PRIORITY OVER customer colors):',
    primaryColors.length > 0 ? `- Primary colors: ${primaryColors.join(', ')}` : '',
    accentColors.length > 0 ? `- Accent colors: ${accentColors.join(', ')}` : '',
    paletteLock >= 0.9 ? '- Palette lock ACTIVE: Use ONLY these exact colors (ΔE ≤ 10)' : '- Flexible palette: Use these as primary inspiration',
    '',
    // ✅ PRIORITY 5: Decoration elements (StylePack-based)
    'DECORATION ELEMENTS (from StylePack):',
    allowedAccents.length > 0 ? `- Allowed accents: ${allowedAccents.join(', ')}` : '',
    '- Use trending decoration techniques: textured buttercream, wafer paper flowers, gold leaf accents',
    '',
    // ✅ PRIORITY 6: 2025 Trends
    ...trendSection.filter(Boolean),
    '',
    // ✅ PRIORITY 7 (LAST): Customer inspiration - BLEND, don't override
    userText && params.userTextParsed ? `CUSTOMER INSPIRATION (to be BLENDED with StylePack style, NOT overriding):

IMPORTANT: The following customer preferences should be INTERPRETED and BLENDED with the StylePack's signature style shown in the reference images above. Do NOT override the StylePack's color palette, texture techniques, or decoration density. Use these preferences as INSPIRATION to guide the overall aesthetic direction.

Customer inspiration text: ${params.userTextParsed.inspiration || userText.substring(0, 200)}

Key elements to consider: ${params.userTextParsed.keywords.join(', ')}

BLENDING INSTRUCTIONS:
- Decoration preferences: ${params.userTextParsed.decorationKeywords?.join(', ') || 'none specified'} - use ONLY if aligned with StylePack's aesthetic
- Style mood: ${params.userTextParsed.styleKeywords?.join(', ') || 'none specified'} - blend with StylePack's signature style
- Color preferences: If customer colors conflict with StylePack palette, PRIORITIZE StylePack colors
- Structural elements: The tier count (${tierCount}), shape (${shapeTemplate}), and stand style come from size category and StylePack defaults, NOT from customer preferences
- Texture techniques: Maintain the StylePack's texture style from reference images

The final design MUST feel like it belongs to the ${stylepackName} collection while incorporating customer preferences as subtle inspiration.` : '',
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
  const messageContent: any[] = [];

  // Add reference images if available (up to 3 for best results)
  if (params.referenceImages && params.referenceImages.length > 0) {
    const referencesToUse = params.referenceImages.slice(0, 3);
    
    // Step 1: Add detailed analysis instructions first
    messageContent.push({
      type: "text",
      text: `REFERENCE IMAGE ANALYSIS INSTRUCTIONS:
Study these reference images carefully and extract:

COLOR ANALYSIS:
- Extract the exact color palette with proportions (hex codes and percentages)
- Identify primary, secondary, and accent colors
- Note color temperature and saturation levels
- Match these colors EXACTLY in the generated design

TEXTURE ANALYSIS:
- Identify texture techniques: smooth buttercream, textured finishes, fondant, etc.
- Note surface finishes: matte, satin, glossy, metallic
- Replicate these texture techniques in the generated design

DENSITY ANALYSIS:
- Assess decoration density: low (minimalist), medium (balanced), high (richly decorated)
- Note placement patterns and visual weight distribution
- Maintain similar density level in the generated design

STYLE ANALYSIS:
- Identify the seller's signature aesthetic and visual language
- Note design elements that make this style unique
- Maintain the core style identity while incorporating 2025 trends

TREND INTEGRATION:
- Identify which elements from these references align with 2025 trends
- Suggest modern updates that preserve the style essence
- Focus on Instagram-worthy, Pinterest-pinnable aesthetic

Focus on elements that make these designs visually appealing and commercially successful.`
    });
    
    // Step 2: Add each reference image
    for (const refUrl of referencesToUse) {
      messageContent.push({
        type: "image_url",
        image_url: { url: refUrl }
      });
    }
    
    // Step 3: Add generation requirements with PRIORITY ORDER
    messageContent.push({
      type: "text",
      text: `GENERATION REQUIREMENTS (PRIORITY ORDER):

1. FIRST PRIORITY: Match the StylePack's signature style from the reference images above
   - Use the EXACT color palette from references (hex codes + proportions shown above)
   - Replicate the texture techniques shown in reference images
   - Match the decoration density level from references
   - Maintain the overall aesthetic and visual language
   - This is the seller's signature style - the design must feel like it belongs to their collection

2. SECOND PRIORITY: Incorporate 2025 trending elements
   - Modern techniques: textured buttercream, natural botanicals, contemporary color palettes
   - Trending aesthetics: Instagram-worthy, Pinterest-pinnable presentation
   - 2025 trends: ombré effects, wafer paper flowers, gold leaf accents, geometric patterns
   - Sculptural elements and artistic brushstrokes
   - Update classic styles with subtle contemporary touches

3. THIRD PRIORITY: Blend customer preferences (if provided in the prompt below)
   - Use customer preferences as INSPIRATION only, not as strict requirements
   - If customer preferences conflict with StylePack style, PRIORITIZE StylePack style
   - Customer's structural requests (tier count, stand type) are IGNORED - use size category defaults
   - Customer's color preferences are IGNORED if they conflict with StylePack palette
   - Customer's decoration ideas are considered ONLY if they align with StylePack aesthetic

4. STRUCTURAL REQUIREMENTS (FIXED from size category, NOT from customer):
   - Tier count: ${params.tierCount || 'as specified'} tiers (this is FIXED, do NOT change based on customer preferences)
   - Shape: ${params.shapeTemplate || 'round'} (this is FIXED)
   - Stand: Use StylePack's typical stand style (do NOT use customer's specific stand request)
   - Construction: Professional bakery quality with modern techniques

5. QUALITY REQUIREMENTS:
   - Commercial viability - achievable by a skilled baker
   - Avoid outdated design elements from 2010s-2020s (overly ornate piping, dated color schemes, fondant overload)
   - Professional photography quality (Instagram/Pinterest standards)
   - Natural, appealing presentation

CRITICAL: The generated design must look like it belongs to the StylePack's collection. Customer preferences are secondary to StylePack style. The reference images define the style - follow them closely.

Now generate the cake design based on the following detailed specification:`
    });
  }

  // Step 4: Add the actual prompt last
  messageContent.push({
    type: "text",
    text: params.prompt
  });

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image-preview',  // ✅ Use consistent model name
      messages: [
        {
          role: 'user',
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
      model: 'gemini-2.5-flash-image-preview',
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
