import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { evaluateProposal } from '../_shared/quality-evaluation.ts';
import { filterForbiddenTerms } from '../_shared/forbidden-filter.ts';
import { getFullNegativePrompt } from '../_shared/constants.ts';
import { getCachedStage1, setCachedStage1, hashUserText } from '../_shared/cache-manager.ts';
import { generateStage2 } from './stage2-generation.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let requestId: string | null = null;

  try {
    const body = await req.json();
    requestId = body.requestId;

    console.log('🚀 Starting generate-proposals-v2 (Multi-stage Pipeline)');
    console.log(`📋 Request ID: ${requestId}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Step 1: Collect Context
    console.log('📥 Step 1: Collecting context...');
    
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
      throw new Error('Request not found');
    }

    const stylepack = request.stylepacks;
    const sizeCategory = request.size_categories;

    // Fetch reference images with embeddings
    const { data: refImages } = await supabase
      .from('stylepack_ref_images')
      .select('id, url, palette, texture_tags, density, embedding')
      .eq('stylepack_id', stylepack.id)
      .limit(3);

    if (!refImages || refImages.length < 2) {
      throw new Error('StylePack requires at least 2 reference images');
    }

    // Fetch reality rules for bakeability checks
    const { data: realityRules } = await supabase
      .from('rules_reality')
      .select('key, message, severity')
      .eq('is_active', true);

    const context = {
      request,
      stylepack,
      sizeCategory,
      refImages,
      realityRules: realityRules || [],
      userText: request.user_text || '',
      trendKeywords: (stylepack.trend_keywords as string[]) || [],
      trendTechniques: (stylepack.trend_techniques as string[]) || []
    };

    console.log(`✅ Context collected: ${refImages.length} ref images, ${realityRules?.length || 0} reality rules`);

    // Step 2: Conflict Detection
    console.log('🔍 Step 2: Detecting style conflicts...');
    
    const { data: compatibility } = await supabase.functions.invoke('check-style-compatibility', {
      body: {
        stylepackId: stylepack.id,
        userIntent: {
          text: context.userText,
          colors: [], // Would extract from userText
          keywords: []
        }
      }
    });

    if (compatibility && !compatibility.compatible) {
      console.warn(`⚠️ Style conflicts detected (${(compatibility.confidence * 100).toFixed(0)}% confidence):`);
      for (const conflict of compatibility.conflicts) {
        console.warn(`  - ${conflict.type} (${conflict.severity}): ${conflict.description}`);
      }
    }

    // Step 3: Build Hard Constraints
    console.log('🎯 Step 3: Building hard constraints...');
    
    // Generate layout mask
    let layoutMaskUrl = null;
    if (sizeCategory.tiers_spec) {
      const { data: maskData } = await supabase.functions.invoke('generate-layout-mask', {
        body: { tiersSpec: sizeCategory.tiers_spec, outputFormat: 'svg' }
      });
      layoutMaskUrl = maskData?.maskUrl;
    }

    // Filter forbidden terms
    const filterResult = filterForbiddenTerms(context.userText);
    context.userText = filterResult.cleanedText;

    const constraints = {
      layoutMaskUrl,
      forbiddenReplacements: filterResult.replacements,
      refImages: refImages.slice(0, 3),
      negativePrompt: getFullNegativePrompt(),
      paletteLock: stylepack.palette_lock ?? 0.9
    };

    console.log('✅ Constraints built');

    // Step 4: LLM-Optimized Prompt Generation
    console.log('🤖 Step 4: Optimizing prompts with LLM...');
    
    const prompts = await optimizePromptsWithLLM(context, constraints, LOVABLE_API_KEY);
    console.log('✅ Generated 3 prompt variants (conservative, standard, bold)');

    // Step 5: Stage 1 - Idea Generation (512px, 8-10 variants) with Caching
    console.log('💾 Step 5: Checking Stage 1 cache...');
    
    const userTextHash = await hashUserText(context.userText);
    const cacheKey = {
      stylepackId: stylepack.id,
      userTextHash: userTextHash,
      sizeCategoryId: sizeCategory.id
    };

    let stage1Proposals = await getCachedStage1(supabase, cacheKey);
    
    if (!stage1Proposals) {
      console.log('🎨 Cache miss - Generating Stage 1 (512px, 8-10 variants)...');
      
      stage1Proposals = await generateStage1(
        prompts,
        constraints,
        stylepack,
        requestId!,
        supabase,
        LOVABLE_API_KEY
      );

      // Cache the results
      await setCachedStage1(supabase, cacheKey, stage1Proposals);
    } else {
      console.log('✅ Cache hit - Using cached Stage 1 results');
    }

    console.log(`✅ Stage 1 complete: ${stage1Proposals.length} proposals`);


    // Step 6: Quality Evaluation & Re-ranking
    console.log('📊 Step 6: Quality evaluation and ranking...');
    
    const scoredProposals = [];
    for (const proposal of stage1Proposals) {
      const scores = await evaluateProposal(
        proposal.url,
        context.userText,
        stylepack.description || stylepack.name,
        stylepack.palette_range?.primary || [],
        context.realityRules,
        LOVABLE_API_KEY
      );
      
      scoredProposals.push({
        ...proposal,
        scores,
        rank_score: scores.overall
      });
    }

    // Sort by rank_score
    scoredProposals.sort((a, b) => b.rank_score - a.rank_score);

    // Auto-reroll low quality (overall < 0.4)
    const lowQuality = scoredProposals.filter(p => p.rank_score < 0.4);
    if (lowQuality.length > 0) {
      console.log(`⚠️ ${lowQuality.length} proposals below quality threshold (< 40%)`);
      // In full implementation, would regenerate these
    }

    // Select Top-K for Stage 2
    const topK = scoredProposals.slice(0, 3);
    console.log(`✅ Top 3 proposals selected for Stage 2 refinement`);

    // Step 7: Stage 2 - Refinement (1024px, Top-K only)
    console.log('✨ Step 7: Stage 2 refinement (1024px high-quality)...');
    
    const stage2Proposals = await generateStage2(
      topK,
      prompts,
      constraints,
      stylepack,
      requestId!,
      supabase,
      LOVABLE_API_KEY
    );
    
    console.log(`✅ Generated ${stage2Proposals.length} Stage 2 high-quality proposals`);
    
    // Combine Stage 1 and Stage 2 (prefer Stage 2 for top proposals)
    const finalProposals = stage2Proposals.length > 0 ? stage2Proposals : topK;

    // Step 8: Save to Database
    console.log('💾 Step 8: Saving proposals to database...');
    
    const proposalsToInsert = finalProposals.map((p, idx) => ({
      request_id: requestId,
      variant: `v2-${p.variantType}`,
      image_url: p.url,
      spec_json: {
        prompt: p.prompt,
        negativePrompt: constraints.negativePrompt,
        variantType: p.variantType,
        stage: p.stage
      },
      seed: p.seed,
      seed_class: Math.floor((p.seed % 5) + 1),
      stage: p.stage,
      engine: 'google/gemini-2.5-flash-image-preview',
      payload: {
        stylepack_id: stylepack.id,
        size_category_id: sizeCategory.id,
        user_text: context.userText,
        layout_mask_url: layoutMaskUrl,
        compatibility_confidence: compatibility?.confidence || 1.0,
        resolution: p.stage === 2 ? '1024px' : '512px'
      },
      scores: p.scores,
      rank_score: p.rank_score,
      price_range_min: sizeCategory.base_price_min,
      price_range_max: sizeCategory.base_price_max,
      badges: p.rank_score >= 0.8 ? ['high-quality'] : []
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('proposals')
      .insert(proposalsToInsert)
      .select();

    if (insertError) {
      throw insertError;
    }

    await supabase
      .from('requests')
      .update({ status: 'READY' })
      .eq('id', requestId);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Multi-stage pipeline complete in ${elapsed}s`);

    return new Response(
      JSON.stringify({ proposals: inserted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-proposals-v2:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper: Optimize prompts with LLM
async function optimizePromptsWithLLM(context: any, constraints: any, apiKey: string) {
  // Extract detailed style information from reference images
  const styleInfo = context.refImages.map((img: any, i: number) => {
    const paletteColors = img.palette?.colors || img.palette || [];
    const colorStr = Array.isArray(paletteColors) 
      ? paletteColors.map((c: any) => `${c.hex || c} (${((c.ratio || 0.1) * 100).toFixed(0)}%)`).join(', ')
      : 'not analyzed';
    return `Reference ${i + 1}:
- Colors: ${colorStr}
- Textures: ${img.texture_tags?.join(', ') || 'smooth fondant'}
- Density: ${img.density || 'medium'}`;
  }).join('\n');

  const systemPrompt = `You are an expert cake designer prompt engineer specializing in wedding cake design.

Your task is to generate 3 creative prompts (Conservative, Standard, Bold) that:
1. STRICTLY match the visual style from the reference images provided
2. Incorporate 2025 trending elements from Instagram and Pinterest
3. Blend user preferences with the seller's signature style
4. Ensure commercial viability and bakeability

CONTEXT:
- User request: "${context.userText || 'No specific request'}"
- Style pack: "${context.stylepack.name}" - ${context.stylepack.description || 'Elegant wedding cake style'}
- Reference images analyzed: ${context.refImages.length} images
${styleInfo}
- Trend keywords (2025): ${context.trendKeywords.length > 0 ? context.trendKeywords.join(', ') : 'Modern elegance, textured buttercream, natural botanicals'}
- Trend techniques: ${context.trendTechniques.length > 0 ? context.trendTechniques.join(', ') : 'Textured buttercream, wafer paper flowers, gold leaf accents'}
- Tier structure: ${context.sizeCategory.tiers_spec?.tiers || 1} tiers
- Palette lock: ${context.stylepack.palette_lock >= 0.9 ? 'STRICT - colors must match exactly' : 'Flexible - inspired by palette'}

STYLE REQUIREMENTS:
- Match the color palette proportions from reference images
- Replicate texture techniques (${context.refImages[0]?.texture_tags?.join(', ') || 'smooth fondant'})
- Follow decoration density (${context.refImages[0]?.density || 'medium'})
- Maintain the seller's signature aesthetic while adding 2025 trends

TREND INTEGRATION (2025):
- Instagram-worthy: Natural lighting, organic textures, contemporary color palettes
- Pinterest trending: Textured buttercream, fresh botanicals, geometric patterns, ombré effects
- Modern techniques: Wafer paper flowers, gold leaf accents, sculptural elements
- Avoid: Outdated 2010s-2020s styles, overly ornate traditional piping, dated color schemes

Generate 3 prompts as JSON:
{
  "conservative": "Classic [StylePack style] design with subtle 2025 updates. Start by describing the exact color palette from references (hex codes, proportions). Include: [textured buttercream finish, minimal fresh botanicals, refined gold accents]. Maintain reference textures and density. End with: 'Photorealistic, 4K, Instagram-worthy, natural lighting, shallow DOF, magazine quality'",
  
  "standard": "Modern [StylePack style] design balancing tradition and 2025 trends. Start by describing the color palette matching references. Incorporate: [textured buttercream, geometric patterns, fresh florals, ombré effects, wafer paper elements]. Match reference texture style. End with: 'Photorealistic, 4K, Pinterest-trending, contemporary aesthetic, professional photography'",
  
  "bold": "Artistic [StylePack style] design with bold 2025 interpretation. Start by describing the color palette inspired by references. Feature: [dramatic textured finishes, sculptural elements, unexpected botanical arrangements, artistic brushstrokes, gold leaf accents]. Preserve core style while pushing boundaries. End with: 'Photorealistic, 4K, Instagram editorial style, dramatic lighting, award-winning photography'"
}

CRITICAL PROMPT STRUCTURE (each prompt MUST follow this order):
1. Introduction (2 sentences): Tier count, shape, overall impression
2. Reference Style Matching (3 sentences):
   - Exact color palette (hex codes + proportions from references)
   - Texture techniques matching references (smooth fondant / textured buttercream)
   - Decoration density matching references (minimalist / balanced / richly decorated)
3. 2025 Trend Integration (4 sentences):
   - Specific trending elements to incorporate
   - How they enhance the base style
4. Tier-by-Tier Details (4 sentences):
   - Describe each tier's decoration, texture, and colors
5. Photography Style (1 sentence):
   - "Photorealistic, 4K, [Instagram/Pinterest]-worthy, [lighting style], [quality descriptor]"

Each prompt should be 250-300 words, detailed, actionable, and vendor-style specific.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'system', content: systemPrompt }],
      response_format: { type: 'json_object' }
    }),
  });

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

// Helper: Generate Stage 1 proposals
async function generateStage1(
  prompts: any,
  constraints: any,
  stylepack: any,
  requestId: string,
  supabase: any,
  apiKey: string
) {
  const variants = [
    { type: 'conservative', prompt: prompts.conservative },
    { type: 'standard', prompt: prompts.standard },
    { type: 'bold', prompt: prompts.bold }
  ];

  const proposals = [];

  // Get reference image URLs
  const referenceImageUrls = constraints.refImages
    ? constraints.refImages.map((img: any) => img.url).filter(Boolean)
    : [];

  console.log(`📸 Using ${referenceImageUrls.length} reference images for generation`);

  for (const variant of variants) {
    // Generate 2-3 images per variant
    for (let i = 0; i < 2; i++) {
      const seed = Math.floor(Math.random() * 1000000);
      
      // Build multimodal message content
      const messageContent: any[] = [];
      
      // Add reference image analysis instructions if images available
      if (referenceImageUrls.length > 0) {
        // Extract detailed palette information from analyzed images
        const paletteInfo = constraints.refImages.map((img: any, i: number) => {
          const paletteColors = img.palette?.colors || img.palette || [];
          const colorStr = Array.isArray(paletteColors) 
            ? paletteColors.map((c: any) => {
                const hex = c.hex || c.color || c;
                const ratio = c.ratio || 0.1;
                return `${hex} ${(ratio * 100).toFixed(0)}%`;
              }).join(', ')
            : 'not analyzed';
          return `Reference ${i + 1}: Colors (${colorStr}), Textures (${img.texture_tags?.join(', ') || 'smooth fondant'}), Density (${img.density || 'medium'})`;
        }).join('\n');
        
        messageContent.push({
          type: "text",
          text: `REFERENCE IMAGE ANALYSIS INSTRUCTIONS:
Study these reference images carefully and extract:

COLOR ANALYSIS:
${paletteInfo}
- Extract the EXACT color palette with proportions (hex codes and percentages)
- Match these colors PRECISELY in the generated design
- Palette lock is ${constraints.paletteLock >= 0.9 ? 'ACTIVE - colors must match exactly' : 'flexible - inspired by palette'}

TEXTURE ANALYSIS:
- Texture techniques: ${constraints.refImages[0]?.texture_tags?.join(', ') || 'smooth fondant'}
- Replicate these texture techniques in the generated design
- Note surface finishes: matte, satin, glossy, metallic

DENSITY ANALYSIS:
- Decoration density: ${constraints.refImages[0]?.density || 'medium'}
- Maintain similar density level in the generated design
- Note placement patterns and visual weight distribution

STYLE ANALYSIS:
- Overall aesthetic style and visual language
- Modern trending elements that would work well on Instagram and Pinterest
- Identify the seller's signature aesthetic

CRITICAL: The generated design must match the seller's signature style from these references while incorporating 2025 trends.`
        });
        
        // Add reference images
        for (const refUrl of referenceImageUrls.slice(0, 3)) {
          messageContent.push({
            type: "image_url",
            image_url: { url: refUrl }
          });
        }
        
        messageContent.push({
          type: "text",
          text: `GENERATION REQUIREMENTS:
Create a NEW, TREND-FORWARD cake design that:
1. Matches the visual style, color palette, and texture techniques from the reference images above

2. Incorporates 2025 trending elements:
   • Textured buttercream finishes (modern, organic textures)
   • Natural botanicals and fresh flower arrangements (eucalyptus, pampas grass, dried florals)
   • Contemporary color palettes:
     - Sage green + terracotta + cream
     - Dusty rose + champagne + gold
     - Muted lavender + grey + white
   • Geometric patterns and clean lines
   • Ombré gradients and watercolor effects
   • Wafer paper flowers and edible gold leaf accents
   • Sculptural elements and artistic brushstrokes
   • Minimalist negative space design

3. Creates an Instagram-worthy, Pinterest-pinnable design
4. Maintains commercial viability - achievable by a skilled baker
5. Preserves the seller's signature style while adding modern 2025 updates
6. Avoids outdated design elements from 2010s-2020s:
   ❌ Overly ornate traditional piping
   ❌ Dated color schemes (bright primary colors, pastel overload)
   ❌ Heavy fondant cascades
   ❌ Excessive sugar flowers covering entire tiers

Now generate the design based on this prompt:`
        });
      }
      
      // Add the actual prompt
      messageContent.push({
        type: "text",
        text: `${variant.prompt}\n\nNegative prompt: ${constraints.negativePrompt}`
      });
      
      // Generate image using Gemini with multimodal input
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image-preview',
          messages: [{
            role: 'user',
            content: messageContent  // ✅ Multimodal content with images
          }],
          modalities: ['image', 'text']
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const imageBase64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        
        if (imageBase64) {
          proposals.push({
            url: imageBase64,
            prompt: variant.prompt,
            variantType: variant.type,
            seed,
            stage: 1
          });
        }
      }
    }
  }

  return proposals;
}
