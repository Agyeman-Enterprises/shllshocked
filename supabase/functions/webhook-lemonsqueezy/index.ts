import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const lemonsqueezySecret = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET");
const licenseSecret = Deno.env.get("LICENSE_SECRET") || "shllshockd-pro-secret-key-v1";
const resendApiKey = Deno.env.get("RESEND_API_KEY");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ALGORITHM = "SHA-256";

function generateLicenseKey(email: string, timestamp: number): string {
  const data = `${email}:${timestamp}`;
  const encoder = new TextEncoder();
  const key = encoder.encode(licenseSecret);
  const message = encoder.encode(data);

  // Use crypto subtle API for HMAC
  return crypto.subtle
    .sign("HMAC", await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), message)
    .then((signature) => {
      const hashArray = Array.from(new Uint8Array(signature));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      const shortSig = hashHex.substring(0, 16).toUpperCase();
      return `SHLLSHOCKD-${timestamp}-${shortSig}`;
    });
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
          <code style="background: #f0f0f0; padding: 10px; display: block; word-break: break-all;">
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

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature");

    // Validate webhook signature
    if (!signature || !lemonsqueezySecret) {
      console.warn("[webhook] Missing signature or secret");
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    // Verify signature (LemonSqueezy uses HMAC-SHA256)
    const encoder = new TextEncoder();
    const key = encoder.encode(lemonsqueezySecret);
    const message = encoder.encode(rawBody);
    const expectedSignature = await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), message);
    const expectedSigHex = Array.from(new Uint8Array(expectedSignature)).map((b) => b.toString(16).padStart(2, "0")).join("");

    if (signature !== expectedSigHex) {
      console.warn("[webhook] Invalid signature");
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.meta?.event_name;

    // Log the webhook
    await supabase.from("webhook_logs").insert({
      event_type: eventType,
      payload,
      status: "received",
    });

    // Only handle order:created events
    if (eventType !== "order:created") {
      console.log(`[webhook] Ignoring event type: ${eventType}`);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Extract order details
    const order = payload.data?.attributes;
    if (!order) {
      throw new Error("Missing order data");
    }

    const email = order.customer_email;
    const orderId = payload.data?.id;
    const timestamp = Date.now();

    if (!email) {
      throw new Error("Missing customer email");
    }

    // Generate license key
    const licenseKey = await generateLicenseKey(email, timestamp);

    // Store in database
    const { error: insertError } = await supabase.from("licenses").insert({
      email,
      license_key: licenseKey,
      purchased_at: timestamp,
      lemonsqueezy_order_id: orderId,
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
    await supabase.from("webhook_logs").update({ status: "processed" }).eq("payload", payload);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error("[webhook] Error:", err.message);

    // Log the error
    const request = await req.clone();
    const body = await request.text();
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
