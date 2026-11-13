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
4. The Action commits the result, which triggers a Netlify deploy.

Netlify also builds on its own: every deploy runs `scripts/netlify_build.py` (installs wordfreq + Pillow, renders images, refreshes data unless the Action did so in the last 20 hours, then runs `build.py`). So the site is complete and current on every deploy, and the Action adds the guaranteed daily refresh plus the 30-day Daily Brief archive.

### Activating the daily schedule

GitHub only lets workflow files be added by an account with the `workflow` permission. If `.github/workflows/daily.yml` is not in the repo yet, add it once: GitHub → **Add file → Create new file** → name it `.github/workflows/daily.yml` → paste the workflow → **Commit**. Then check **Settings → Actions → General → Workflow permissions** is set to **Read and write**. The first run also deletes the retired v1/v2 files listed in `bootstrap.json`.

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

All forms are Netlify Forms (`data-netlify="true"`). No email address appears anywhere in the site.
In Netlify: **Site configuration → Forms → Form notifications → Add notification → Email notification**, choose "Any form", and enter the inbox that should receive submissions.

Forms: `contact`, `lead`, `sell-listing`, `offer`, `tool-lead`, `financing-waitlist`, `advertise`, `contest-entry`, `career-application`, `donation-pledge`, `newsletter`, `legal-notice`.

## AdSense

- Auto ads script is in the `<head>` of every content page (not on 404 / thank-you).
- `ads.txt` is generated at the site root.
- Consent Mode v2 defaults to denied for EEA/UK/CH with a cookie banner; for full EEA compliance also enable Google's certified CMP in AdSense → Privacy & messaging.

## Local build

```
python3 scripts/update_data.py   # needs internet
python3 scripts/build.py
python3 -m http.server -d public 8080
```

`supabase-schema.sql` (repo root, not published) is kept for the future account system.
