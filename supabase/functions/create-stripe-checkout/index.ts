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

    // Initialize Supabase client (service role for RLS-bypassed secure server-side access)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Parse request body
    const { requestId, proposalId, accessToken } = await req.json();
    console.log("[CREATE-STRIPE-CHECKOUT] Request data received", { requestId, proposalId });

    if (!requestId || !proposalId || !accessToken) {
      throw new Error("Missing required parameters: requestId, proposalId, or accessToken");
    }

    // 1) Verify request by id + access_token (no joins to avoid ambiguity)
    const { data: request, error: requestError } = await supabaseClient
      .from('requests')
      .select('id, contact_email, contact_name, contact_phone, access_token')
      .eq('id', requestId)
      .eq('access_token', accessToken)
      .maybeSingle();

    if (requestError) {
      console.error("[CREATE-STRIPE-CHECKOUT] Database error (requests):", requestError);
      throw new Error("Database error: " + requestError.message);
    }

    if (!request) {
      console.error("[CREATE-STRIPE-CHECKOUT] No request found with provided credentials");
      throw new Error("Invalid request ID or access token");
    }

    console.log("[CREATE-STRIPE-CHECKOUT] Request verified");

    // 2) Verify the proposal belongs to the request
    const { data: proposal, error: proposalError } = await supabaseClient
      .from('proposals')
      .select('id, image_url, variant')
      .eq('id', proposalId)
      .eq('request_id', requestId)
      .maybeSingle();

    if (proposalError) {
      console.error("[CREATE-STRIPE-CHECKOUT] Database error (proposals):", proposalError);
      throw new Error("Database error: " + proposalError.message);
    }

    if (!proposal) {
      console.error("[CREATE-STRIPE-CHECKOUT] Proposal not found for request", { requestId, proposalId });
      throw new Error("Invalid proposal for request");
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
    console.log("[CREATE-STRIPE-CHECKOUT] Creating session", { origin, requestId, proposalId });
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
        success: true,
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
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
