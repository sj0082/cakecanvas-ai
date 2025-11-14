import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface CompatibilityResult {
  compatible: boolean;
  confidence: number;  // 0-1
  conflicts: Array<{
    type: 'palette' | 'keyword' | 'density' | 'technique';
    severity: 'low' | 'medium' | 'high';
    description: string;
    suggestion: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stylepackId, userIntent } = await req.json();

    if (!stylepackId || !userIntent) {
      return new Response(
        JSON.stringify({ error: 'stylepackId and userIntent required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch stylepack details
    const { data: stylepack, error: stylepackError } = await supabase
      .from('stylepacks')
      .select('*')
      .eq('id', stylepackId)
      .single();

    if (stylepackError || !stylepack) {
      return new Response(
        JSON.stringify({ error: 'StylePack not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Checking style compatibility for:', stylepack.name);

    const conflicts: CompatibilityResult['conflicts'] = [];

    // 1. PALETTE CONFLICT DETECTION
    if (userIntent.colors && userIntent.colors.length > 0 && stylepack.palette_range) {
      console.log('🎨 Checking palette compatibility...');
      
      const targetPalette = Array.isArray(stylepack.palette_range) 
        ? stylepack.palette_range 
        : (stylepack.palette_range.primary || []);
      
      if (targetPalette.length > 0) {
        const requestedHexColors = extractColorHexCodes(userIntent.colors);
        const paletteHexCodes = targetPalette.map((p: any) => p.hex || p);
        
        const mismatches = requestedHexColors.filter(requestedColor => {
          const hasMatch = paletteHexCodes.some((paletteColor: string) => 
            colorDistance(requestedColor, paletteColor) < 50
          );
          return !hasMatch;
        });

        if (mismatches.length > 0) {
          const alternatives = paletteHexCodes.slice(0, 3).join(', ');
          conflicts.push({
            type: 'palette',
            severity: 'high',
            description: `Requested colors (${mismatches.join(', ')}) don't match style palette`,
            suggestion: `Consider using these colors from the style: ${alternatives}`
          });
        }
      }
    }

    // 2. KEYWORD CONFLICT DETECTION (banned terms)
    if (stylepack.banned_terms && stylepack.banned_terms.length > 0) {
      console.log('🚫 Checking for banned terms...');
      
      const userTextLower = userIntent.text.toLowerCase();
      const bannedMatches = stylepack.banned_terms.filter((term: string) => 
        userTextLower.includes(term.toLowerCase())
      );

      if (bannedMatches.length > 0) {
        conflicts.push({
          type: 'keyword',
          severity: 'high',
          description: `Banned terms detected: ${bannedMatches.join(', ')}`,
          suggestion: 'Remove these terms or choose a different style pack'
        });
      }
    }

    // 3. DENSITY CONFLICT DETECTION
    const userDensity = inferDensityFromText(userIntent.text);
    const styleDensity = stylepack.reference_stats?.avg_density;

    if (userDensity && styleDensity && userDensity !== styleDensity) {
      console.log(`⚠️ Density mismatch: user prefers ${userDensity}, style is ${styleDensity}`);
      
      const severityMap: Record<string, 'low' | 'medium' | 'high'> = {
        'low-high': 'high',
        'high-low': 'high',
        'low-mid': 'medium',
        'mid-low': 'medium',
        'mid-high': 'medium',
        'high-mid': 'medium'
      };
      
      const severity = severityMap[`${userDensity}-${styleDensity}`] || 'low';
      
      conflicts.push({
        type: 'density',
        severity,
        description: `User prefers ${userDensity} decoration density but style is ${styleDensity}`,
        suggestion: `Adjust your description to match ${styleDensity} density style, or choose a ${userDensity} density style pack`
      });
    }

    // 4. STYLE EMBEDDING SIMILARITY (if inspiration images provided)
    if (userIntent.inspirationImages && userIntent.inspirationImages.length > 0) {
      console.log('🖼️ Checking inspiration image similarity...');
      
      // Fetch stylepack reference images with embeddings
      const { data: refImages } = await supabase
        .from('stylepack_ref_images')
        .select('embedding')
        .eq('stylepack_id', stylepackId)
        .not('embedding', 'is', null)
        .limit(3);

      if (refImages && refImages.length > 0) {
        // For now, log that we'd compare embeddings
        // In full implementation, would generate embeddings for inspiration images
        // and calculate cosine similarity
        console.log(`Would compare ${userIntent.inspirationImages.length} inspiration images with ${refImages.length} reference images`);
        
        // Placeholder: assume moderate similarity
        const similarity = 0.5; // Would be calculated from actual embeddings
        
        if (similarity < 0.3) {
          conflicts.push({
            type: 'technique',
            severity: 'medium',
            description: `Inspiration images don't match style pack visual style (similarity: ${(similarity * 100).toFixed(0)}%)`,
            suggestion: 'Try a different style pack or remove inspiration images to let the style guide the design'
          });
        }
      }
    }

    // Calculate overall compatibility
    const compatible = conflicts.length === 0 || conflicts.every(c => c.severity === 'low');
    
    // Calculate confidence score
    let confidencePenalty = 0;
    for (const conflict of conflicts) {
      if (conflict.severity === 'high') confidencePenalty += 0.3;
      else if (conflict.severity === 'medium') confidencePenalty += 0.15;
      else confidencePenalty += 0.05;
    }
    
    const confidence = Math.max(0, 1 - confidencePenalty);

    const result: CompatibilityResult = {
      compatible,
      confidence,
      conflicts
    };

    console.log(`✅ Compatibility check complete: ${(confidence * 100).toFixed(0)}% (${conflicts.length} conflicts)`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-style-compatibility:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper functions

function extractColorHexCodes(colors: string[]): string[] {
  const colorMap: Record<string, string> = {
    'red': '#FF0000', 'blue': '#0000FF', 'green': '#00FF00',
    'yellow': '#FFFF00', 'orange': '#FFA500', 'purple': '#800080',
    'pink': '#FFC0CB', 'white': '#FFFFFF', 'black': '#000000',
    'gold': '#FFD700', 'silver': '#C0C0C0', 'brown': '#A52A2A'
  };
  
  return colors.map(color => {
    const lower = color.toLowerCase();
    return colorMap[lower] || color; // Return hex if already hex, or map from name
  }).filter(c => c.startsWith('#'));
}

function colorDistance(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  
  const rDiff = rgb1.r - rgb2.r;
  const gDiff = rgb1.g - rgb2.g;
  const bDiff = rgb1.b - rgb2.b;
  
  return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff) * 100;
}

function hexToRgb(hex: string): {r: number; g: number; b: number} {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return {r: 0, g: 0, b: 0};
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}

function inferDensityFromText(text: string): 'low' | 'mid' | 'high' | null {
  const lowerText = text.toLowerCase();
  
  const lowKeywords = ['minimal', 'simple', 'clean', 'understated', 'subtle'];
  const highKeywords = ['elaborate', 'detailed', 'intricate', 'ornate', 'decorated', 'complex'];
  
  const hasLow = lowKeywords.some(kw => lowerText.includes(kw));
  const hasHigh = highKeywords.some(kw => lowerText.includes(kw));
  
  if (hasHigh && !hasLow) return 'high';
  if (hasLow && !hasHigh) return 'low';
  return 'mid'; // Default to medium if unclear
}
