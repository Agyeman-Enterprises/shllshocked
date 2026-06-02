#!/usr/bin/env node
/**
 * SHLLSHOCKD Stripe Webhook Handler for AURORA PostgreSQL
 * Runs on AURORA, handles Stripe payments, generates license keys
 *
 * Usage:
 *   node index.js
 *
 * Environment:
 *   PORT - Server port (default: 3001)
 *   DATABASE_URL - PostgreSQL connection string
 *   STRIPE_WEBHOOK_SECRET - Stripe webhook signing secret
 *   LICENSE_SECRET - HMAC secret for license key generation
 *   RESEND_API_KEY - API key for Resend email service
 */

const express = require("express");
const crypto = require("crypto");
const { Pool } = require("pg");
const nodemailer = require("nodemailer");

const app = express();
const port = process.env.PORT || 3001;

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Email transporter (using Resend or SMTP)
let emailTransporter;
if (process.env.RESEND_API_KEY) {
  // Use Resend API
  const resendKey = process.env.RESEND_API_KEY;
  emailTransporter = {
    sendMail: async (options) => {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "noreply@shllshockd.com",
          to: options.to,
          subject: options.subject,
          html: options.html,
        }),
      });
      if (!response.ok) {
        throw new Error(`Resend error: ${response.statusText}`);
      }
      return { response };
    },
  };
} else {
  // Fallback: SMTP (configure via .env if needed)
  emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: process.env.SMTP_PORT || 25,
    secure: false,
  });
}

// Generate license key (same algorithm as electron/license.js)
function generateLicenseKey(email, timestamp) {
  const licenseSecret = process.env.LICENSE_SECRET || "shllshockd-pro-secret-key-v1";
  const data = `${email}:${timestamp}`;
  const hmac = crypto.createHmac("sha256", licenseSecret);
  hmac.update(data);
  const signature = hmac.digest("hex").substring(0, 16).toUpperCase();
  return `SHLLSHOCKD-${timestamp}-${signature}`;
}

// Send license email
async function sendLicenseEmail(email, licenseKey) {
  try {
    await emailTransporter.sendMail({
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
    });
    console.log(`[webhook] Email sent to ${email}`);
    return true;
  } catch (err) {
    console.error(`[webhook] Email send failed: ${err.message}`);
    return false;
  }
}

// Log webhook event to database
async function logWebhook(eventType, payload, status, errorMessage = null) {
  try {
    await pool.query(
      "INSERT INTO shllshockd.webhook_logs (event_type, payload, status, error_message) VALUES ($1, $2, $3, $4)",
      [eventType, JSON.stringify(payload), status, errorMessage]
    );
  } catch (err) {
    console.error(`[webhook] Failed to log event: ${err.message}`);
  }
}

// Verify Stripe webhook signature
function verifyStripeSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const computed = hmac.digest("hex");

  // Stripe signature format: t=timestamp,v1=signature
  const parts = signature.split(",");
  const sigPart = parts.find((p) => p.startsWith("v1="));
  if (!sigPart) return false;

  const providedSig = sigPart.substring(3);
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(providedSig));
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "shllshockd-webhook" });
});

// Stripe webhook endpoint
app.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    console.warn("[webhook] Missing signature or secret");
    return res.status(403).json({ error: "Forbidden" });
  }

  // Verify signature
  if (!verifyStripeSignature(req.body.toString(), signature, secret)) {
    console.warn("[webhook] Invalid signature");
    await logWebhook("stripe_payment", {}, "failed", "Invalid signature");
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const payload = JSON.parse(req.body.toString());
    const eventType = payload.type;

    // Log received
    await logWebhook(eventType, payload, "received");

    // Only handle payment_intent.succeeded
    if (eventType !== "payment_intent.succeeded") {
      console.log(`[webhook] Ignoring event type: ${eventType}`);
      return res.json({ ok: true });
    }

    const paymentIntent = payload.data?.object;
    if (!paymentIntent) {
      throw new Error("Missing payment_intent data");
    }

    // Extract email from receipt_email or charge metadata
    const email = paymentIntent.receipt_email;
    const stripePaymentId = paymentIntent.id;
    const timestamp = Date.now();

    if (!email) {
      throw new Error("Missing customer email in payment intent");
    }

    console.log(`[webhook] Processing payment for ${email}`);

    // Generate license key
    const licenseKey = generateLicenseKey(email, timestamp);

    // Insert into database
    try {
      await pool.query(
        "INSERT INTO shllshockd.licenses (email, license_key, purchased_at, stripe_payment_id) VALUES ($1, $2, $3, $4)",
        [email, licenseKey, timestamp, stripePaymentId]
      );
      console.log(`[webhook] License created for ${email}`);
    } catch (dbErr) {
      if (dbErr.code === "23505") {
        // Duplicate email - get existing license
        console.warn(`[webhook] License already exists for ${email}`);
        const result = await pool.query(
          "SELECT license_key FROM shllshockd.licenses WHERE email = $1",
          [email]
        );
        if (result.rows.length > 0) {
          await sendLicenseEmail(email, result.rows[0].license_key);
        }
      } else {
        throw dbErr;
      }
    }

    // Send email with license key
    await sendLicenseEmail(email, licenseKey);

    // Log success
    await logWebhook(eventType, payload, "processed");

    return res.json({ ok: true });
  } catch (err) {
    console.error(`[webhook] Error: ${err.message}`);
    await logWebhook("payment_intent.succeeded", {}, "failed", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`[webhook] SHLLSHOCKD webhook handler listening on port ${port}`);
  console.log(`[webhook] Stripe webhook endpoint: http://localhost:${port}/webhook/stripe`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[webhook] Shutting down gracefully...");
  await pool.end();
  process.exit(0);
});
