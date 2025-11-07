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

    const url = new URL(req.url);
    const requestId = url.searchParams.get('requestId');
    const accessToken = url.searchParams.get('token');

    console.log('Fetching request:', { requestId, hasToken: !!accessToken });

    // Validate required parameters
    if (!requestId || !accessToken) {
      console.error('Missing required parameters');
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: requestId and token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch request with token validation using service role (bypasses RLS)
    const { data: requestData, error: requestError } = await supabase
      .from('requests')
      .select('*')
      .eq('id', requestId)
      .eq('access_token', accessToken)
      .single();

    if (requestError || !requestData) {
      console.error('Invalid token or request not found:', requestError);
      return new Response(
        JSON.stringify({ error: 'Invalid access token or request not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Request found, fetching proposals');

    // Fetch proposals for this request
    const { data: proposalsData, error: proposalsError } = await supabase
      .from('proposals')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at');

    if (proposalsError) {
      console.error('Error fetching proposals:', proposalsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch proposals', details: proposalsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Request fetched successfully:', { requestId, proposalsCount: proposalsData?.length || 0 });

    // Combine request and proposals
    const response = {
      ...requestData,
      proposals: proposalsData || []
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-request function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
