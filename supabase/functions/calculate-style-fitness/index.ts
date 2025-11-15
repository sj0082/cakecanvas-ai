import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface FitnessScores {
  consistency: number;
  palette_drift: number;
  layout_fit: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  const minLength = Math.min(a.length, b.length);
  for (let i = 0; i < minLength; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function calculatePaletteDrift(palettes: any[]): number {
  if (palettes.length < 2) return 0;
  
  // Extract all colors from all palettes
  const allColors: string[] = [];
  palettes.forEach(palette => {
    if (Array.isArray(palette)) {
      palette.forEach(color => {
        if (typeof color === 'object' && color.hex) {
          allColors.push(color.hex);
        }
      });
    }
  });
  
  if (allColors.length === 0) return 0;
  
  // Calculate color frequency consistency (simple heuristic)
  const colorCounts = new Map<string, number>();
  allColors.forEach(color => {
    colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
  });
  
  // Drift is inversely related to color consistency
  const maxCount = Math.max(...colorCounts.values());
  const avgCount = allColors.length / colorCounts.size;
  const drift = 1 - (avgCount / maxCount);
  
  return Math.max(0, Math.min(1, drift));
}

function mode<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  
  const counts = new Map<T, number>();
  arr.forEach(item => counts.set(item, (counts.get(item) || 0) + 1));
  
  let maxCount = 0;
  let modeValue: T | null = null;
  
  counts.forEach((count, value) => {
    if (count > maxCount) {
      maxCount = count;
      modeValue = value;
    }
  });
  
  return modeValue;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stylepackId } = await req.json();

    if (!stylepackId) {
      throw new Error('stylepackId is required');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch reference images for this stylepack
    const { data: refImages, error: refError } = await supabase
      .from('stylepack_ref_images')
      .select('palette, texture_tags, density, embedding')
      .eq('stylepack_id', stylepackId);

    if (refError) {
      throw new Error(`Failed to fetch reference images: ${refError.message}`);
    }

    // Phase 4.2: Detailed error messages for insufficient reference images
    if (!refImages || refImages.length < 2) {
      return new Response(
        JSON.stringify({
          error: 'INSUFFICIENT_REFERENCE_IMAGES',
          message: '최소 2개의 참조 이미지가 필요합니다',
          details: `현재 ${refImages?.length || 0}개의 이미지가 분석되었습니다. 먼저 이미지를 업로드하고 Auto-Analyze를 실행해주세요.`,
          refImageCount: refImages?.length || 0,
          requiredCount: 2
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate embeddings exist
    const validEmbeddings = refImages.filter(img => img.embedding);
    if (validEmbeddings.length < 2) {
      return new Response(
        JSON.stringify({
          error: 'MISSING_EMBEDDINGS',
          message: 'Embedding 데이터가 부족합니다',
          details: `${refImages.length}개의 이미지 중 ${validEmbeddings.length}개만 분석되었습니다. Auto-Analyze를 실행해주세요.`,
          totalImages: refImages.length,
          analyzedImages: validEmbeddings.length
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Calculating fitness for stylepack ${stylepackId} with ${refImages.length} reference images`);

    // 1. Consistency: Average cosine similarity between embeddings
    const embeddings = refImages
      .filter(img => img.embedding)
      .map(img => {
        // Parse embedding if it's a string
        if (typeof img.embedding === 'string') {
          return JSON.parse(img.embedding);
        }
        return img.embedding;
      });

    let consistency = 0;
    if (embeddings.length >= 2) {
      let totalSimilarity = 0;
      let comparisons = 0;
      
      for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
          totalSimilarity += cosineSimilarity(embeddings[i], embeddings[j]);
          comparisons++;
        }
      }
      
      consistency = comparisons > 0 ? totalSimilarity / comparisons : 0;
    }

    // 2. Palette Drift: Color consistency across images
    const palettes = refImages
      .filter(img => img.palette)
      .map(img => img.palette);
    
    const palette_drift = calculatePaletteDrift(palettes);

    // 3. Layout Fit: Density consistency
    const densities = refImages
      .filter(img => img.density)
      .map(img => img.density);
    
    let layout_fit = 0;
    if (densities.length > 0) {
      const densityMode = mode(densities);
      if (densityMode) {
        layout_fit = densities.filter(d => d === densityMode).length / densities.length;
      }
    }

    const fitnessScores: FitnessScores = {
      consistency: Math.max(0, Math.min(1, consistency)),
      palette_drift: Math.max(0, Math.min(1, palette_drift)),
      layout_fit: Math.max(0, Math.min(1, layout_fit))
    };

    console.log('Calculated fitness scores:', fitnessScores);

    // Update the stylepack with fitness scores
    const { error: updateError } = await supabase
      .from('stylepacks')
      .update({ fitness_scores: fitnessScores })
      .eq('id', stylepackId);

    if (updateError) {
      console.error('Failed to update fitness scores:', updateError);
      throw new Error(`Failed to update fitness scores: ${updateError.message}`);
    }

    console.log('✅ Fitness scores updated successfully');

    return new Response(
      JSON.stringify({ success: true, fitnessScores }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in calculate-style-fitness:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to calculate style fitness'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
