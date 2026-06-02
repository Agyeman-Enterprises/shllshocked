# SHLLSHOCKD Pro Licensing Setup

This guide walks you through setting up payments with Stripe and automatic license key generation.

## Architecture

```
Stripe (payment) → webhook → Supabase Edge Function → generates key → emails user
User receives key via email → pastes into SHLLSHOCKD app → license validated locally
```

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Create a new project named `shllshockd-licensing`
3. Copy your **Project URL** and **Service Role Key** (keep this secret!)
4. Save to `.env.local`:
   ```
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJxx...
   ```

## Step 2: Apply Database Schema

1. Go to Supabase Dashboard → SQL Editor
2. Create a new query
3. Paste the contents of `supabase/migrations/0001_init_licensing.sql`
4. Run the query

This creates:
- `licenses` table (email, license_key, purchased_at, order_id)
- `webhook_logs` table (audit trail)

## Step 3: Deploy Webhook Function

```bash
cd C:\dev\shllshocked-ui

# Install Supabase CLI (one-time)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref xxx

# Create environment file for the function
echo "STRIPE_WEBHOOK_SECRET=whsec_..." > supabase/.env.local
echo "LICENSE_SECRET=shllshockd-pro-secret-key-v1" >> supabase/.env.local
echo "RESEND_API_KEY=<your-resend-key>" >> supabase/.env.local

# Deploy the function
supabase functions deploy webhook-stripe --no-verify
```

After deployment, copy the webhook URL (shown in output): `https://<project>.functions.supabase.co/webhook-stripe`

## Step 4: Set Up Stripe

1. Go to https://dashboard.stripe.com
2. Log in / sign up
3. Create a **Product**:
   - Name: "SHLLSHOCKD Pro"
   - Type: Service (or product)
   - Pricing: $49.00 USD (one-time)
   - Save

4. Get checkout link:
   - Go to Products → SHLLSHOCKD Pro
   - Click **Create payment link**
   - One-time payment only
   - Add metadata: `email` field (optional, helps with tracking)
   - Copy the **Payment Link**

5. Configure webhook:
   - Go to **Developers → Webhooks**
   - Click **Add endpoint**
   - URL: `https://<project>.functions.supabase.co/webhook-stripe`
   - Events to send: Select **payment_intent.succeeded**
   - Copy the **Signing Secret** (starts with `whsec_`)
   - Add to Supabase env vars as `STRIPE_WEBHOOK_SECRET`

## Step 5: Test the Flow

1. Use Stripe test mode:
   - Go to **Developers → Test Data**
   - Use test card: `4242 4242 4242 4242` (any future exp + any CVC)
2. Make a test purchase via your payment link
3. Check Supabase:
   - `webhook_logs` table should have an entry with type `payment_intent.succeeded`
   - `licenses` table should have your email + license key
4. Check your email for the license key
5. Open SHLLSHOCKD → License Settings → paste the key

## Environment Variables

Store these in Supabase (Settings → Secrets):
- `STRIPE_WEBHOOK_SECRET` — from Stripe webhook signing secret
- `LICENSE_SECRET` — same as electron/license.js (v1 key never changes)
- `RESEND_API_KEY` — from https://resend.com (for sending license emails)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Webhook not firing | Check Stripe webhook logs (Developers → Webhooks → Endpoint) |
| Email not sending | Check Resend API key, verify sender domain is verified |
| License key invalid | Ensure `LICENSE_SECRET` matches in both Electron and Supabase |
| Function deploy fails | Run `supabase functions deploy webhook-stripe --no-verify` |
| Test payment appears but no webhook | Check webhook signing secret in Supabase env vars |

## Production Checklist

- [ ] Supabase project created and linked
- [ ] Database migrations applied
- [ ] Webhook function deployed (webhook-stripe)
- [ ] Stripe account created
- [ ] Stripe product created ($49 one-time)
- [ ] Stripe payment link generated
- [ ] Stripe webhook endpoint configured with correct secret
- [ ] Resend API key configured for emails
- [ ] Test purchase completed successfully
- [ ] License key received and validated in app
- [ ] README updated with payment link
- [ ] Deploy new SHLLSHOCKD version with payment link in app

## Cost

- **Supabase**: Free tier covers webhook + storage (generous quota)
- **Stripe**: 2.9% + $0.30 per transaction
- **Resend**: $0.20 per email (or free tier: 100/day)

**For $49 sale:**
- After Stripe fee: ~$47.08
- After Resend email: ~$46.88
- No recurring costs

