# BetterNic v2 — Payment Methods Update

## What changed

Added flexibility for sellers to choose from **10 payment/escrow methods** when listing a domain. Buyers see only the methods the seller accepts.

The 5/4/3% commission structure is unchanged.

## Files changed

### New files
- `lib/payment-options.js` — Single source of truth for the 10 payment methods

### Modified files
- `lib/config.js` — minor cleanup
- `listing-new.html` — new "How you want to be paid" section
- `lib/listing-new.js` — multi-select payment methods, validation
- `lander.html` — added "Accepted methods" strip below CTA
- `lib/lander.js` — render seller's payment methods on lander
- `checkout.html` — payment options now dynamic
- `lib/checkout.js` — filters options to only seller's accepted methods
- `lib/api.js` — mock data updated with payment_methods on each listing
- `styles/main.css` — new payment method card styles
- `styles/checkout.css` — new badge/meta styles for checkout options
- `supabase-schema.sql` — new `payment_methods` JSONB column + commission tracking

## The 10 payment methods

1. **BetterNic-managed** (default) — we handle Stripe + Escrow.com
2. **Escrow.com** — direct, seller's account
3. **Sedo External Escrow** — email-initiated
4. **Afternic Escrow** — seller arranges
5. **Atom.com Escrow** — seller arranges
6. **Efty Escrow** — seller arranges
7. **Stripe** (seller's own) — seller's payment link
8. **PayPal** — direct PayPal
9. **Wire to BetterNic** — we receive, forward to seller
10. **Custom** — seller types free-text instructions

## How commission collection works (NEW)

For each method, the `commission_status` is tracked separately:

- **`auto_deducted`** — BetterNic-managed + Wire-to-BetterNic: auto-pulled
- **`split_at_escrow`** — Escrow.com (and others that support disbursement split)
- **`invoice_sent`** — All other methods: seller invoiced post-sale, 7-day terms
- **`overdue`** — 7+ days past sale, no payment
- **`written_off`** — gave up

## How to deploy this update

If you've already deployed v1:

```bash
cd ~/Downloads/betternic
# Replace existing files with v2 versions (unzip update zip overwrites)
unzip -o betternic-v2-update.zip
git add .
git commit -m "v2: payment methods multi-select"
git push
```

Netlify auto-redeploys in ~30 seconds.

If you've already created Supabase tables, run **just the new ALTER statements**:

```sql
ALTER TABLE listings
ADD COLUMN IF NOT EXISTS payment_methods jsonb default '["betternic"]'::jsonb,
ADD COLUMN IF NOT EXISTS custom_payment_instructions text;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS commission_status text default 'pending',
ADD COLUMN IF NOT EXISTS external_transaction_ref text,
ADD COLUMN IF NOT EXISTS notes text;
```

(Or just run the full updated `supabase-schema.sql` — it's idempotent with `IF NOT EXISTS` and `on conflict do nothing`.)

## Testing

Test these flows after deploy:

1. **Listing flow** — go to `/listing-new.html`, scroll to section 3, select multiple payment methods, pick "Custom" → custom instructions field should appear.
2. **Lander page** — go to `/lander.html?d=tokenmint.io` → should show "Accepted: BetterNic · Escrow.com +2 more" pill below CTAs.
3. **Checkout flow** — go to `/checkout.html?d=brewstack.com` → should show ONLY PayPal and Stripe (the methods that seller selected) — NOT all 10.
4. **Custom instructions** — go to `/checkout.html?d=tokenmint.io` → should show the seller's custom payment instructions in a callout box.
