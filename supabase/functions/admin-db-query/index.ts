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
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { operation, table, data, filters } = await req.json();

    console.log(`🔧 Admin DB Operation: ${operation} on ${table}`);

    let result;

    switch (operation) {
      case 'select':
        // SELECT with optional filters
        let query = supabase.from(table).select(data?.select || '*');
        
        if (filters) {
          // Apply filters safely using Supabase query builder
          if (filters.eq) {
            Object.entries(filters.eq).forEach(([key, value]) => {
              query = query.eq(key, value);
            });
          }
          if (filters.gt) {
            Object.entries(filters.gt).forEach(([key, value]) => {
              query = query.gt(key, value);
            });
          }
          if (filters.lt) {
            Object.entries(filters.lt).forEach(([key, value]) => {
              query = query.lt(key, value);
            });
          }
          if (filters.limit) {
            query = query.limit(filters.limit);
          }
          if (filters.order) {
            query = query.order(filters.order.column, { ascending: filters.order.ascending ?? true });
          }
        }
        
        result = await query;
        break;

      case 'insert':
        // INSERT
        result = await supabase.from(table).insert(data);
        break;

      case 'update':
        // UPDATE with filters
        let updateQuery = supabase.from(table).update(data);
        
        if (filters?.eq) {
          Object.entries(filters.eq).forEach(([key, value]) => {
            updateQuery = updateQuery.eq(key, value);
          });
        }
        
        result = await updateQuery;
        break;

      case 'delete':
        // DELETE with filters
        let deleteQuery = supabase.from(table).delete();
        
        if (filters?.eq) {
          Object.entries(filters.eq).forEach(([key, value]) => {
            deleteQuery = deleteQuery.eq(key, value);
          });
        }
        
        result = await deleteQuery;
        break;

      case 'count':
        // COUNT rows
        result = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        break;

      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }

    if (result.error) {
      console.error('❌ Database error:', result.error);
      throw result.error;
    }

    console.log(`✅ Operation completed successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        data: result.data,
        count: result.count,
        operation,
        table
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Error in admin-db-query:', error);
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
