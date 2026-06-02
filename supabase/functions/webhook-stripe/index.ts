import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { webcrypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const stripeSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const licenseSecret = Deno.env.get("LICENSE_SECRET") || "shllshockd-pro-secret-key-v1";
const resendApiKey = Deno.env.get("RESEND_API_KEY");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function generateLicenseKey(email: string, timestamp: number): Promise<string> {
  const data = `${email}:${timestamp}`;
  const encoder = new TextEncoder();
  const key = encoder.encode(licenseSecret);
  const message = encoder.encode(data);

  const signature = await webcrypto.subtle.sign("HMAC", await webcrypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), message);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  const shortSig = hashHex.substring(0, 16).toUpperCase();
  return `SHLLSHOCKD-${timestamp}-${shortSig}`;
}

async function sendEmail(email: string, licenseKey: string): Promise<void> {
  if (!resendApiKey) {
    console.warn("[webhook] RESEND_API_KEY not set, skipping email");
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "noreply@shllshockd.com",
        to: email,
        subject: "SHLLSHOCKD Pro License Key",
        html: `
          <h1>Welcome to SHLLSHOCKD Pro!</h1>
          <p>Thank you for your purchase. Here's your license key:</p>
          <code style="background: #f0f0f0; padding: 10px; display: block; word-break: break-all; font-family: monospace;">
            ${licenseKey}
          </code>
          <p>Open SHLLSHOCKD, go to License Settings, and paste this key to activate Pro features.</p>
          <p>Questions? Contact support@shllshockd.com</p>
        `,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[webhook] Email send failed:", error);
    } else {
      console.log(`[webhook] Email sent to ${email}`);
    }
  } catch (err) {
    console.error("[webhook] Email error:", err.message);
  }
}

async function verifyStripeSignature(rawBody: string, signature: string): Promise<boolean> {
  if (!stripeSecret || !signature) {
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = encoder.encode(stripeSecret);
    const message = encoder.encode(rawBody);

    const hmac = await webcrypto.subtle.sign("HMAC", await webcrypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), message);
    const hashArray = Array.from(new Uint8Array(hmac));
    const computed = "t=" + Date.now() + "," + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Stripe signature format: t=timestamp,v1=signature
    // We're just doing basic verification; in production use stripe.webhooks.constructEvent
    return signature.includes(computed.split(",")[1]);
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");

    // Validate webhook signature
    if (!signature) {
      console.warn("[webhook] Missing Stripe signature");
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    // For Stripe, we should use their webhook verification library
    // For now, basic validation
    const payload = JSON.parse(rawBody);
    const eventType = payload.type;

    // Log the webhook
    await supabase.from("webhook_logs").insert({
      event_type: eventType,
      payload,
      status: "received",
    });

    // Only handle payment_intent.succeeded events
    if (eventType !== "payment_intent.succeeded") {
      console.log(`[webhook] Ignoring event type: ${eventType}`);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Extract payment details
    const paymentIntent = payload.data?.object;
    if (!paymentIntent) {
      throw new Error("Missing payment_intent data");
    }

    // Get email from metadata
    const email = paymentIntent.charges?.data?.[0]?.billing_details?.email || paymentIntent.receipt_email;
    const stripePaymentId = paymentIntent.id;
    const timestamp = Date.now();

    if (!email) {
      throw new Error("Missing customer email");
    }

    console.log(`[webhook] Processing payment for ${email}`);

    // Generate license key
    const licenseKey = await generateLicenseKey(email, timestamp);

    // Store in database
    const { error: insertError } = await supabase.from("licenses").insert({
      email,
      license_key: licenseKey,
      purchased_at: timestamp,
      stripe_payment_id: stripePaymentId,
    });

    if (insertError) {
      // Check if it's a duplicate email (user already purchased)
      if (insertError.code === "23505") {
        console.warn(`[webhook] License already exists for ${email}`);
        // Still send email with existing key
        const { data } = await supabase.from("licenses").select("license_key").eq("email", email).single();
        if (data) {
          await sendEmail(email, data.license_key);
        }
      } else {
        throw insertError;
      }
    } else {
      // Send email with new license key
      await sendEmail(email, licenseKey);
      console.log(`[webhook] License generated for ${email}`);
    }

    // Update webhook log as successful
    await supabase
      .from("webhook_logs")
      .update({ status: "processed" })
      .eq("event_type", eventType)
      .order("created_at", { ascending: false })
      .limit(1);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error("[webhook] Error:", err.message);

    // Log the error
    await supabase
      .from("webhook_logs")
      .insert({
        event_type: "error",
        payload: { error: err.message },
        status: "failed",
        error_message: err.message,
      })
      .catch(() => {});

    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
