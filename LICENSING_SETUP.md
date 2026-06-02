# SHLLSHOCKD Pro Licensing Setup (AURORA)

This guide walks you through setting up Stripe payments and automatic license key generation on AURORA (self-hosted PostgreSQL + Node.js webhook handler).

## Architecture

```
Stripe (payment) → ae-stripe-router (/api/stripe/webhook)
                 → AURORA PostgreSQL (shllshockd_licensing db)
                 → generates license key
                 → emails user

User receives key → pastes into SHLLSHOCKD app → license validated locally (offline)
```

**Via AE Platform sovereign stack. All self-hosted on AURORA.**

---

## Step 1: Set Up PostgreSQL Database on AURORA

1. SSH into AURORA: `ssh root@5.9.153.215`
2. Access PostgreSQL:
   ```bash
   psql -U postgres
   ```
3. Create database:
   ```sql
   CREATE DATABASE shllshockd_licensing;
   \c shllshockd_licensing
   ```
4. Run migrations:
   ```bash
   # Download and run the SQL schema
   psql -U postgres -d shllshockd_licensing -f scripts/init-aurora-db.sql
   ```
5. Verify:
   ```sql
   SELECT table_name FROM information_schema.tables WHERE table_schema = 'shllshockd';
   -- Should show: licenses, webhook_logs
   ```

---

## Step 2: Register SHLLSHOCKD Webhook with ae-stripe-router

The AE Platform's `ae-stripe-router` routes all Stripe webhooks through `/api/stripe/webhook`.

Add SHLLSHOCKD handler to ae-stripe-router:

1. Open `AE-Platform/handlers/stripe.go`
2. Add case for SHLLSHOCKD:
   ```go
   case "shllshockd":
       handleShllshockdPayment(paymentIntent, metadata)
   ```

3. Implement handler:
   ```go
   func handleShllshockdPayment(pi *stripe.PaymentIntent, metadata map[string]string) error {
       // Extract email
       email := pi.ReceiptEmail
       if email == "" {
           return errors.New("missing receipt email")
       }

       // Generate license key
       timestamp := time.Now().UnixMilli()
       licenseKey := generateLicenseKey(email, timestamp)

       // Store in AURORA PostgreSQL
       db := aurora.ConnectDB("shllshockd_licensing")
       _, err := db.Exec(
           "INSERT INTO shllshockd.licenses (email, license_key, purchased_at, stripe_payment_id) VALUES ($1, $2, $3, $4)",
           email, licenseKey, timestamp, pi.ID,
       )
       if err != nil {
           return err
       }

       // Send email
       return sendLicenseEmail(email, licenseKey)
   }
   ```

4. Test webhook by triggering a test payment in Stripe dashboard
5. Verify in AURORA PostgreSQL:
   ```sql
   SELECT * FROM shllshockd.licenses ORDER BY created_at DESC LIMIT 1;
   ```

---

## Step 3: Set Up Stripe Webhook

1. Go to https://dashboard.stripe.com
2. Create product: **SHLLSHOCKD Pro** ($49 USD, one-time)
3. Create payment link (copy the URL)
4. Go to **Developers → Webhooks**
5. Add endpoint:
   - URL: `https://platform.agyemanenterprises.com/api/stripe/webhook`
   - Events: `payment_intent.succeeded`
   - Copy the **Signing Secret** (`whsec_...`)
6. Add secret to AE Platform env vars: `STRIPE_WEBHOOK_SECRET`
7. Add to payment link metadata:
   - `app: shllshockd` (routes to SHLLSHOCKD handler in ae-stripe-router)

---

## Step 4: Test the Flow

1. Use Stripe test card: `4242 4242 4242 4242` (any future exp/CVC)
2. Go through payment link
3. Check webhook logs:
   ```sql
   SELECT * FROM shllshockd.webhook_logs ORDER BY created_at DESC LIMIT 5;
   ```
4. Check licenses table:
   ```sql
   SELECT email, license_key FROM shllshockd.licenses;
   ```
5. Check your email for the license key
6. Open SHLLSHOCKD → License Settings → paste the key

---

## Step 5: Update README

Add payment link to README.md:

```markdown
## Upgrade to Pro ($49 one-time)

[Buy SHLLSHOCKD Pro](https://buy.stripe.com/...)

After purchase, you'll receive your license key via email.
Paste it in **License Settings** to unlock community features.
```

---

## Environment Variables (Webhook Handler)

| Variable | Source | Example |
|----------|--------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://shllshockd_webhook:pass@localhost:5432/shllshockd_licensing` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook config | `whsec_test_...` |
| `LICENSE_SECRET` | Same as electron/license.js | `shllshockd-pro-secret-key-v1` |
| `RESEND_API_KEY` | https://resend.com | `re_...` |
| `PORT` | Server port | `3001` |

---

## Monitoring

### Check webhook logs (AURORA):
```bash
# SSH to AURORA
ssh root@5.9.153.215
psql -d shllshockd_licensing -c "SELECT event_type, status, created_at FROM shllshockd.webhook_logs ORDER BY created_at DESC LIMIT 20;"
```

### Check licenses table:
```bash
ssh root@5.9.153.215
psql -d shllshockd_licensing -c "SELECT email, license_key, created_at FROM shllshockd.licenses ORDER BY created_at DESC LIMIT 10;"
```

### Check platform logs:
```bash
# On AURORA where ae-stripe-router runs
docker logs ae-stripe-router 2>&1 | tail -100
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Webhook not firing | Check Stripe dashboard webhook logs; verify URL and secret |
| Email not sending | Verify Resend API key; check that sender domain is verified |
| Database connection failed | Verify DATABASE_URL and postgres is running on AURORA |
| License key format invalid | Ensure LICENSE_SECRET matches exactly in both electron/license.js and webhook handler |
| 500 error on webhook | Check application logs in Coolify or PM2 |

---

## Production Checklist

- [ ] PostgreSQL database created on AURORA
- [ ] Database migrations applied (init-aurora-db.sql)
- [ ] Webhook handler deployed to Coolify or systemd
- [ ] Stripe product created ($49 one-time)
- [ ] Stripe payment link generated
- [ ] Stripe webhook endpoint configured
- [ ] All environment variables set in webhook handler
- [ ] Test payment completed successfully
- [ ] License key received via email
- [ ] License key validates in SHLLSHOCKD app
- [ ] README updated with payment link
- [ ] v1.1.0 tagged and released

---

## Cost Breakdown

- **AURORA PostgreSQL**: Already running, no additional cost
- **Webhook handler**: ~50MB RAM, ~0.1 CPU cores
- **Stripe**: 2.9% + $0.30 per transaction
- **Resend**: $0.20 per email (or free tier: 100/day)
- **Total per $49 sale**: $47.08 (after Stripe) → $46.88 (after email)

---

## Next Steps

1. Deploy webhook handler to AURORA
2. Configure Stripe webhook
3. Test end-to-end
4. Update README with payment link
5. Release v1.1.0
6. Product Hunt launch
7. Book integration (KDP)
