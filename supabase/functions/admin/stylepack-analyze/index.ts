import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrls } = await req.json();

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return new Response(JSON.stringify({ error: 'imageUrls array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const analysisPrompt = `Analyze these cake design reference images and extract:
1. Color palette: List 5-7 dominant colors in hex format with HSL values
2. Textures & techniques: Identify decoration styles (rosette, wave, semi-naked, metallic, sugar flowers, smooth fondant, buttercream, etc.)
3. Safety flags: Check for inappropriate elements (anime, cartoon characters, logos, trademarks, toys, plastic-looking, impossible structures)

Return JSON format:
{
  "palette": [{"hex": "#FFFFFF", "hsl": [0,0,100], "name": "white"}],
  "textures": ["rosette", "metallic"],
  "techniques": ["piping", "fondant"],
  "safety": {
    "hasBannedContent": false,
    "flags": [],
    "confidence": 0.95
  }
}`;

    const messages: any[] = [
      { role: "system", content: "You are a cake design analysis expert. Return only valid JSON." },
      { role: "user", content: analysisPrompt }
    ];

    for (const url of imageUrls.slice(0, 5)) {
      messages.push({
        role: "user",
        content: [
          { type: "image_url", image_url: { url } }
        ]
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      return new Response(JSON.stringify({
        palette: [],
        textures: [],
        techniques: [],
        safety: { hasBannedContent: false, flags: [], confidence: 0.5 },
        note: 'AI analysis unavailable, using defaults'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiData = await response.json();
    const content = aiData.choices[0].message.content;
    const analysis = typeof content === 'string' ? JSON.parse(content) : content;

    console.log('Analysis completed:', {
      paletteCount: analysis.palette?.length || 0,
      texturesCount: analysis.textures?.length || 0,
      hasSafetyFlags: analysis.safety?.hasBannedContent || false
    });

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in stylepack-analyze:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Analysis failed',
      palette: [],
      textures: [],
      techniques: [],
      safety: { hasBannedContent: false, flags: [], confidence: 0 }
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
