import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { requestId, proposalId, accessToken } = await req.json();

    if (!requestId || !proposalId || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📋 Processing QuickBooks estimate request:', { requestId, proposalId });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify access token and fetch request with proposals
    const { data: request, error: requestError } = await supabase
      .from('requests')
      .select('*, proposals!inner(*)')
      .eq('id', requestId)
      .eq('access_token', accessToken)
      .single();

    if (requestError || !request) {
      console.error('❌ Invalid request or access token:', requestError);
      return new Response(
        JSON.stringify({ error: 'Invalid request or access token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const proposal = (request.proposals as any[]).find((p: any) => p.id === proposalId);
    if (!proposal) {
      console.error('❌ Proposal not found:', proposalId);
      return new Response(
        JSON.stringify({ error: 'Proposal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // QuickBooks OAuth token (from environment variables)
    const QBO_ACCESS_TOKEN = Deno.env.get('QBO_ACCESS_TOKEN');
    const QBO_REALM_ID = Deno.env.get('QBO_REALM_ID');
    const QBO_CAKE_ITEM_ID = Deno.env.get('QBO_CAKE_ITEM_ID');
    const QBO_ENVIRONMENT = Deno.env.get('QBO_ENVIRONMENT') || 'sandbox';

    if (!QBO_ACCESS_TOKEN || !QBO_REALM_ID || !QBO_CAKE_ITEM_ID) {
      console.error('❌ QuickBooks credentials not configured');
      return new Response(
        JSON.stringify({ error: 'QuickBooks integration not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔐 QuickBooks credentials found, creating estimate...');

    // Step 1: Get or create customer in QuickBooks
    const customerId = await getOrCreateCustomer(request, QBO_ACCESS_TOKEN, QBO_REALM_ID, QBO_ENVIRONMENT);
    console.log('✅ Customer ID:', customerId);

    // Step 2: Create Estimate in QuickBooks
    const baseUrl = QBO_ENVIRONMENT === 'production' 
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
    
    const QBO_API_URL = `${baseUrl}/v3/company/${QBO_REALM_ID}/estimate`;
    
    // Format design requirements for description
    let designDescription = '';
    if (request.parsed_slots) {
      designDescription = formatDesignRequirements(request.parsed_slots);
    } else if (request.user_text) {
      designDescription = request.user_text;
    }
    
    const estimateData = {
      Line: [
        {
          DetailType: 'SalesItemLineDetail',
          Amount: proposal.price_range_max,
          SalesItemLineDetail: {
            ItemRef: {
              value: QBO_CAKE_ITEM_ID
            },
            Qty: 1,
            UnitPrice: proposal.price_range_max
          },
          Description: `Custom Cake Design - ${proposal.variant}

Design Requirements:
${designDescription}

${request.customer_notes ? `Customer Notes:\n${request.customer_notes}\n\n` : ''}Selected Design Image: ${proposal.image_url}`
        }
      ],
      CustomerRef: {
        value: customerId,
        name: request.contact_name
      },
      TxnDate: new Date().toISOString().split('T')[0],
      DueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      PrivateNote: `Request ID: ${requestId}\nProposal ID: ${proposalId}${request.customer_notes ? `\nCustomer Notes: ${request.customer_notes}` : ''}`,
      CustomerMemo: {
        value: 'Thank you for your custom cake design request. We will review your selected design and send you a detailed quote via email.'
      },
      DocNumber: `CAKE-${requestId.substring(0, 8)}`
    };

    console.log('📤 Sending estimate to QuickBooks...');

    const qboResponse = await fetch(QBO_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${QBO_ACCESS_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(estimateData)
    });

    if (!qboResponse.ok) {
      const errorText = await qboResponse.text();
      console.error('❌ QuickBooks API error:', errorText);
      throw new Error(`QuickBooks API error: ${qboResponse.status}`);
    }

    const qboData = await qboResponse.json();
    const estimate = qboData.Estimate;
    
    console.log('✅ QuickBooks estimate created:', estimate.Id);

    const estimateUrl = QBO_ENVIRONMENT === 'production'
      ? `https://app.qbo.intuit.com/app/estimate?txnId=${estimate.Id}`
      : `https://app.sandbox.qbo.intuit.com/app/estimate?txnId=${estimate.Id}`;

    // Step 3: Update requests table
    await supabase
      .from('requests')
      .update({
        selected_proposal_id: proposalId,
        qbo_estimate_id: estimate.Id,
        qbo_estimate_url: estimateUrl,
        qbo_sync_status: 'synced',
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);

    // Step 4: Update proposals table
    await supabase
      .from('proposals')
      .update({ is_selected: true })
      .eq('id', proposalId);

    await supabase
      .from('proposals')
      .update({ is_selected: false })
      .eq('request_id', requestId)
      .neq('id', proposalId);

    console.log('✅ Database updated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        estimateId: estimate.Id,
        estimateUrl,
        message: 'Quote request submitted successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function: Format design requirements for QuickBooks
function formatDesignRequirements(parsedSlots: any): string {
  const parts: string[] = [];
  
  if (parsedSlots.colorPalette) parts.push(`Color Palette: ${parsedSlots.colorPalette}`);
  if (parsedSlots.decorationStyle) parts.push(`Decoration Style: ${parsedSlots.decorationStyle}`);
  if (parsedSlots.themeMood) parts.push(`Theme: ${parsedSlots.themeMood}`);
  if (parsedSlots.messageText && parsedSlots.messageText !== 'none') {
    parts.push(`Message: ${parsedSlots.messageText}`);
  }
  if (parsedSlots.flowerType && parsedSlots.flowerType !== 'none') {
    parts.push(`Flowers: ${parsedSlots.flowerType}`);
  }
  if (parsedSlots.textureFinish) parts.push(`Texture: ${parsedSlots.textureFinish}`);
  if (parsedSlots.specialElements && parsedSlots.specialElements.length > 0) {
    parts.push(`Special Elements: ${parsedSlots.specialElements.join(', ')}`);
  }
  if (parsedSlots.occasion) parts.push(`Occasion: ${parsedSlots.occasion}`);
  
  return parts.join('\n');
}

// Helper function: Get or create customer in QuickBooks
async function getOrCreateCustomer(request: any, accessToken: string, realmId: string, environment: string): Promise<string> {
  const baseUrl = environment === 'production' 
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
  
  const QBO_API_URL = `${baseUrl}/v3/company/${realmId}/query`;
  
  // Search for existing customer by email
  const searchQuery = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${request.contact_email.replace(/'/g, "\\'")}'`;
  
  try {
    const searchResponse = await fetch(`${QBO_API_URL}?query=${encodeURIComponent(searchQuery)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.QueryResponse?.Customer?.length > 0) {
        console.log('✅ Existing customer found');
        return searchData.QueryResponse.Customer[0].Id;
      }
    }
  } catch (error) {
    console.warn('⚠️ Error searching for customer, will create new:', error);
  }

  // Create new customer
  console.log('📝 Creating new customer in QuickBooks');
  const createURL = `${baseUrl}/v3/company/${realmId}/customer`;
  const customerData = {
    DisplayName: request.contact_name,
    PrimaryEmailAddr: {
      Address: request.contact_email
    },
    PrimaryPhone: request.contact_phone ? {
      FreeFormNumber: request.contact_phone
    } : undefined
  };

  const createResponse = await fetch(createURL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(customerData)
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error('❌ Failed to create customer:', errorText);
    throw new Error('Failed to create customer in QuickBooks');
  }

  const createData = await createResponse.json();
  console.log('✅ New customer created');
  return createData.Customer.Id;
}
