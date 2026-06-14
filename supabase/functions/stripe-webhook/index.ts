import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Response helper
function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// Timing-safe comparison function to prevent timing attacks
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Stripe signature verification helper using subtle crypto
async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string
): Promise<boolean> {
  try {
    const parts = signatureHeader.split(",");
    let t: string | null = null;
    let v1: string | null = null;

    for (const part of parts) {
      const [key, val] = part.split("=");
      if (!key || !val) continue;
      if (key.trim() === "t") {
        t = val.trim();
      } else if (key.trim() === "v1") {
        v1 = val.trim();
      }
    }

    if (!t || !v1) {
      console.error("Missing t or v1 in Stripe-Signature header");
      return false;
    }

    // Check timestamp to prevent replay attacks (300 seconds threshold)
    const timestamp = parseInt(t, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300) {
      console.error(`Webhook timestamp delta (${Math.abs(now - timestamp)}s) exceeds 300s limit`);
      return false;
    }

    // Build signed payload
    const signedPayload = `${t}.${rawBody}`;

    const encoder = new TextEncoder();
    const keyData = encoder.encode(webhookSecret);
    const messageData = encoder.encode(signedPayload);

    // Import the secret key
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // Compute signature
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      messageData
    );

    // Convert computed signature buffer to hex string
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const computedSignature = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // Timing-safe comparison
    return timingSafeCompare(computedSignature, v1);
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

// Plan details mapping from Price ID
function getPlanFromPriceId(
  priceId: string,
  env: Record<string, string | undefined>
): { tier: string; limit: number } | null {
  if (priceId === env.STRIPE_STARTER_PRICE_ID) {
    return { tier: "starter", limit: 10 };
  }
  if (priceId === env.STRIPE_GROWTH_PRICE_ID) {
    return { tier: "growth", limit: 100 };
  }
  if (priceId === env.STRIPE_SCALE_PRICE_ID) {
    return { tier: "scale", limit: 500 };
  }
  return null;
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
async function stripeRequest(path: string, method = "POST", params: Record<string, any> = {}) {
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  const authHeader = `Basic ${btoa(stripeSecretKey + ":")}`;
  let url = `https://api.stripe.com/v1${path}`;
  let body: BodyInit | null = null;
  const headers: Record<string, string> = {
    "Authorization": authHeader,
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
    const errorMsg = responseData.error?.message || `Stripe request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return responseData;
}

Deno.serve(async (req) => {
  // 1. Only accept POST requests
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not configured");
      return jsonResponse({ error: "Webhook secret missing from configuration" }, 500);
    }

    const signatureHeader = req.headers.get("Stripe-Signature") || req.headers.get("stripe-signature");
    if (!signatureHeader) {
      console.error("Missing Stripe-Signature header");
      return jsonResponse({ error: "Missing signature header" }, 400);
    }

    // 2. Stripe signature verification on raw body text
    const rawBody = await req.text();
    const isSignatureValid = await verifyStripeSignature(rawBody, signatureHeader, webhookSecret);

    if (!isSignatureValid) {
      console.error("Stripe signature verification failed");
      return jsonResponse({ error: "Invalid signature" }, 400);
    }

    // 3. Parse raw body as JSON to get the Stripe event object
    const event = JSON.parse(rawBody);
    console.log(`Received Stripe webhook event: ${event.type}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase environment variables are missing");
      return jsonResponse({ error: "Internal configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 4. Handle events
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        let recruiterId = session.metadata?.recruiterId;

        const assessmentId = session.metadata?.assessmentId || session.client_reference_id || null;

        // If recruiterId is missing but we have an assessmentId, let's look it up from database
        if (!recruiterId && assessmentId) {
          const { data: assessmentData } = await supabase
            .from("assessments")
            .select("recruiter_id")
            .eq("id", assessmentId)
            .maybeSingle();
          if (assessmentData) {
            recruiterId = assessmentData.recruiter_id;
          }
        }

        if (!recruiterId) {
          console.warn("No recruiterId found in session metadata or via assessmentId lookup, skipping updates...");
          break;
        }

        if (session.payment_status !== "paid") {
          console.log(`Payment status is ${session.payment_status}, not paid. Skipping processing.`);
          break;
        }

        if (session.mode === "subscription") {
          const subscriptionId = session.subscription;
          if (!subscriptionId) {
            throw new Error("No subscription ID in checkout session");
          }

          console.log(`Fetching subscription details for ${subscriptionId}...`);
          const subscription = await stripeRequest(`/subscriptions/${subscriptionId}`, "GET");
          const priceId = subscription.items?.data?.[0]?.price?.id;

          if (!priceId) {
            throw new Error("Could not retrieve price ID from subscription items");
          }

          const env = {
            STRIPE_STARTER_PRICE_ID: Deno.env.get("STRIPE_STARTER_PRICE_ID") || undefined,
            STRIPE_GROWTH_PRICE_ID: Deno.env.get("STRIPE_GROWTH_PRICE_ID") || undefined,
            STRIPE_SCALE_PRICE_ID: Deno.env.get("STRIPE_SCALE_PRICE_ID") || undefined,
          };

          const plan = getPlanFromPriceId(priceId, env);
          if (!plan) {
            console.warn(`Unknown price ID ${priceId}. Not updating plan tiers.`);
          } else {
            console.log(`Updating profile ${recruiterId} to tier: ${plan.tier}, limit: ${plan.limit}`);
            const { error: dbError } = await supabase
              .from("profiles")
              .update({
                subscription_tier: plan.tier,
                assessments_limit: plan.limit,
                stripe_customer_id: session.customer,
                updated_at: new Date().toISOString(),
              })
              .eq("id", recruiterId);

            if (dbError) {
              throw new Error(`Database error updating profile subscription: ${dbError.message}`);
            }
          }
        } else if (session.mode === "payment") {
          console.log(`Processing payment mode checkout for recruiter ${recruiterId}`);
          const assessmentId = session.metadata?.assessmentId || session.client_reference_id || null;
          let candidateId = null;

          if (assessmentId) {
            // Verify if assessment exists and extract candidate_id
            const { data: assessmentData, error: fetchError } = await supabase
              .from("assessments")
              .select("candidate_id")
              .eq("id", assessmentId)
              .maybeSingle();

            if (fetchError) {
              console.error("Error looking up assessment for candidate_id:", fetchError);
            } else if (assessmentData) {
              candidateId = assessmentData.candidate_id;
            }
          }

          // Since candidate_id and assessment_id are non-nullable in the schema and reference foreign keys,
          // we use the real ones if found in the database. If not, we fall back to recruiterId (cast as UUID)
          // to gracefully handle recruiter-level purchases or missing entities.
          const finalCandidateId = candidateId || recruiterId;
          const finalAssessmentId = assessmentId || recruiterId;

          const { error: insertError } = await supabase
            .from("training_purchases")
            .insert({
              candidate_id: finalCandidateId,
              assessment_id: finalAssessmentId,
              stripe_session_id: session.id,
              amount_paid: session.amount_total ?? 900,
              currency: session.currency ?? "usd",
              status: "completed",
              created_at: new Date().toISOString(),
            });

          if (insertError) {
            throw new Error(`Database error inserting training purchase: ${insertError.message}`);
          }
          console.log(`Successfully recorded training purchase for recruiter ${recruiterId}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer;

        if (!stripeCustomerId) {
          throw new Error("No customer ID in subscription object");
        }

        console.log(`Downgrading customer ${stripeCustomerId} due to subscription deletion`);
        const { error: dbError } = await supabase
          .from("profiles")
          .update({
            subscription_tier: "starter",
            assessments_limit: 10,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", stripeCustomerId);

        if (dbError) {
          throw new Error(`Database error downgrading profile subscription: ${dbError.message}`);
        }
        console.log(`Successfully downgraded customer ${stripeCustomerId} to starter tier.`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const stripeCustomerId = invoice.customer;

        if (!stripeCustomerId) {
          throw new Error("No customer ID in invoice object");
        }

        console.log(`Processing payment failure for customer ${stripeCustomerId}`);
        
        const { data: profile, error: dbError } = await supabase
          .from("profiles")
          .select("email")
          .eq("stripe_customer_id", stripeCustomerId)
          .maybeSingle();

        if (dbError) {
          throw new Error(`Database error looking up profile for customer ${stripeCustomerId}: ${dbError.message}`);
        }

        if (!profile || !profile.email) {
          console.warn(`No profile or email found for customer ${stripeCustomerId}. Skipping email notification.`);
        } else {
          const recruiterEmail = profile.email;
          console.log(`Sending payment failed email to ${recruiterEmail}`);

          const sendEmailUrl = `${supabaseUrl}/functions/v1/send-email`;
          const emailBody = {
            to: recruiterEmail,
            subject: "SkillGate — Payment Failed",
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #d32f2f;">Payment Failed</h2>
                <p>Hello,</p>
                <p>We were unable to process your payment for your SkillGate subscription.</p>
                <p>To avoid any disruption to your service, please update your billing details as soon as possible.</p>
                <div style="margin: 30px 0; text-align: center;">
                  <a href="https://skillgate.vercel.app/billing" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Update Billing Details</a>
                </div>
                <p>If you have any questions, please contact our support team.</p>
                <p>Best regards,<br/>The SkillGate Team</p>
              </div>
            `,
          };

          const emailResponse = await fetch(sendEmailUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(emailBody),
          });

          if (!emailResponse.ok) {
            const emailResponseText = await emailResponse.text().catch(() => "");
            console.error(`Failed to trigger send-email function (status ${emailResponse.status}): ${emailResponseText}`);
          } else {
            console.log(`Successfully triggered send-email function for ${recruiterEmail}`);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    // 6. Return 200 { received: true } after successful handling
    return jsonResponse({ received: true }, 200);

  } catch (error) {
    // 7. Log and return 500 on unexpected errors
    console.error("Unexpected error in stripe-webhook function:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return jsonResponse({ error: errorMessage }, 500);
  }
});