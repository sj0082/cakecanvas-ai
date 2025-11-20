import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    console.log('🚀 Starting full data export...');

    // 모든 테이블 목록 (외래 키 순서 고려)
    const tables = [
      'allowed_admin_emails',
      'profiles',
      'user_roles',
      'size_categories',
      'stylepacks', // parent_id가 있으므로 먼저
      'stylepack_ref_images',
      'rules_reality',
      'trend_categories',
      'trend_sources',
      'trend_keywords',
      'trend_images',
      'trend_stylepack_mappings',
      'trend_image_stylepack_mappings',
      'requests',
      'proposals',
      'stage1_cache',
      'logs_audit',
    ];

    const exportData: Record<string, any[]> = {};
    const metadata: Record<string, any> = {};

    for (const table of tables) {
      console.log(`📦 Exporting ${table}...`);
      
      try {
        const { data, error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact' });

        if (error) {
          console.error(`❌ Error exporting ${table}:`, error);
          metadata[table] = { error: error.message, count: 0 };
          exportData[table] = [];
        } else {
          exportData[table] = data || [];
          metadata[table] = { 
            count: count || 0, 
            exported: (data || []).length,
            success: true 
          };
          console.log(`✅ ${table}: ${data?.length || 0} rows`);
        }
      } catch (err) {
        console.error(`❌ Exception exporting ${table}:`, err);
        metadata[table] = { error: String(err), count: 0 };
        exportData[table] = [];
      }
    }

    const exportPayload = {
      metadata: {
        exportedAt: new Date().toISOString(),
        projectId: Deno.env.get('SUPABASE_PROJECT_ID'),
        tables: metadata,
        totalTables: tables.length,
      },
      data: exportData,
    };

    console.log('✅ Export completed successfully');

    return new Response(
      JSON.stringify(exportPayload, null, 2),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="lovable-export-${Date.now()}.json"`
        },
      }
    );

  } catch (error) {
    console.error('❌ Fatal error in export-all-data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
