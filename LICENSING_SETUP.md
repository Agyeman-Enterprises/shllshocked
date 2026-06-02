# SHLLSHOCKD Pro Licensing Setup

This guide walks you through setting up payments with LemonSqueezy and automatic license key generation.

## Architecture

```
LemonSqueezy (payment) → webhook → Supabase Edge Function → generates key → emails user
User receives key → pastes into SHLLSHOCKD app → license validated locally
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
echo "LEMONSQUEEZY_WEBHOOK_SECRET=<your-secret>" > supabase/.env.local
echo "LICENSE_SECRET=shllshockd-pro-secret-key-v1" >> supabase/.env.local
echo "RESEND_API_KEY=<your-resend-key>" >> supabase/.env.local

# Deploy the function
supabase functions deploy webhook-lemonsqueezy --no-verify
```

After deployment, copy the webhook URL (shown in output): `https://<project>.functions.supabase.co/webhook-lemonsqueezy`

## Step 4: Set Up LemonSqueezy

1. Go to https://lemonsqueezy.com
2. Sign up / log in
3. Create a **Product**:
   - Name: "SHLLSHOCKD Pro"
   - Price: $49.00
   - Type: One-time payment
   - Save

4. Configure webhook:
   - Go to Settings → Webhooks
   - Add webhook:
     - URL: `https://<project>.functions.supabase.co/webhook-lemonsqueezy`
     - Events: `order:created`
     - Secret: Generate a random string, save it
   - Copy the secret → add to Supabase function env vars as `LEMONSQUEEZY_WEBHOOK_SECRET`

5. Get checkout link:
   - Go to Products → SHLLSHOCKD Pro
   - Copy the **Checkout Link**
   - Add to README.md: `[Upgrade to Pro](https://checkout.lemonsqueezy.com/...)`

## Step 5: Test the Flow

1. Use LemonSqueezy test mode: https://docs.lemonsqueezy.com/guides/business-basics/testing
2. Make a test purchase
3. Check Supabase:
   - `webhook_logs` table should have an entry
   - `licenses` table should have your email + license key
4. Check your email for the license key
5. Open SHLLSHOCKD → License Settings → paste the key

## Environment Variables

Store these in Supabase (Settings → Secrets):
- `LEMONSQUEEZY_WEBHOOK_SECRET` — from LemonSqueezy webhook config
- `LICENSE_SECRET` — same as electron/license.js (v1 key never changes)
- `RESEND_API_KEY` — from https://resend.com (for sending license emails)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Webhook not firing | Check LemonSqueezy webhook logs, verify secret matches |
| Email not sending | Check Resend API key, verify email domain is verified |
| License key invalid | Ensure `LICENSE_SECRET` matches in both Electron and Supabase |
| Function deploy fails | Run `supabase functions deploy --no-verify` |

## Production Checklist

- [ ] Supabase project created and linked
- [ ] Database migrations applied
- [ ] Webhook function deployed
- [ ] LemonSqueezy product created ($49)
- [ ] LemonSqueezy webhook configured with correct secret
- [ ] Resend API key configured for emails
- [ ] Test purchase completed successfully
- [ ] License key received and validated in app
- [ ] README updated with checkout link
- [ ] Deploy new SHLLSHOCKD version with checkout link in app

## Cost

- **Supabase**: Free tier covers webhook + storage (generous quota)
- **LemonSqueezy**: 8.5% + $0.25 per transaction
- **Resend**: $0.20 per email (or free tier: 100/day)

**For $49 sale:**
- After LemonSqueezy fee: ~$44
- After Resend email: ~$43.80
- No recurring costs

