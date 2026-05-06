# BetterNic — Phase 1 MVP

A better way to buy, sell, and lease domains.

## What's in here

A complete static-HTML domain marketplace, ready to deploy without Node.js or any build step. Edit any file in any text editor — drop the folder on Netlify or Cloudflare Pages — done.

## Pages

| Page | What it does |
|------|---|
| `index.html` | Marketplace homepage — search, featured domains, value props |
| `lander.html` | Domain for-sale page (the conversion-critical page) |
| `dashboard.html` | Seller dashboard — portfolio, inquiries, payouts |
| `listing-new.html` | Add a new listing |
| `checkout.html` | Buyer checkout — Stripe / Escrow / Wire / LTO |
| `browse.html` | All domains with filters and sort |
| `login.html` | Sign in / sign up |

## Stack

- **Frontend**: Vanilla HTML + CSS + JS. Zero build step. Edit anywhere.
- **Backend**: Supabase (Postgres + Auth + RLS)
- **Payments**: Stripe + Escrow.com (escrow-agnostic at checkout)
- **Hosting**: Static — deploy to Netlify, Cloudflare Pages, GitHub Pages, anywhere

## Setup (5 minutes)

### 1. Create a Supabase project
1. Go to https://supabase.com/dashboard
2. Create a new project (free tier is fine for MVP)
3. Wait ~2 minutes for it to provision

### 2. Run the schema
1. In Supabase, go to **SQL Editor** → **New query**
2. Copy the entire contents of `supabase-schema.sql`
3. Paste and click **Run**
4. Confirm tables created in **Table Editor**

### 3. Get your credentials
1. Go to **Project Settings → API**
2. Copy your **Project URL** and **anon/public key**
3. Open `lib/config.js`
4. Replace `YOUR-PROJECT` and `YOUR-ANON-PUBLIC-KEY` with your values

### 4. Enable email auth
1. Go to **Authentication → Providers**
2. Enable **Email** provider
3. Optionally disable "Confirm email" for faster testing

### 5. Deploy

**Option A — Netlify (drag and drop)**
1. Go to https://app.netlify.com/drop
2. Drag the entire `betternic` folder onto the page
3. Done. Connect your domain.

**Option B — Cloudflare Pages**
1. Push to GitHub (or use Direct Upload)
2. Cloudflare Pages → Create project → Direct Upload
3. Connect betternic.com

**Option C — GitHub Pages**
1. Push to a GitHub repo
2. Settings → Pages → Deploy from main branch → /root
3. Custom domain: betternic.com

## Connecting BetterNic.com

Once deployed:
1. Add custom domain in your hosting provider
2. Update DNS at your registrar:
   - **A record**: @ → hosting IP
   - **CNAME**: www → your-site.netlify.app (or pages dev URL)
3. Wait 5-15 min for SSL provisioning

## What's NOT built yet (intentionally — Phase 2+)

These are deliberate Phase 1 cuts, all on the roadmap:

- **Real Stripe/Escrow integration** — UI is wired, server-side webhook handlers come Phase 2 (requires Supabase Edge Functions or a serverless layer)
- **LTO automation engine** — Phase 2 (Stripe subscriptions + cron job for monthly auto-debits)
- **Domain custody / DNS automation** — Phase 2 (registrar API integration with Namecheap/Dynadot)
- **AI lead scoring + chat** — Phase 3
- **Bulk import** — Phase 3
- **Public seller profiles** — Phase 4
- **Afternic/Sedo distribution opt-in** — Phase 5

## Mock mode

If you don't connect Supabase, the site runs on mock data automatically. Useful for showing demos before going live. You'll see 8 sample domains, can browse, and can navigate the full UI flow. Real auth and listing creation require Supabase.

## Commission model (locked in)

- 5% flat under $50K
- 4% over $50K
- 3% over $100K
- 0% on buyer-brought leads (Phase 2 feature)

LTO markup tiers (matches Dan.com's old model):
- 12 months: 0% markup
- 24 months: 10%
- 36 months: 20%
- 48 months: 25%
- 60 months: 30%

50% of LTO markup goes to the seller, 50% to BetterNic.

## File structure

```
betternic/
├── index.html              # Marketplace home
├── lander.html             # Domain for-sale page
├── dashboard.html          # Seller dashboard
├── listing-new.html        # Add new listing
├── checkout.html           # Buyer checkout
├── browse.html             # Browse all domains
├── login.html              # Auth
├── favicon.svg             # B monogram favicon
├── supabase-schema.sql     # Run this in Supabase SQL editor
├── styles/
│   ├── main.css            # Design system
│   ├── lander.css          # Lander-specific styles
│   ├── dashboard.css       # Dashboard styles
│   ├── checkout.css        # Checkout styles
│   ├── auth.css            # Login/signup styles
│   └── browse.css          # Browse page styles
└── lib/
    ├── config.js           # Supabase config + commission helpers
    ├── api.js              # All Supabase API calls + mock fallback
    ├── home.js             # Homepage logic
    ├── lander.js           # Lander logic
    ├── dashboard.js        # Dashboard logic
    ├── listing-new.js      # New listing form
    ├── checkout.js         # Checkout flow
    ├── browse.js           # Browse + filter logic
    └── auth.js             # Login/signup
```

## Brand

- **Name**: BetterNic
- **Domain**: BetterNic.com
- **Tagline**: A better way to buy, sell, and lease domains.
- **Colors**: Black (#0A0A0A) + warm white (#FAFAFA), green for success, blue for info
- **Typography**: Inter, weight 500 max
- **Logo**: B monogram in rounded square

---

Built by Web. Ready to ship.
