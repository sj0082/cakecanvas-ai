import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

// CORS whitelist
const getAllowedOrigins = (): string[] => {
  const originsEnv = Deno.env.get('ALLOWED_ORIGINS') || '';
  return originsEnv.split(',').map(o => o.trim()).filter(Boolean);
};

const getCorsHeaders = (origin: string | null): Record<string, string> => {
  const allowedOrigins = getAllowedOrigins();
  const isAllowed = origin && allowedOrigins.some(allowed => 
    origin === allowed || origin.endsWith(allowed.replace('*', ''))
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0] || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
    'Vary': 'Origin'
  };
};

// Magic number validation
const validateMagicNumber = (magicBase64: string, declaredType: string): boolean => {
  try {
    const bytes = Uint8Array.from(atob(magicBase64), c => c.charCodeAt(0));
    
    // JPEG: FF D8 FF
    if (declaredType === 'image/jpeg' || declaredType === 'image/jpg') {
      return bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
    }
    
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (declaredType === 'image/png') {
      return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
    }
    
    // WebP: 52 49 46 46 ... 57 45 42 50
    if (declaredType === 'image/webp') {
      return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
             bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    }
    
    return false;
  } catch {
    return false;
  }
};

// Rate limiting (in-memory, per-instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60000; // 1 minute

const checkRateLimit = (key: string): boolean => {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
};

// Sanitize filename
const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[/\\]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 100);
};

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
    
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.warn(`[stylepack-sign-upload] [${requestId}] Missing Authorization header`);
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), {
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
      return new Response(JSON.stringify({ error: 'Invalid token', code: 'UNAUTHORIZED' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.debug(`[stylepack-sign-upload] [${requestId}] Authenticated user:`, { id: user.id, email: user.email });

    // Check admin role
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    console.debug(`[stylepack-sign-upload] [${requestId}] has_role(admin):`, isAdmin);

    if (!isAdmin) {
      console.warn(`[stylepack-sign-upload] [${requestId}] Forbidden: admin role required`);
      return new Response(JSON.stringify({ error: 'Admin role required', code: 'FORBIDDEN' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Rate limiting
    const rateLimitKey = `${user.id}:${req.headers.get('x-forwarded-for') || 'unknown'}`;
    if (!checkRateLimit(rateLimitKey)) {
      console.warn(`[stylepack-sign-upload] [${requestId}] Rate limited:`, rateLimitKey);
      return new Response(JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const { filename, contentType, size, stylepackId, magicBase64 } = await req.json();
    console.debug(`[stylepack-sign-upload] [${requestId}] Request body:`, { filename, contentType, size, stylepackId });

    // Validate required fields
    if (!filename || !contentType || typeof size !== 'number' || !stylepackId) {
      console.warn(`[stylepack-sign-upload] [${requestId}] Missing fields in body`);
      return new Response(JSON.stringify({ error: 'Missing required fields', code: 'BAD_REQUEST' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate MIME type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(contentType)) {
      console.warn(`[stylepack-sign-upload] [${requestId}] Invalid file type:`, contentType);
      return new Response(JSON.stringify({ error: 'Invalid file type. Use JPG/PNG/WebP', code: 'INVALID_TYPE' }), {
        status: 415, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Magic number validation
    if (magicBase64 && !validateMagicNumber(magicBase64, contentType)) {
      console.warn(`[stylepack-sign-upload] [${requestId}] Magic number mismatch for:`, contentType);
      return new Response(JSON.stringify({ error: 'File content does not match declared type', code: 'INVALID_TYPE' }), {
        status: 415, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate size
    const maxUploadMB = parseInt(Deno.env.get('MAX_UPLOAD_MB') || '20');
    if (size > maxUploadMB * 1024 * 1024) {
      console.warn(`[stylepack-sign-upload] [${requestId}] File too large:`, size);
      return new Response(JSON.stringify({ error: `File exceeds ${maxUploadMB}MB limit`, code: 'FILE_TOO_LARGE' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate key path: org/default/stylepacks/{id}/ref/{yyyy}/{MM}/{dd}/{uuid}-{filename}
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const MM = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const uuid = crypto.randomUUID();
    const sanitized = sanitizeFilename(filename);
    const key = `org/default/stylepacks/${stylepackId}/ref/${yyyy}/${MM}/${dd}/${uuid}-${sanitized}`;

    // Create signed upload URL
    const { data: signedData, error: signError } = await supabase
      .storage
      .from('stylepack-ref')
      .createSignedUploadUrl(key);

    if (signError) {
      console.error(`[stylepack-sign-upload] [${requestId}] Sign upload error:`, signError);
      return new Response(JSON.stringify({ error: 'Failed to create upload URL', code: 'SIGN_ERROR' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const publicUrl = supabase.storage
      .from('stylepack-ref')
      .getPublicUrl(key).data.publicUrl;

    console.debug(`[stylepack-sign-upload] [${requestId}] Signed URL created successfully for key:`, key);

    return new Response(JSON.stringify({
      key,
      path: signedData.path,
      token: signedData.token,
      signedUrl: signedData.signedUrl,
      url: publicUrl,
      maxAge: 600
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);
    const requestId = req.headers.get('x-request-id') || 'unknown';
    console.error(`[stylepack-sign-upload] [${requestId}] Internal error:`, error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});