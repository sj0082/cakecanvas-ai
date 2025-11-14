import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tiersSpec, outputFormat = 'svg' } = await req.json();

    if (!tiersSpec || !tiersSpec.tiers || !tiersSpec.diameter_cm || !tiersSpec.height_cm) {
      return new Response(
        JSON.stringify({ error: 'Invalid tiersSpec format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tiers, diameter_cm, height_cm } = tiersSpec;

    // Generate SVG layout mask
    const svgWidth = 800;
    const svgHeight = 1000;
    const maxDiameter = Math.max(...diameter_cm);
    const scale = (svgWidth * 0.8) / maxDiameter; // 80% of width for max diameter

    let yOffset = svgHeight - 50; // Start from bottom
    let svgContent = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;
    svgContent += `<rect width="100%" height="100%" fill="black"/>`;

    // Draw each tier from bottom to top
    for (let i = 0; i < tiers; i++) {
      const diameter = diameter_cm[i];
      const height = height_cm[i];
      const radius = (diameter * scale) / 2;
      const tierHeight = height * scale;

      const x = svgWidth / 2 - radius;
      const y = yOffset - tierHeight;

      // Draw tier as white ellipse (top view) and rectangle (side view)
      svgContent += `<ellipse cx="${svgWidth / 2}" cy="${y}" rx="${radius}" ry="${radius * 0.3}" fill="white"/>`;
      svgContent += `<rect x="${x}" y="${y}" width="${radius * 2}" height="${tierHeight}" fill="white"/>`;
      svgContent += `<ellipse cx="${svgWidth / 2}" cy="${y + tierHeight}" rx="${radius}" ry="${radius * 0.3}" fill="white"/>`;

      yOffset = y;
    }

    svgContent += `</svg>`;

    if (outputFormat === 'svg') {
      // Return SVG directly
      return new Response(svgContent, {
        headers: { ...corsHeaders, 'Content-Type': 'image/svg+xml' },
      });
    } else {
      // Save to Supabase Storage
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const fileName = `layout-masks/${Date.now()}-${tiers}tier.svg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('stylepack-ref')
        .upload(fileName, svgContent, {
          contentType: 'image/svg+xml',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('stylepack-ref')
        .getPublicUrl(fileName);

      return new Response(
        JSON.stringify({
          maskUrl: urlData.publicUrl,
          tiersSpec,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error generating layout mask:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
