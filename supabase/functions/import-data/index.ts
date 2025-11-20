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
    const { targetUrl, targetKey, exportData, skipExisting = false } = await req.json();

    if (!targetUrl || !targetKey || !exportData) {
      throw new Error('Missing required parameters: targetUrl, targetKey, exportData');
    }

    console.log('🚀 Starting data import to target Supabase...');
    console.log(`📍 Target URL: ${targetUrl}`);

    // 타겟 Supabase 클라이언트 생성
    const targetSupabase = createClient(targetUrl, targetKey);

    const results: Record<string, any> = {};
    const tables = Object.keys(exportData.data || exportData);
    
    console.log(`📦 Importing ${tables.length} tables...`);

    for (const table of tables) {
      const rows = exportData.data ? exportData.data[table] : exportData[table];
      
      if (!rows || rows.length === 0) {
        console.log(`⏭️  Skipping ${table} (no data)`);
        results[table] = { skipped: true, reason: 'no data' };
        continue;
      }

      console.log(`📥 Importing ${table} (${rows.length} rows)...`);

      try {
        let imported = 0;
        let errors = 0;
        const errorMessages: string[] = [];

        // 배치 크기 (한 번에 100개씩)
        const batchSize = 100;
        
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          
          try {
            if (skipExisting) {
              // upsert 사용
              const { error } = await targetSupabase
                .from(table)
                .upsert(batch, { onConflict: 'id' });

              if (error) {
                errors += batch.length;
                errorMessages.push(`Batch ${i}-${i + batch.length}: ${error.message}`);
              } else {
                imported += batch.length;
              }
            } else {
              // insert 사용
              const { error } = await targetSupabase
                .from(table)
                .insert(batch);

              if (error) {
                errors += batch.length;
                errorMessages.push(`Batch ${i}-${i + batch.length}: ${error.message}`);
              } else {
                imported += batch.length;
              }
            }
          } catch (err) {
            errors += batch.length;
            errorMessages.push(`Batch ${i}-${i + batch.length}: ${String(err)}`);
          }
        }

        results[table] = {
          total: rows.length,
          imported,
          errors,
          success: errors === 0,
          errorMessages: errorMessages.length > 0 ? errorMessages.slice(0, 5) : undefined, // 최대 5개만
        };

        if (errors === 0) {
          console.log(`✅ ${table}: ${imported}/${rows.length} rows imported`);
        } else {
          console.log(`⚠️  ${table}: ${imported}/${rows.length} imported, ${errors} errors`);
        }

      } catch (err) {
        console.error(`❌ Error importing ${table}:`, err);
        results[table] = {
          total: rows.length,
          imported: 0,
          errors: rows.length,
          success: false,
          error: String(err),
        };
      }
    }

    const summary = {
      totalTables: tables.length,
      successful: Object.values(results).filter((r: any) => r.success).length,
      failed: Object.values(results).filter((r: any) => !r.success && !r.skipped).length,
      skipped: Object.values(results).filter((r: any) => r.skipped).length,
    };

    console.log('✅ Import completed');
    console.log(`📊 Summary: ${summary.successful} successful, ${summary.failed} failed, ${summary.skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        results,
        importedAt: new Date().toISOString(),
      }, null, 2),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Fatal error in import-data:', error);
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
