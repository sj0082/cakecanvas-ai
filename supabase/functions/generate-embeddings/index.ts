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
    const { imageUrl, text, type = 'text' } = await req.json();

    if (!imageUrl && !text) {
      return new Response(
        JSON.stringify({ error: 'Either imageUrl or text must be provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // For IMAGE embeddings: Use vision model to analyze then generate embedding
    if (imageUrl) {
      console.log('🖼️ Generating IMAGE-based embedding for:', imageUrl);
      
      // Step 1: Use vision model to extract detailed visual features
      const visionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Describe this cake image in comprehensive detail for similarity matching. Focus on: visual style, color palette composition, texture types (smooth/textured/ruffled), decoration density (minimal/moderate/elaborate), tier structure, decorative elements, overall aesthetic mood, and artistic techniques used. Be very specific and descriptive.'
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }],
          max_tokens: 600
        }),
      });

      if (!visionResponse.ok) {
        const errorText = await visionResponse.text();
        console.error('Vision analysis failed:', visionResponse.status, errorText);
        throw new Error(`Vision analysis failed: ${visionResponse.status}`);
      }

      const visionData = await visionResponse.json();
      const description = visionData.choices[0].message.content;
      console.log('📝 Generated visual description:', description.substring(0, 200) + '...');
      
      // Return description without embedding (Lovable AI doesn't support text-embedding models)
      // The description itself will be used for similarity matching
      console.log('⚠️ Note: Returning description only (embedding generation skipped)');

      return new Response(
        JSON.stringify({ 
          embedding: null, // No embedding available
          description,
          dimensions: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TEXT-based embeddings (fallback - also disabled)
    console.log('📝 Text-based embedding requested (skipping - not supported)');
    
    return new Response(
      JSON.stringify({ 
        embedding: null,
        description: text || '',
        dimensions: 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-embeddings:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

