# BetterNic

The command center for domain investors: 37 free tools, daily auction and industry intelligence, and a 5% marketplace.

## How it runs (fully automatic)

A GitHub Action (`.github/workflows/daily.yml`) runs every day at 06:17 UTC, and whenever source files change:

1. `scripts/update_data.py` downloads public sources and writes `data/*.json`
   - GoDaddy Auctions public inventory → scored auction feed (`data/auctions.json`)
   - Industry RSS feeds → headlines (`data/news.json`)
   - YouTube channel feeds → videos (`data/videos.json`)
   - IANA root zone + RDAP bootstrap → `data/tlds.json`, `data/rdap.json`
   - wordfreq → `data/words.json` (generated on first run; delete it to regenerate)
   - Every source is isolated; failures keep yesterday's data and are logged in `data/status.json`.
2. `scripts/make_images.py` renders brand PNGs with headless Chrome if any are missing.
3. `scripts/build.py` renders every page into `public/` (home, 37 tool pages, marketplace, Daily Brief with a 30-day archive, news, videos, learn, legal, sitemap.xml, feed.xml, ads.txt).
4. The Action commits the result, which triggers a new deploy.

## Hosting

Works on **Vercel** (`vercel.json`) or **Netlify** (`netlify.toml`). Every deploy runs `scripts/deploy_build.py`: it restores yesterday's data and the Daily Brief archive from the live site, installs wordfreq + Pillow, renders images, refreshes data (unless refreshed in the last 6 hours), builds `public/`, and writes `public/data/forms.json`.

Vercel environment variables:

| Variable | Purpose |
|---|---|
| `WEB3FORMS_KEY` | Access key from web3forms.com, tied to the owner's inbox. All forms deliver there; the address never appears on the site. |
| `DEPLOY_HOOK_URL` | Project → Settings → Git → Deploy Hooks (branch `main`). Vercel Cron calls `/api/daily-refresh` daily, which triggers this hook. |
| `CRON_SECRET` | Any long random string; protects `/api/daily-refresh`. |

Alternatively, the GitHub Action `.github/workflows/daily.yml` (must be added by an account with the `workflow` permission) refreshes and commits data daily; its first run also deletes the retired v1/v2 files listed in `bootstrap.json`.

## Editing

| What | Where |
|---|---|
| Brand, AdSense ID, top banner, commission tiers, donation links, contest prize, news feeds, YouTube channels | `src/site.py` |
| Tool copy (intro, steps, FAQs) | `src/tools_a.py`, `src/tools_b.py`, `src/tools_c.py` |
| Tool behaviour | `assets/tools.js`, `assets/tools2.js`, `assets/appraise.js` (keep `scripts/appraise.py` in sync) |
| Marketplace, leads, contests, careers, support, advertise, compare | `src/pages.py` |
| Guides | `src/learn.py` · Glossary, compare list, brand screen: `src/refdata.py` |
| Privacy, terms, cookies, disclaimer, trademark/copyright | `src/legal.py` |
| Curated marketplace listings | `data/listings.json` (each listing gets `/d/<slug>.html`) |

Add a tool: add an entry to a `src/tools_*.py` list and a `T['slug']` function in `assets/tools2.js`.

## Forms

Forms post to Web3Forms when `WEB3FORMS_KEY` is set (any host), otherwise to Netlify Forms. No email address appears anywhere in the site.
On Netlify without a key: **Site configuration → Forms → Form notifications → Email notification** to the receiving inbox.

Forms: `contact`, `lead`, `sell-listing`, `offer`, `tool-lead`, `financing-waitlist`, `advertise`, `contest-entry`, `career-application`, `donation-pledge`, `newsletter`, `legal-notice`.

## AdSense

- Auto ads script is in the `<head>` of every content page (not on 404 / thank-you).
- `ads.txt` is generated at the site root.
- Consent Mode v2 defaults to denied for EEA/UK/CH with a cookie banner; for full EEA compliance also enable Google's certified CMP in AdSense → Privacy & messaging.

## Local build

```
python3 scripts/deploy_build.py   # needs internet
python3 -m http.server -d public 8080
```

`supabase-schema.sql` (repo root, not published) is kept for the future account system.
