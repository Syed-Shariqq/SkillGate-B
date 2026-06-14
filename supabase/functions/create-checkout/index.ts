import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Response helper
function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

// Helper to build URL encoded params for Stripe
function buildUrlEncodedParams(params: Record<string, any>): URLSearchParams {
  const urlParams = new URLSearchParams();

  function serialize(obj: any, prefix = "") {
    if (obj === null || obj === undefined) {
      return;
    }
    if (typeof obj === "object") {
      for (const [key, value] of Object.entries(obj)) {
        const nestedPrefix = prefix ? `${prefix}[${key}]` : key;
        serialize(value, nestedPrefix);
      }
    } else {
      urlParams.append(prefix, String(obj));
    }
  }

  serialize(params);
  return urlParams;
}

// Stripe request helper
async function stripeRequest(
  path: string,
  params: Record<string, any> = {},
  method = "POST",
) {
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  // Basic auth: btoa(STRIPE_SECRET_KEY + ':')
  const authHeader = `Basic ${btoa(stripeSecretKey + ":")}`;

  let url = `https://api.stripe.com/v1${path}`;
  let body: BodyInit | null = null;
  const headers: Record<string, string> = {
    Authorization: authHeader,
  };

  if (method === "GET") {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      searchParams.append(key, String(value));
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = buildUrlEncodedParams(params);
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  const responseData = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg =
      responseData.error?.message ||
      `Stripe request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return responseData;
}

Deno.serve(async (req) => {
  // 1. Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // 2. Reject non-POST requests
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  try {
    // 3. Authenticate the request
    const authHeader =
      req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Missing or invalid Authorization header" },
        401,
      );
    }
    const token = authHeader.substring(7).trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase environment variables are missing");
      return jsonResponse(
        { error: "Internal server configuration error" },
        500,
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("Authentication failed:", authError);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // 4. Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const { priceId, recruiterId } = body;
    if (!priceId) {
      return jsonResponse({ error: "priceId is required" }, 400);
    }
    if (!recruiterId) {
      return jsonResponse({ error: "recruiterId is required" }, 400);
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(recruiterId)) {
      return jsonResponse({ error: "recruiterId must be a valid UUID" }, 400);
    }

    // 5. Authorization check
    if (user.id !== recruiterId) {
      return jsonResponse(
        {
          error:
            "Forbidden: You can only create checkout sessions for yourself",
        },
        403,
      );
    }

    // 6. Query profiles table
    const { data: profile, error: dbError } = await supabase
      .from("profiles")
      .select("id, email, full_name, stripe_customer_id")
      .eq("id", recruiterId)
      .maybeSingle();

    if (dbError) {
      console.error("Database error fetching profile:", dbError);
      return jsonResponse({ error: "Database query error" }, 500);
    }

    if (!profile) {
      return jsonResponse({ error: "Profile not found" }, 404);
    }

    // 7. Stripe customer resolution
    let stripeCustomerId = profile.stripe_customer_id;

    if (!stripeCustomerId) {
      console.log(
        `Stripe customer ID not found in profile for ${recruiterId}. Searching Stripe...`,
      );

      const queryVal = `email:'${profile.email}'`;
      const searchResult = await stripeRequest(
        "/customers/search",
        { query: queryVal },
        "GET",
      );

      if (searchResult.data && searchResult.data.length > 0) {
        stripeCustomerId = searchResult.data[0].id;
        console.log(
          `Found existing Stripe customer ${stripeCustomerId} for ${profile.email}`,
        );
      } else {
        console.log(
          `No Stripe customer found for ${profile.email}. Creating new customer...`,
        );
        const newCustomer = await stripeRequest(
          "/customers",
          {
            email: profile.email,
            name: profile.full_name || "",
            metadata: {
              recruiterId: recruiterId,
            },
          },
          "POST",
        );

        stripeCustomerId = newCustomer.id;
        console.log(`Created Stripe customer ${stripeCustomerId}`);
      }

      // Update profiles
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", recruiterId);

      if (updateError) {
        console.error(
          "Failed to update profile stripe_customer_id:",
          updateError,
        );
        return jsonResponse(
          { error: "Failed to update profile with customer ID" },
          500,
        );
      }
    }

    // 8. Determine checkout mode
    const trainingPriceId = Deno.env.get("STRIPE_TRAINING_PLAN_PRICE_ID");
    const mode = priceId === trainingPriceId ? "payment" : "subscription";

    // 9. Create Stripe checkout session
    const checkoutParams: Record<string, any> = {
      customer: stripeCustomerId,
      mode: mode,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url:
        "https://skill-gate-b.vercel.app/billing?success=true&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://skill-gate-b.vercel.app/billing?cancelled=true",
      metadata: {
        recruiterId: recruiterId,
      },
    };

    if (mode === "subscription") {
      checkoutParams.allow_promotion_codes = true;
      checkoutParams.billing_address_collection = "auto";
    }

    console.log(
      `Creating Stripe checkout session for ${recruiterId} in ${mode} mode...`,
    );
    const session = await stripeRequest(
      "/checkout/sessions",
      checkoutParams,
      "POST",
    );

    if (!session.url) {
      console.error("Stripe session created but has no URL:", session);
      return jsonResponse(
        { error: "Failed to generate checkout session URL" },
        500,
      );
    }

    // 10. Return { url: session.url } with 200
    return jsonResponse({ url: session.url }, 200);
  } catch (error) {
    console.error("Unexpected error in create-checkout function:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return jsonResponse({ error: errorMessage }, 500);
  }
});
