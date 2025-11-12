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
    const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
    
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.warn(`[stylepack-sign-upload] [${requestId}] Missing Authorization header`);
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.warn(`[stylepack-sign-upload] [${requestId}] Invalid token`, authError);
      return new Response(JSON.stringify({ error: 'Invalid token', code: 'invalid_token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[stylepack-sign-upload] [${requestId}] Authenticated user:`, { id: user.id, email: user.email });

    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    console.log(`[stylepack-sign-upload] [${requestId}] has_role(admin):`, isAdmin);

    if (!isAdmin) {
      console.warn(`[stylepack-sign-upload] [${requestId}] Forbidden: admin role required`);
      return new Response(JSON.stringify({ error: 'Admin role required', code: 'forbidden_admin_required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { filename, contentType, size } = await req.json();
    console.log(`[stylepack-sign-upload] [${requestId}] Request body:`, { filename, contentType, size });

    if (!filename || !contentType || typeof size !== 'number') {
      console.warn(`[stylepack-sign-upload] [${requestId}] Missing fields in body`);
      return new Response(JSON.stringify({ error: 'Missing required fields', code: 'bad_request' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(contentType)) {
      console.warn(`[stylepack-sign-upload] [${requestId}] Invalid file type:`, contentType);
      return new Response(JSON.stringify({ error: 'Invalid file type. Allowed: jpg, png, webp', code: 'invalid_type' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (size > 20 * 1024 * 1024) {
      console.warn(`[stylepack-sign-upload] [${requestId}] File too large:`, size);
      return new Response(JSON.stringify({ error: 'File size exceeds 20MB limit', code: 'file_too_large' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const timestamp = Date.now();
    const randomStr = crypto.randomUUID().split('-')[0];
    const ext = filename.split('.').pop();
    const key = `${timestamp}-${randomStr}.${ext}`;

    const { data: signedData, error: signError } = await supabase
      .storage
      .from('stylepack-ref')
      .createSignedUploadUrl(key);

    if (signError) {
      console.error(`[stylepack-sign-upload] [${requestId}] Sign upload error:`, signError);
      return new Response(JSON.stringify({ error: 'Failed to create upload URL', code: 'sign_error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const publicUrl = supabase.storage
      .from('stylepack-ref')
      .getPublicUrl(key).data.publicUrl;

    console.log(`[stylepack-sign-upload] [${requestId}] Signed URL created successfully for key:`, key);

    return new Response(JSON.stringify({
      key,
      signedUrl: signedData.signedUrl,
      url: publicUrl,
      token: signedData.token,
      path: signedData.path
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const requestId = req.headers.get('x-request-id') || 'unknown';
    console.error(`[stylepack-sign-upload] [${requestId}] Internal error:`, error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'internal_error'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});