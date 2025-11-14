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
    const { query, limit = 10 } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query text or image URL required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate embedding for query
    const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke(
      'generate-embeddings',
      { body: { text: query } }
    );

    if (embeddingError) {
      throw embeddingError;
    }

    const queryEmbedding = embeddingData.embedding;

    // Search for similar images using cosine similarity
    // Note: This requires pgvector extension and proper indexing
    const { data: similarImages, error: searchError } = await supabase.rpc(
      'search_similar_ref_images',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: limit,
      }
    );

    if (searchError) {
      console.error('Search error:', searchError);
      // Fallback: return random sample if vector search not available
      const { data: fallbackImages } = await supabase
        .from('stylepack_ref_images')
        .select('id, stylepack_id, url, palette, texture_tags, density')
        .limit(limit);

      return new Response(
        JSON.stringify({ 
          results: fallbackImages || [],
          fallback: true,
          message: 'Vector search not available, returning random sample'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        results: similarImages,
        query: query
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error searching similar styles:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
