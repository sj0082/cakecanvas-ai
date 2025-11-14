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
      
      // Step 2: Generate embedding from the rich visual description
      const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: description,
          model: 'text-embedding-3-small',
        }),
      });

      if (!embeddingResponse.ok) {
        const errorText = await embeddingResponse.text();
        console.error('Embedding generation failed:', embeddingResponse.status, errorText);
        throw new Error(`Embedding generation failed: ${embeddingResponse.status}`);
      }

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;

      console.log(`✅ Generated ${embedding.length}-dimensional image embedding`);

      return new Response(
        JSON.stringify({ 
          embedding, 
          description,
          dimensions: embedding.length 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TEXT-based embeddings (fallback)
    console.log('📝 Generating text-based embedding');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Embedding API error:', response.status, errorText);
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;

    if (!embedding) {
      throw new Error('No embedding returned from API');
    }

    return new Response(
      JSON.stringify({ 
        embedding,
        dimensions: embedding.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating embedding:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
