import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestBody = await req.json();
    console.log('Creating request with data:', { 
      ...requestBody, 
      contact_email: requestBody.contact_email ? '[REDACTED]' : undefined,
      contact_phone: requestBody.contact_phone ? '[REDACTED]' : undefined 
    });

    // Validate required fields
    if (!requestBody.size_category_id || !requestBody.stylepack_id || !requestBody.contact_email) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: size_category_id, stylepack_id, contact_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate access token
    const accessToken = crypto.randomUUID();

    // Insert request using service role (bypasses RLS)
    const { data, error } = await supabase
      .from('requests')
      .insert({
        size_category_id: requestBody.size_category_id,
        stylepack_id: requestBody.stylepack_id,
        user_text: requestBody.user_text || null,
        user_images: requestBody.user_images || null,
        contact_email: requestBody.contact_email,
        contact_phone: requestBody.contact_phone || null,
        status: requestBody.status || 'GENERATING',
        access_token: accessToken,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create request', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Request created successfully:', data.id);

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-request function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
