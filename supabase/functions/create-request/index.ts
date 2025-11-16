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
        parsed_slots: requestBody.parsed_slots || null,
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

    // Trigger generate-proposals as a background task (fire and forget)
    const generateUrl = `${supabaseUrl}/functions/v1/generate-proposals`;
    console.log('Triggering generate-proposals for request:', data.id);
    
    fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ requestId: data.id })
    })
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to trigger generate-proposals:', response.status, errorText);
      } else {
        console.log('Successfully triggered generate-proposals for request:', data.id);
      }
    })
    .catch(error => {
      console.error('Error triggering generate-proposals:', error);
    });

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
