import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[CREATE-STRIPE-CHECKOUT] Function started");

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Parse request body
    const { requestId, proposalId, accessToken } = await req.json();
    console.log("[CREATE-STRIPE-CHECKOUT] Request data received", { requestId, proposalId });

    if (!requestId || !proposalId || !accessToken) {
      throw new Error("Missing required parameters: requestId, proposalId, or accessToken");
    }

    // Verify access token and fetch request with proposals
    const { data: request, error: requestError } = await supabaseClient
      .from('requests')
      .select('*, proposals!proposals_request_id_fkey!inner(*)')
      .eq('id', requestId)
      .eq('access_token', accessToken)
      .single();

    if (requestError || !request) {
      console.error("[CREATE-STRIPE-CHECKOUT] Request fetch error:", requestError);
      throw new Error("Invalid request or access token");
    }

    console.log("[CREATE-STRIPE-CHECKOUT] Request verified");

    // Find the selected proposal
    const proposal = request.proposals.find((p: any) => p.id === proposalId);
    if (!proposal) {
      throw new Error("Proposal not found");
    }

    console.log("[CREATE-STRIPE-CHECKOUT] Proposal found", { proposalId });

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists
    let customerId;
    if (request.contact_email) {
      const customers = await stripe.customers.list({ 
        email: request.contact_email, 
        limit: 1 
      });
      
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        console.log("[CREATE-STRIPE-CHECKOUT] Existing customer found", { customerId });
      } else {
        // Create new customer
        const customer = await stripe.customers.create({
          email: request.contact_email,
          name: request.contact_name || undefined,
          phone: request.contact_phone || undefined,
          metadata: {
            requestId,
            proposalId,
          }
        });
        customerId = customer.id;
        console.log("[CREATE-STRIPE-CHECKOUT] New customer created", { customerId });
      }
    }

    // Get origin for redirect URLs
    const origin = req.headers.get("origin") || "https://a93fb606-c302-4789-8379-9c9510e8f384.lovableproject.com";

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : request.contact_email,
      line_items: [
        {
          price: "price_1STy12IS4h8aEHEQPF9ATPw8", // $30 USD fixed price
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/design/proposals/${requestId}?session_id={CHECKOUT_SESSION_ID}&token=${accessToken}`,
      cancel_url: `${origin}/design/proposals/${requestId}?token=${accessToken}`,
      metadata: {
        requestId,
        proposalId,
        contactEmail: request.contact_email || '',
        contactName: request.contact_name || '',
      },
    });

    console.log("[CREATE-STRIPE-CHECKOUT] Checkout session created", { 
      sessionId: session.id,
      url: session.url 
    });

    // Update request with checkout session ID
    const { error: updateError } = await supabaseClient
      .from('requests')
      .update({
        stripe_checkout_session_id: session.id,
        selected_proposal_id: proposalId,
        stripe_payment_status: 'pending',
        payment_provider: 'stripe',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('access_token', accessToken);

    if (updateError) {
      console.error("[CREATE-STRIPE-CHECKOUT] Failed to update request:", updateError);
    } else {
      console.log("[CREATE-STRIPE-CHECKOUT] Request updated with session ID");
    }

    return new Response(
      JSON.stringify({ 
        checkoutUrl: session.url,
        sessionId: session.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[CREATE-STRIPE-CHECKOUT] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "An unknown error occurred" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
