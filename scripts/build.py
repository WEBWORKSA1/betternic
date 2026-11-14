#!/usr/bin/env python3
"""Build the BetterNic static site into ./public from src/ content and data/ feeds. Stdlib only."""
import datetime
import hashlib
import json
import os
import re
import shutil
import sys
from pathlib import Path
from xml.sax.saxutils import escape as xesc

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.site import SITE, PAYMENT_METHODS  # noqa: E402
from src.lib import e, layout, faq_block, breadcrumbs, form, field, select, contact_fields, consent_field, newsletter_form, jsonld  # noqa: E402
from src.tools_a import TOOLS_A  # noqa: E402
from src.tools_b import TOOLS_B  # noqa: E402
from src.tools_c import TOOLS_C  # noqa: E402
from src.refdata import PLATFORMS, GLOSSARY, BRANDS  # noqa: E402
from src.learn import GUIDES  # noqa: E402
from src import legal, pages  # noqa: E402

TOOLS = TOOLS_A + TOOLS_B + TOOLS_C
TOOL_BY = {t["slug"]: t for t in TOOLS}
CATS = [("research", "Research & lookup", "Registration, DNS, history and reputation in seconds."),
        ("value", "Valuation & pricing", "Transparent estimates and pricing you can defend."),
        ("buy", "Find & acquire", "Auctions, drops, name ideas and acquisition outreach."),
        ("sell", "Sell & market", "Landers, social cards, outreach, fees and lease-to-own."),
        ("portfolio", "Portfolio & money", "Track renewals, ROI, parking income and financing."),
        ("legal", "Legal & protection", "Trademarks, typosquats and UDRP risk.")]
ICON = {
    "research": '<path d="M11 4a7 7 0 1 0 4.2 12.6l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"/>',
    "value": '<path d="M12 2 3 7v2h18V7l-9-5Zm-7 9v7h2v-7H5Zm6 0v7h2v-7h-2Zm6 0v7h2v-7h-2ZM3 20v2h18v-2H3Z"/>',
    "buy": '<path d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM1 2v2h2l3.6 7.6-1.35 2.4A2 2 0 0 0 7 17h12v-2H7.4l1.1-2h7.45a2 2 0 0 0 1.75-1L21 5H5.2l-.95-3H1Zm16 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>',
    "sell": '<path d="M21 11.6 12.4 3H4v8.4l8.6 8.6a2 2 0 0 0 2.8 0l5.6-5.6a2 2 0 0 0 0-2.8ZM7.5 9A1.5 1.5 0 1 1 9 7.5 1.5 1.5 0 0 1 7.5 9Z"/>',
    "portfolio": '<path d="M9 3h6a2 2 0 0 1 2 2v2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V5a2 2 0 0 1 2-2Zm0 4h6V5H9v2Z"/>',
    "legal": '<path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm-1 14-4-4 1.4-1.4 2.6 2.6 5.6-5.6L18 9l-7 7Z"/>',
}


def icon(cat):
    return f'<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{ICON[cat]}</svg>'


def load(name, default):
    p = ROOT / "data" / f"{name}.json"
    try:
        return json.loads(p.read_text())
    except Exception:
        return default


def money(v):
    return "${:,.0f}".format(v) if v is not None else "—"


def tool_card(t):
    return (f'<a class="card tool-card" href="/tools/{t["slug"]}.html" data-text="{e((t["name"] + " " + t["short"]).lower())}" data-cat="{t["cat"]}">'
            f'<span class="ico">{icon(t["cat"])}</span><h3>{e(t["name"])}</h3><p>{e(t["short"])}</p></a>')


def news_list(items, n=None):
    items = items[:n] if n else items
    if not items:
        return '<div class="empty">Today\'s headlines are being collected. Check back shortly.</div>'
    return '<ul class="news-list">' + "".join(
        f'<li data-text="{e((it["title"] + " " + it["source"]).lower())}" data-cat="{e(slug(it["source"]))}"><span class="src">{e(it["source"])}</span>'
        f'<a href="{e(it["link"])}" target="_blank" rel="noopener">{e(it["title"])}</a><time datetime="{e(it.get("date", ""))}">{e((it.get("date") or "")[:10])}</time></li>'
        for it in items) + "</ul>"


def video_cards(items, n=None):
    items = items[:n] if n else items
    if not items:
        return '<div class="empty">New videos are being collected. Check back shortly.</div>'
    out = []
    for v in items:
        if not re.fullmatch(r"[\w-]{11}", v.get("id", "")):
            continue
        out.append(f'<div class="video-card"><button class="yt" type="button" data-id="{e(v["id"])}" aria-label="Play: {e(v["title"])}">'
                   f'<img loading="lazy" src="https://i.ytimg.com/vi/{e(v["id"])}/hqdefault.jpg" alt="" width="480" height="360"><span class="play"></span></button>'
                   f'<h3>{e(v["title"])}</h3><p class="small">{e(v.get("channel", ""))} · {e((v.get("date") or "")[:10])}</p></div>')
    return '<div class="video-grid">' + "".join(out) + "</div>"


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def bid_link(a, cls=""):
    if not a.get("l"):
        return ""
    c = f' class="{cls}"' if cls else ""
    return f'<a{c} href="{e(a["l"])}" target="_blank" rel="noopener nofollow">Bid ↗</a>'


def featured(items):
    """Auction names eligible for editorial spots: not flagged as sensitive, highest BetterNic score first."""
    return sorted((a for a in items if not a.get("k")), key=lambda a: (-a["s"], a.get("p") or 0))


def auction_rows(items):
    return "".join(
        f'<tr><td class="dn"><a href="/tools/domain-report.html?d={e(a["d"])}">{e(a["d"])}</a></td><td class="num">{a["s"]}</td>'
        f'<td class="num">{money(a.get("p"))}</td><td class="num">{a.get("b") if a.get("b") is not None else "—"}</td>'
        f'<td data-until="{e(a.get("e") or "")}">—</td><td>{bid_link(a)}</td></tr>'
        for a in items)


class Site:
    def __init__(self):
        self.date = datetime.datetime.now(datetime.timezone.utc).date()
        if os.environ.get("BUILD_DATE"):
            self.date = datetime.date.fromisoformat(os.environ["BUILD_DATE"])
        self.bd = self.date.isoformat()
        self.out = ROOT / "public"
        self.pages = []  # (path, lastmod, priority, changefreq)
        self.auctions = load("auctions", {"items": []})
        self.news = load("news", {"items": []})
        self.videos = load("videos", {"items": []})
        self.tlds = load("tlds", {"tlds": []})
        self.status = load("status", {})
        self.listings = [l for l in load("listings", {"items": []}).get("items", []) if l.get("domain") and l.get("active", True)]
        for l in self.listings:
            l.setdefault("slug", slug(l["domain"]))
        self.ctx = {"date": self.date, "auctions": self.auctions.get("items", []), "listings": self.listings}

    # ------------------------------------------------------------ io
    def write(self, path, page, priority=0.6, freq="weekly", lastmod=None, index=True):
        page.setdefault("path", path)
        html = layout(page, self.bd)
        fp = self.out / path.lstrip("/")
        if path.endswith("/"):
            fp = fp / "index.html"
        fp.parent.mkdir(parents=True, exist_ok=True)
        fp.write_text(html, encoding="utf-8")
        if index and not page.get("noindex"):
            self.pages.append((path, lastmod or SITE["content_date"], priority, freq))

    def run(self):
        if self.out.exists():
            shutil.rmtree(self.out)
        (self.out / "data").mkdir(parents=True)
        shutil.copytree(ROOT / "assets", self.out / "assets")
        shutil.copy(ROOT / "assets" / "favicon.svg", self.out / "favicon.svg")
        self.copy_data()
        self.home()
        self.tools_index()
        for t in TOOLS:
            self.tool_page(t)
        self.section_pages()
        self.learn()
        self.news_page()
        self.videos_page()
        self.briefs()
        self.company_pages()
        self.static_files()
        print(f"Built {len(self.pages)} indexable pages into {self.out}")

    def copy_data(self):
        for name in ["auctions", "news", "videos", "tlds", "rdap", "words", "status", "brief"]:
            src = ROOT / "data" / f"{name}.json"
            if src.exists():
                shutil.copy(src, self.out / "data" / f"{name}.json")
        (self.out / "data" / "listings.json").write_text(json.dumps({"items": self.listings}))
        brands = sorted(set(b.strip() for b in BRANDS if b.strip()), key=str.lower)
        (self.out / "data" / "brands.json").write_text(json.dumps({"brands": brands}))
        for name, default in [("auctions", {"items": []}), ("news", {"items": []}), ("videos", {"items": []}), ("tlds", {"tlds": []}),
                              ("rdap", {"services": {}}), ("words", {"words": []})]:
            p = self.out / "data" / f"{name}.json"
            if not p.exists():
                p.write_text(json.dumps(default))

    # ------------------------------------------------------------ stats
    def stats(self):
        a = self.auctions.get("items", [])
        return [
            (f'{len(a):,}' if a else "—", "Auctions tracked today"),
            (f'{len(self.news.get("items", [])):,}' if self.news.get("items") else "—", "Industry headlines"),
            (f'{len(self.tlds.get("tlds", [])):,}' if self.tlds.get("tlds") else "1,400+", "TLDs in the root zone"),
            (str(len(TOOLS)), "Free tools"),
            ("5%", "Seller commission"),
        ]

    def dotd(self):
        items = [a for a in featured(self.auctions.get("items", [])) if not re.search(r"[-0-9]", a["d"].split(".")[0])]
        if not items:
            return None
        idx = self.date.toordinal() % min(5, len(items))
        return items[idx]

    # ------------------------------------------------------------ home
    def home(self):
        st = "".join(f'<div class="stat"><b>{e(v)}</b><span>{e(l)}</span></div>' for v, l in self.stats())
        feat = ["domain-report", "domain-appraisal", "domain-auctions", "whois-lookup", "domain-name-generator", "bulk-domain-checker",
                "trademark-search", "lease-to-own-calculator", "portfolio-tracker", "for-sale-lander-builder", "drop-date-calculator", "brandability-score"]
        tools = "".join(tool_card(TOOL_BY[s]) for s in feat)
        d = self.dotd()
        dotd = ""
        if d:
            dotd = (f'<section class="section"><div class="card dotd"><div><p class="eyebrow"><span class="live-dot"></span> Domain of the day · {self.date.strftime("%B %-d, %Y")}</p>'
                    f'<div class="dn dn-xl">{e(d["d"])}</div><p class="muted">Top-scored name in today\'s expiring auctions. BetterNic score <b>{d["s"]}</b>'
                    f'{" · current price " + money(d.get("p")) if d.get("p") is not None else ""}{" · " + str(d.get("b")) + " bids" if d.get("b") else ""}.</p>'
                    f'<div class="tool-actions"><a class="btn btn-primary" href="/tools/domain-report.html?d={e(d["d"])}">Run the report</a>'
                    f'{bid_link(d, "btn btn-ghost")}</div></div>'
                    f'<div><p class="small">Why it scored well</p><ul class="check-list"><li>{len(d["d"].split(".")[0])} characters, .{e(d["tl"])}</li><li>BetterNic score {d["s"]}/99 (name and extension)</li><li>{"Traffic: " + str(d["t"]) + " visits" if d.get("t") else "Ends " + (d.get("e") or "")[:10]}</li></ul></div></div></section>')
        top = featured(self.auctions.get("items", []))[:8]
        auc = (f'<div class="table-wrap"><table><thead><tr><th>Domain</th><th class="num">Score</th><th class="num">Price</th><th class="num">Bids</th><th>Ends</th><th></th></tr></thead><tbody>{auction_rows(top)}</tbody></table></div>'
               if top else '<div class="empty">Today\'s auction feed is refreshing.</div>')
        trows = "".join(f'<div class="today-row"><a class="dn" href="/tools/domain-report.html?d={e(a["d"])}">{e(a["d"])}</a><span class="muted">score {a["s"]} · {money(a.get("p"))}</span></div>' for a in top[:4])
        n0 = (self.news.get("items") or [None])[0]
        today = ('<aside class="today"><h2><span class="live-dot"></span> Today on BetterNic</h2>'
                 + (trows or '<p class="muted">Auction feed refreshing…</p>')
                 + (f'<p class="small" style="margin:14px 0 0">Latest headline · {e(n0["source"])}</p><a class="news-line" href="{e(n0["link"])}" target="_blank" rel="noopener">{e(n0["title"])}</a>' if n0 else "")
                 + '<div class="tool-actions" style="margin-top:6px"><a class="btn btn-primary btn-sm" href="/brief/">Read the Daily Brief</a><a class="btn btn-ghost btn-sm" href="/tools/domain-auctions.html">All auctions</a></div></aside>')
        intents = "".join(f'<a class="card" href="/leads.html?intent={k}"><h3>{e(t)}</h3><p class="muted">{e(dsc)}</p></a>' for k, t, dsc in pages.INTENTS[:3])
        faqs = [("Is BetterNic free?", f"Yes. All {len(TOOLS)} tools, the daily auction feed, news and the Daily Brief are free. The site is supported by advertising, sponsorships and a commission only when a listed domain sells."),
                ("How is the data updated?", "An automated pipeline runs every day: it downloads public auction inventory, industry news feeds, new videos and IANA's root zone and registration-server lists, scores everything and rebuilds the site."),
                ("What does it cost to sell a domain?", "Listing is free. Commission is 5% under $50,000, 4% from $50,000 and 3% from $100,000."),
                ("Can BetterNic help me buy a domain someone else owns?", "Yes. Use the acquisition request and a broker will contact the owner confidentially.")]
        fb, fs = faq_block(faqs)
        body = f"""<div class="wrap">
<section class="hero"><div class="hero-grid"><div><p class="eyebrow"><span class="live-dot"></span> Updated {self.date.strftime('%B %-d, %Y')}</p>
<h1>The command center for domain investors.</h1>
<p class="lead">{len(TOOLS)} free tools, daily auction and industry intelligence, and a marketplace that charges 5% — so you can find, value, buy, sell and finance domain names in one place.</p>
<form class="search-hero" data-domain-search role="search"><label class="sr" for="hs">Domain or keyword</label><input id="hs" type="text" placeholder="Enter a domain to analyse — or a keyword for name ideas" autocomplete="off" spellcheck="false"><button class="btn btn-primary btn-lg" type="submit">Analyse</button></form>
<div class="hero-hints">Try: <a href="/tools/domain-report.html?d=example.com">example.com</a><a href="/tools/domain-name-generator.html?q=solar">solar</a><a href="/tools/domain-appraisal.html?d=nova.ai">nova.ai</a></div>
</div>{today}</div></section>
<div class="stats">{st}</div>
{dotd}
<section class="section"><div class="section-head"><div><h2>Most-used tools</h2><p>Every tool is free, runs in your browser and needs no account.</p></div><a class="btn btn-ghost" href="/tools/">All {len(TOOLS)} tools →</a></div><div class="tool-grid">{tools}</div></section>
<section class="section"><div class="section-head"><div><h2>Expiring auctions worth a look</h2><p>Scored daily from public auction inventory. Bid at the source.</p></div><a class="btn btn-ghost" href="/tools/domain-auctions.html">Full auction feed →</a></div>{auc}</section>
</div>
<section class="band section"><div class="wrap"><div class="section-head"><div><h2>Get buyers, brokers and expert help</h2><p>Tell us what you need — a specialist replies within one business day.</p></div><a class="btn btn-accent" href="/leads.html">Free consultation</a></div><div class="grid-3">{intents}</div></div></section>
<div class="wrap">
<section class="section"><div class="grid-2"><div><div class="section-head"><h2>Industry news</h2><a href="/news.html">All news →</a></div>{news_list(self.news.get('items', []), 8)}</div>
<div><div class="section-head"><h2>Watch &amp; learn</h2><a href="/videos.html">All videos →</a></div>{video_cards(self.videos.get('items', []), 2)}
<div class="card" style="margin-top:16px"><h3>Today's Daily Brief</h3><p class="muted">Auctions, headlines and the domain of the day in one page.</p><a class="btn btn-ghost btn-sm" href="/brief/">Read the brief</a></div></div></div></section>
<section class="section"><div class="cta-band card"><div><p class="eyebrow">Domain financing · waitlist</p><h2>Unlock liquidity from your domains</h2><p class="muted">We're building a peer-funded marketplace for domain-backed bridge loans. Be first in line as a borrower or a funder.</p></div><div><a class="btn btn-primary btn-lg" href="/financing.html">Join the waitlist</a></div></div></section>
<section class="section"><div class="grid-3"><a class="card" href="/contests.html"><p class="eyebrow">Monthly contest</p><h3>{e(pages.THEMES[(self.date.year * 12 + self.date.month) % len(pages.THEMES)])}</h3><p class="muted">Free to enter. Win a homepage spotlight, a featured listing and 0% commission on a sale.</p></a>
<a class="card" href="/careers.html"><p class="eyebrow">Careers</p><h3>Join the team</h3><p class="muted">Brokers, writers, developers and video creators — remote.</p></a>
<a class="card" href="/support.html"><p class="eyebrow">Support us</p><h3>Keep the tools free</h3><p class="muted">Contributions fund operations, marketing, hiring and contest prizes.</p></a></div></section>
{fb}
</div>"""
        self.write("/", {"title": f"{SITE['name']} — Free Domain Tools, Daily Auctions & 5% Domain Marketplace",
                         "description": f"{len(TOOLS)} free domain investing tools — appraisal, WHOIS, auctions, name generator, portfolio tracker — plus daily auction and news intelligence and a 5% commission marketplace.",
                         "body": body, "schema": [fs]}, priority=1.0, freq="daily", lastmod=self.bd)

    # ------------------------------------------------------------ tools
    def tools_index(self):
        cr, sch = breadcrumbs([("Home", "/"), ("Tools", None)])
        secs = ""
        for k, name, desc in CATS:
            cards = "".join(tool_card(t) for t in TOOLS if t["cat"] == k)
            secs += f'<h2 class="cat-title" id="{k}">{e(name)} <span class="small">— {e(desc)}</span></h2><div class="tool-grid">{cards}</div>'
        opts = "".join(f'<option value="{k}">{e(n)}</option>' for k, n, _ in CATS)
        body = (f'<div class="wrap">{cr}<section class="page-hero"><p class="eyebrow">Free · no sign-up</p><h1>{len(TOOLS)} free domain investing tools</h1>'
                '<p class="lead">Research, value, buy, sell, track and protect domain names. Every tool runs in your browser and links to the next step.</p></section>'
                f'<div class="filters"><input type="search" placeholder="Search tools" data-filter-input="#alltools" data-filter-select="#tcat" data-filter-count="#tcount"><select id="tcat"><option value="">All categories</option>{opts}</select><span class="small"><b id="tcount">{len(TOOLS)}</b> tools</span></div>'
                f'<div id="alltools">{secs}</div></div>')
        itemlist = {"@context": "https://schema.org", "@type": "ItemList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "url": f'{SITE["url"]}/tools/{t["slug"]}.html', "name": t["name"]} for i, t in enumerate(TOOLS)]}
        self.write("/tools/", {"title": f"{len(TOOLS)} Free Domain Tools — WHOIS, Appraisal, Auctions, Generator & More",
                               "description": "Free domain investing tools: WHOIS and DNS lookup, appraisal, auctions, name generator, bulk checker, portfolio tracker, trademark and UDRP checks.",
                               "body": body, "schema": [sch, itemlist]}, priority=0.9, freq="weekly")

    def tool_page(self, t):
        catname = dict((k, n) for k, n, _ in CATS)[t["cat"]]
        cr, sch = breadcrumbs([("Home", "/"), ("Tools", "/tools/"), (catname, f"/tools/#{t['cat']}"), (t["name"], None)])
        fb, fs = faq_block(t["faqs"])
        steps = "".join(f"<li>{s}</li>" for s in t["steps"])
        uses = "".join(f"<li>{s}</li>" for s in t["uses"])
        tips = "".join(f"<li>{s}</li>" for s in t["tips"])
        rel = "".join(f'<a href="/tools/{r}.html">{e(TOOL_BY[r]["name"])}</a>' for r in t["related"] if r in TOOL_BY)
        lead = form("tool-lead",
                    f'<input type="hidden" name="tool" value="{e(t["slug"])}">' + field("Domain", "domain", placeholder="example.com")
                    + select("I want to", "intent", [("sell", "Sell it"), ("buy", "Buy it"), ("appraisal", "Get an expert appraisal"), ("other", "Something else")], required=True)
                    + field("Email", "email", "email", required=True, attrs='autocomplete="email"') + consent_field(),
                    submit="Get expert help", success="Thanks — a specialist will email you within one business day.")
        auction_note = ""
        if t["slug"] == "domain-auctions" and self.auctions.get("items"):
            top = featured(self.auctions["items"])[:10]
            auction_note = (f'<h2>Today\'s top-scored auctions ({self.date.strftime("%B %-d, %Y")})</h2>'
                            f'<div class="table-wrap"><table><thead><tr><th>Domain</th><th class="num">Score</th><th class="num">Price</th><th class="num">Bids</th><th>Ends</th><th></th></tr></thead><tbody>{auction_rows(top)}</tbody></table></div>')
        body = f"""<div class="wrap">{cr}
<section class="page-hero"><p class="eyebrow">{icon(t['cat'])} Free tool · {e(catname)}</p><h1>{e(t['name'])}</h1><p class="lead">{e(t['short'])}</p></section>
<div id="tool" class="tool-shell" data-tool="{t['slug']}"><noscript><p>This tool runs in your browser and needs JavaScript enabled.</p></noscript></div>
<div class="layout-2 section"><article class="prose">
{t['intro']}
{auction_note}
<h2>How to use the {e(t['name'])}</h2><ol>{steps}</ol>
<h2>How it works</h2>{t['how']}
<h2>When to use it</h2><ul>{uses}</ul>
<h2>Pro tips</h2><ul>{tips}</ul>
{fb}
</article>
<aside class="sidebar"><div class="card"><h3>Want an expert on it?</h3><p class="small">Sell, buy or value a domain with a BetterNic specialist. Free consultation.</p>{lead}</div>
<div class="card"><h3>Related tools</h3><p class="toc">{rel}</p></div>
<div class="card"><h3>Sell with BetterNic</h3><p class="small">List free. 5% commission only when it sells.</p><a class="btn btn-accent btn-sm" href="/sell.html">List a domain</a></div></aside></div></div>"""
        app = {"@context": "https://schema.org", "@type": "WebApplication", "name": f"{t['name']} — {SITE['name']}", "url": f"{SITE['url']}/tools/{t['slug']}.html",
               "applicationCategory": "BusinessApplication", "operatingSystem": "Any", "browserRequirements": "Requires JavaScript",
               "description": t["short"], "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}
        self.write(f"/tools/{t['slug']}.html", {"title": t["title"], "description": t["short"], "body": body, "schema": [sch, fs, app],
                                                 "scripts": ["/assets/appraise.js", "/assets/tools.js", "/assets/tools2.js"], "current": "/tools/"},
                   priority=0.8, freq="daily" if t["slug"] in ("domain-auctions", "tld-explorer") else "monthly",
                   lastmod=self.bd if t["slug"] in ("domain-auctions", "tld-explorer") else None)

    # ------------------------------------------------------------ sections
    def section_pages(self):
        for path, fn, title, desc, pri in [
            ("/marketplace.html", pages.marketplace, "Domains for Sale — Owner Listings & Today's Best Auctions", "Browse domains for sale direct from owners at a 5% commission, plus today's best expiring domain auctions.", .9),
            ("/sell.html", pages.sell, "Sell Your Domain Name — Free Listing, 5% Commission, Lease to Own", "List your domain free and sell for a 5% commission (4% from $50k, 3% from $100k). Ten payment methods and lease-to-own.", .9),
            ("/pricing.html", pages.pricing, "Pricing & Commission — 5% / 4% / 3%, No Listing Fees", "BetterNic pricing: free listing, 5% commission under $50,000, 4% from $50,000 and 3% from $100,000, plus lease-to-own markups.", .7),
            ("/leads.html", pages.leads, "Get Domain Buyers, Brokers & Expert Help — Free Consultation", "Sell a domain, buy one confidentially, get an expert appraisal, lease, finance or resolve a dispute. Free consultation within one business day.", .9),
            ("/financing.html", pages.financing, "Domain Financing & Domain-Backed Loans — Waitlist", "Join the waitlist for BetterNic's peer-funded marketplace for domain-backed bridge loans, as a borrower or a funder.", .7),
            ("/advertise.html", pages.advertise, "Advertise to Domain Investors — Sponsorships & Media Kit", "Sponsor BetterNic tools, the Daily Brief or contest prizes to reach domain investors, brokers and founders.", .6),
            ("/contests.html", pages.contests, "Monthly Domain Naming Contest — Free to Enter", "Enter BetterNic's free monthly naming contest. Skill-based judging, official rules and prizes for domain investors and founders.", .6),
            ("/careers.html", pages.careers, "Careers — Domain Brokers, Writers, Developers (Remote)", "Join BetterNic: remote roles for domain brokers, writers, developers, sales, video and partnerships.", .5),
            ("/support.html", pages.support, "Support BetterNic — Keep the Domain Tools Free", "Contribute to keep BetterNic's free domain tools and daily data running: operations, marketing, hiring and contest prizes.", .5),
        ]:
            body, schema = fn(self.ctx)
            self.write(path, {"title": title, "description": desc, "body": body, "schema": schema}, priority=pri,
                       freq="daily" if path in ("/marketplace.html", "/contests.html") else "monthly",
                       lastmod=self.bd if path in ("/marketplace.html", "/contests.html") else None)
        body, schema = pages.compare(self.ctx, PLATFORMS)
        self.write("/compare.html", {"title": f"{len(PLATFORMS)} Domain Marketplaces, Auctions & Tools Compared",
                                     "description": "Compare domain marketplaces, auction houses, appraisal and data tools, news sources and dispute services — and what each is best for.",
                                     "body": body, "schema": schema}, priority=.7)
        body, schema = pages.domain_page()
        self.write("/domain.html", {"title": "Make an Offer on a Domain", "description": "Send an offer or buy request for a domain name.",
                                    "body": body.replace('<div class="grid-2">', '<div class="grid-2" data-listing-page>', 1), "schema": schema, "noindex": True})
        for l in self.listings:
            body, schema = pages.listing_page(l)
            self.write(f"/d/{l['slug']}.html", {"title": f"{l['domain']} is for sale" + (f" — {money(l['price'])}" if l.get("price") else ""),
                                                "description": f"Buy {l['domain']}" + (f" for {money(l['price'])}" if l.get("price") else "") + ". " + (l.get("tagline") or "Secure escrow and lease-to-own available."),
                                                "body": body, "schema": schema, "og_type": "product"}, priority=.7, lastmod=self.bd)

    # ------------------------------------------------------------ learn
    def learn(self):
        cr, sch = breadcrumbs([("Home", "/"), ("Learn", None)])
        cards = "".join(f'<a class="card" href="/learn/{g["slug"]}.html"><p class="eyebrow">{g["read"]} min read</p><h3>{e(g["title"])}</h3><p class="muted">{e(g["description"])}</p></a>' for g in GUIDES)
        cats = "".join(f'<a class="card" href="/tools/#{k}"><span class="ico" style="display:inline-grid">{icon(k)}</span><h3>{e(n)}</h3><p class="muted">{e(d)}</p></a>' for k, n, d in CATS)
        body = (f'<div class="wrap">{cr}<section class="page-hero"><p class="eyebrow">Guides</p><h1>Learn domain investing</h1><p class="lead">Practical guides to valuing, buying, selling, leasing and protecting domain names — each linked to the free tool that does the work.</p></section>'
                f'<div class="grid-3">{cards}<a class="card" href="/learn/glossary.html"><p class="eyebrow">Reference</p><h3>Domain investing glossary</h3><p class="muted">{len(GLOSSARY)} terms from aftermarket to WHOIS, in plain English.</p></a></div>'
                f'<section class="section"><h2>Tools by topic</h2><div class="grid-3">{cats}</div></section></div>')
        self.write("/learn/", {"title": "Learn Domain Investing — Guides & Glossary", "description": "Free guides to valuing, buying, selling, leasing and protecting domain names, plus a domain investing glossary.", "body": body, "schema": [sch]}, priority=.8)
        for g in GUIDES:
            cr, sch = breadcrumbs([("Home", "/"), ("Learn", "/learn/"), (g["title"], None)])
            heads = re.findall(r"<h2>(.*?)</h2>", g["body"])
            bodyhtml = g["body"]
            for h in heads:
                bodyhtml = bodyhtml.replace(f"<h2>{h}</h2>", f'<h2 id="{slug(re.sub("<[^>]+>", "", h))}">{h}</h2>', 1)
            toc = "".join(f'<a href="#{slug(re.sub("<[^>]+>", "", h))}">{h}</a>' for h in heads)
            others = "".join(f'<a href="/learn/{o["slug"]}.html">{e(o["title"])}</a>' for o in GUIDES if o is not g)
            art = {"@context": "https://schema.org", "@type": "Article", "headline": g["title"], "description": g["description"],
                   "datePublished": SITE["content_date"], "dateModified": SITE["content_date"], "author": {"@type": "Organization", "name": SITE["name"]},
                   "publisher": {"@type": "Organization", "name": SITE["name"], "logo": {"@type": "ImageObject", "url": SITE["url"] + "/assets/logo-512.png"}},
                   "mainEntityOfPage": f'{SITE["url"]}/learn/{g["slug"]}.html'}
            body = (f'<div class="wrap">{cr}<div class="layout-2"><article class="prose"><p class="eyebrow">{g["read"]} min read · Updated {SITE["content_date"]}</p><h1>{e(g["title"])}</h1>'
                    f'<p class="lead muted">{e(g["description"])}</p>{bodyhtml}'
                    '<div class="cta-band card" style="margin-top:32px"><div><h3>Need a hand with a real domain?</h3><p class="muted">Free consultation with a BetterNic specialist.</p></div><div><a class="btn btn-accent" href="/leads.html">Get expert help</a></div></div></article>'
                    f'<aside class="sidebar"><div class="card toc"><h3>On this page</h3>{toc}</div><div class="card toc"><h3>More guides</h3>{others}</div></aside></div></div>')
            self.write(f"/learn/{g['slug']}.html", {"title": g["title"], "description": g["description"], "body": body, "schema": [sch, art], "og_type": "article", "current": "/learn/"}, priority=.8)
        cr, sch = breadcrumbs([("Home", "/"), ("Learn", "/learn/"), ("Glossary", None)])
        terms = sorted(GLOSSARY, key=lambda x: x[0].lower())
        dl = "".join(f'<div class="card" id="{slug(t)}" data-text="{e((t + " " + d).lower())}"><h3>{e(t)}</h3><p class="muted">{e(d)}</p></div>' for t, d in terms)
        dts = {"@context": "https://schema.org", "@type": "DefinedTermSet", "name": "Domain investing glossary",
               "hasDefinedTerm": [{"@type": "DefinedTerm", "name": t, "description": d} for t, d in terms]}
        body = (f'<div class="wrap">{cr}<section class="page-hero"><h1>Domain investing glossary</h1><p class="lead">{len(terms)} terms every domain investor, broker and founder should know.</p></section>'
                f'<div class="filters"><input type="search" placeholder="Search terms" data-filter-input="#gl" data-filter-count="#glc"><span class="small"><b id="glc">{len(terms)}</b> terms</span></div><div class="grid-2" id="gl">{dl}</div></div>')
        self.write("/learn/glossary.html", {"title": "Domain Investing Glossary — Aftermarket, Drops, UDRP, RDAP & More", "description": "Plain-English definitions of domain investing terms: aftermarket, backorder, drop, escrow, lease to own, RDAP, redemption, UDRP and more.", "body": body, "schema": [sch, dts], "current": "/learn/"}, priority=.6)

    # ------------------------------------------------------------ news / videos
    def news_page(self):
        cr, sch = breadcrumbs([("Home", "/"), ("News", None)])
        items = self.news.get("items", [])
        srcs = sorted(set(i["source"] for i in items))
        opts = "".join(f'<option value="{slug(s)}">{e(s)}</option>' for s in srcs)
        body = (f'<div class="wrap">{cr}<section class="page-hero"><p class="eyebrow"><span class="live-dot"></span> Updated {self.date.strftime("%B %-d, %Y")}</p><h1>Domain industry news</h1>'
                '<p class="lead">The latest headlines from the domain industry\'s leading publications, collected automatically every day. Click through to read each story at its source.</p></section>'
                f'<div class="filters"><input type="search" placeholder="Search headlines" data-filter-input="#nl" data-filter-select="#ns" data-filter-count="#nc"><select id="ns"><option value="">All sources</option>{opts}</select><span class="small"><b id="nc">{len(items)}</b> headlines</span></div>'
                f'<div id="nl">{news_list(items)}</div><p class="small">Headlines and links belong to their publishers. BetterNic shows titles only and links to the original articles.</p></div>')
        self.write("/news.html", {"title": "Domain Name Industry News Today — Sales, Auctions, ICANN & UDRP", "description": "Today's domain industry headlines from leading publications: domain sales, auctions, registries, ICANN policy and UDRP decisions — updated daily.", "body": body, "schema": [sch]}, priority=.8, freq="daily", lastmod=self.bd)

    def videos_page(self):
        cr, sch = breadcrumbs([("Home", "/"), ("Videos", None)])
        items = self.videos.get("items", [])
        body = (f'<div class="wrap">{cr}<section class="page-hero"><p class="eyebrow"><span class="live-dot"></span> Updated {self.date.strftime("%B %-d, %Y")}</p><h1>Domain investing videos</h1>'
                '<p class="lead">New videos about domains, registrars, DNS, disputes and the domain aftermarket from industry channels — refreshed daily. Videos load only when you press play.</p></section>'
                f'{video_cards(items)}<section class="section"><div class="cta-band card"><div><h2>Create domain videos?</h2><p class="muted">We\'re hiring video creators for tool walkthroughs and explainers.</p></div><div><a class="btn btn-ghost" href="/careers.html?role=Video%20creator#apply">Apply</a></div></div></section></div>')
        vids = [{"@context": "https://schema.org", "@type": "VideoObject", "name": v["title"], "thumbnailUrl": f'https://i.ytimg.com/vi/{v["id"]}/hqdefault.jpg',
                 "uploadDate": v.get("date") or self.bd, "embedUrl": f'https://www.youtube-nocookie.com/embed/{v["id"]}', "description": v["title"]} for v in items[:10] if v.get("id")]
        self.write("/videos.html", {"title": "Domain Investing Videos — Registrars, DNS, Disputes & Aftermarket", "description": "Watch the latest videos on domain names, registrars, DNS, UDRP disputes and the domain aftermarket, updated daily.", "body": body, "schema": [sch] + vids}, priority=.7, freq="daily", lastmod=self.bd)

    # ------------------------------------------------------------ daily brief
    def brief_snapshot(self):
        a = self.auctions.get("items", [])
        tl = {}
        for x in a:
            tl[x["tl"]] = tl.get(x["tl"], 0) + 1
        ending = [x for x in a if (x.get("e") or "")[:10] == self.bd]
        t_of_day = TOOLS[self.date.toordinal() % len(TOOLS)]
        term = GLOSSARY[self.date.toordinal() % len(GLOSSARY)]
        return {"date": self.bd, "auctions": len(a), "ending_today": len(ending), "top_tlds": sorted(tl.items(), key=lambda x: -x[1])[:5],
                "avg_score": round(sum(x["s"] for x in a) / len(a), 1) if a else None,
                "top": featured(a)[:10], "news": self.news.get("items", [])[:10], "videos": self.videos.get("items", [])[:3],
                "dotd": self.dotd(), "tool": t_of_day["slug"], "term": term}

    def brief_html(self, b, is_today):
        d = datetime.date.fromisoformat(b["date"])
        tool = TOOL_BY.get(b["tool"], TOOLS[0])
        tl = ", ".join(f".{t} ({n:,})" for t, n in b["top_tlds"]) or "—"
        dotd = b.get("dotd")
        dotd_html = (f'<div class="card"><p class="eyebrow">Domain of the day</p><div class="dn" style="font-size:30px">{e(dotd["d"])}</div><p class="muted">Score {dotd["s"]} · {money(dotd.get("p"))}'
                     f'{" · " + str(dotd["b"]) + " bids" if dotd.get("b") else ""}</p><a href="/tools/domain-report.html?d={e(dotd["d"])}">Run the report →</a></div>') if dotd else ""
        top = b.get("top") or []
        auc = (f'<div class="table-wrap"><table><thead><tr><th>Domain</th><th class="num">Score</th><th class="num">Price</th><th class="num">Bids</th><th>Ends</th><th></th></tr></thead><tbody>{auction_rows(top)}</tbody></table></div>') if top else '<p class="muted">No auction data for this day.</p>'
        stats = "".join(f'<div class="stat"><b>{e(v)}</b><span>{e(l)}</span></div>' for v, l in [
            (f'{b["auctions"]:,}' if b["auctions"] else "—", "Auctions tracked"), (f'{b["ending_today"]:,}', "Ending this day"),
            (str(b["avg_score"] or "—"), "Average BetterNic score"), (str(len(b.get("news") or [])), "Headlines"), (str(len(TOOLS)), "Free tools")])
        archive = "".join(f'<a class="chip" href="/brief/{x}.html">{x}</a>' for x in self.brief_dates[:30])
        return f"""<div class="wrap"><nav class="crumbs"><a href="/">Home</a><span class="sep">/</span><a href="/brief/">Daily Brief</a><span class="sep">/</span><span>{b['date']}</span></nav>
<section class="page-hero"><p class="eyebrow">{'<span class="live-dot"></span> Today · ' if is_today else ''}{d.strftime('%A, %B %-d, %Y')}</p><h1>The BetterNic Daily Brief</h1>
<p class="lead">The domain aftermarket in one page: today's auction activity, the strongest expiring names, industry headlines and one tool and term to learn.</p></section>
<div class="stats">{stats}</div>
<section class="section"><div class="grid-2">{dotd_html}<div class="card"><p class="eyebrow">Market snapshot</p><p>Most active extensions in today's auction inventory: <b>{e(tl)}</b>.</p><p class="small">Source: public auction inventory, scored by the BetterNic appraisal model.</p></div></div></section>
<section class="section"><h2>Top-scored expiring auctions</h2>{auc}</section>
<section class="section"><h2>Headlines</h2>{news_list(b.get('news') or [])}</section>
<section class="section"><div class="grid-2"><a class="card" href="/tools/{tool['slug']}.html"><p class="eyebrow">Tool of the day</p><h3>{e(tool['name'])}</h3><p class="muted">{e(tool['short'])}</p></a>
<div class="card"><p class="eyebrow">Term of the day</p><h3>{e(b['term'][0])}</h3><p class="muted">{e(b['term'][1])}</p></div></div></section>
<section class="section"><div class="card"><h2>Get the Daily Brief by email</h2>{newsletter_form('brief')}</div></section>
<section class="section"><h2>Archive</h2><div class="chips">{archive}</div></section></div>"""

    def briefs(self):
        hist = ROOT / "data" / "history"
        hist.mkdir(parents=True, exist_ok=True)
        snap = self.brief_snapshot()
        (hist / f"brief-{self.bd}.json").write_text(json.dumps(snap, default=str))
        files = sorted(hist.glob("brief-*.json"), reverse=True)
        for old in files[30:]:
            old.unlink()
        files = files[:30]
        self.brief_dates = [f.stem.replace("brief-", "") for f in files]
        (ROOT / "data" / "brief.json").write_text(json.dumps({"date": self.bd, "dates": self.brief_dates}))
        shutil.copy(ROOT / "data" / "brief.json", self.out / "data" / "brief.json")
        for i, f in enumerate(files):
            b = json.loads(f.read_text())
            b["top_tlds"] = [tuple(x) for x in b.get("top_tlds", [])]
            b["term"] = tuple(b.get("term") or GLOSSARY[0])
            is_today = b["date"] == self.bd
            html = self.brief_html(b, is_today)
            title = f"Daily Domain Brief — {datetime.date.fromisoformat(b['date']).strftime('%B %-d, %Y')}"
            desc = f"Domain auctions, top expiring names and industry headlines for {b['date']}."
            art = {"@context": "https://schema.org", "@type": "NewsArticle", "headline": title, "datePublished": b["date"], "dateModified": b["date"],
                   "author": {"@type": "Organization", "name": SITE["name"]}, "publisher": {"@type": "Organization", "name": SITE["name"]}}
            self.write(f"/brief/{b['date']}.html", {"title": title, "description": desc, "body": html, "schema": [art], "current": "/brief/", "og_type": "article"},
                       priority=.5, freq="never", lastmod=b["date"])
            if is_today or i == 0:
                self.write("/brief/", {"title": "The Daily Domain Brief — Auctions, Sales & News Today", "description": "Today's domain aftermarket in one page: auction activity, top expiring names, headlines and a tool of the day.",
                                       "body": html, "schema": [art], "current": "/brief/"}, priority=.9, freq="daily", lastmod=self.bd)
                self.feed_items = [json.loads(x.read_text()) for x in files]

    # ------------------------------------------------------------ company & legal
    def company_pages(self):
        def simple(path, title, desc, h1, lead, inner, crumbs=None, priority=.4, extra_schema=None, noindex=False, ads=True):
            cr, sch = breadcrumbs(crumbs or [("Home", "/"), (h1, None)])
            body = f'<div class="wrap">{cr}<section class="page-hero"><h1>{e(h1)}</h1>{f"<p class=lead>{lead}</p>" if lead else ""}</section><div class="narrow prose">{inner}</div></div>'
            self.write(path, {"title": title, "description": desc, "body": body, "schema": [sch] + (extra_schema or []), "noindex": noindex, "ads": ads}, priority=priority)

        about = f"""
<p>BetterNic is a free, independent platform for people who own, buy and sell domain names. We combine {len(TOOLS)} tools, daily market intelligence and a low-commission marketplace so domain investors, brokers and founders can do their work in one place.</p>
<h2>What we do</h2>
<ul class="check-list"><li><b>Free tools</b> for research, valuation, acquisition, selling, portfolio management and legal protection.</li>
<li><b>Daily intelligence</b> — expiring auctions scored every morning, industry headlines, new videos and the Daily Brief.</li>
<li><b>A fair marketplace</b> — free listings, 5% commission (4% from $50,000, 3% from $100,000), ten payment methods and lease-to-own.</li>
<li><b>Expert help</b> — brokers for selling and confidential acquisitions, appraisals and dispute guidance.</li></ul>
<h2>How we keep it free</h2>
<p>BetterNic is funded by advertising (Google AdSense), labelled sponsorships, marketplace commissions on successful sales and voluntary <a href="/support.html">contributions</a>. Tools never require an account.</p>
<h2>Our principles</h2>
<ul><li><b>Show our working.</b> Our appraisal model explains every factor. We never present estimates as facts.</li>
<li><b>Real data only.</b> Auction, news and video data come from public sources and link back to them. We don't invent statistics, sales or reviews.</li>
<li><b>Privacy by default.</b> Tools run in your browser; portfolio data stays on your device.</li>
<li><b>Respect for rights.</b> We don't support typosquatting or trademark abuse, and our tools help brand owners protect themselves.</li></ul>
<h2>Where we're going</h2>
<p>Next on the roadmap: deeper tools driven by what you use most, accounts for sellers, and a peer-funded <a href="/financing.html">domain liquidity marketplace</a> so investors can unlock the value in their portfolios without selling their best names.</p>
<p>Interested in this website, the domain, sponsorship, advertising or a partnership? Use the contact link at the top of any page, or our <a href="/contact.html">contact form</a>.</p>"""
        simple("/about.html", "About BetterNic — Free Tools & a Fair Marketplace for Domain Investors", "BetterNic combines free domain tools, daily market intelligence and a 5% marketplace for domain investors, brokers and founders.",
               "About BetterNic", SITE["tagline"] + ".", about, priority=.6)

        inner = (select("Topic", "topic", [(t, t) for t in ["General question", "Sponsorship", "Advertising", "Partnership", "Interest in this website / domain", "Buying or selling a domain", "Press", "Privacy request", "Legal"]], required=True)
                 + contact_fields() + field("Subject", "subject", required=True) + field("Message", "message", "textarea", required=True) + consent_field())
        cform = form("contact", inner, submit="Send message", success="Thanks — your message is in. We reply within one business day.")
        simple("/contact.html", "Contact BetterNic", "Contact BetterNic about sponsorship, advertising, partnerships, buying or selling domains, press or privacy.",
               "Contact us", "We reply within one business day. For interest in this website or domain, sponsorship, advertising or partnership, you can also use the link at the very top of every page.",
               f'<div class="card">{cform}</div>', priority=.5,
               extra_schema=[{"@context": "https://schema.org", "@type": "ContactPage", "name": "Contact BetterNic", "url": SITE["url"] + "/contact.html"}])

        yr = self.date.year
        simple("/privacy.html", "Privacy Policy", "How BetterNic collects, uses and protects information, including Google AdSense cookies and form submissions.", "Privacy Policy", "", legal.PRIVACY.format(date=SITE["content_date"]), priority=.3)
        simple("/cookies.html", "Cookie Policy", "How BetterNic uses cookies and local storage, including Google AdSense, and how to change your choices.", "Cookie Policy", "", legal.COOKIES.format(date=SITE["content_date"]), priority=.3)
        simple("/terms.html", "Terms of Use", "Terms governing use of BetterNic's tools, content and marketplace, including commission and listing rules.", "Terms of Use", "", legal.TERMS.format(date=SITE["content_date"]), priority=.3)
        simple("/disclaimer.html", "Disclaimer", "BetterNic's tools and content are informational and not legal, tax or financial advice.", "Disclaimer", "", legal.DISCLAIMER.format(date=SITE["content_date"]), priority=.3)
        notice = form("legal-notice", select("Notice type", "notice_type", [("copyright", "Copyright"), ("trademark", "Trademark"), ("other", "Other legal issue")], required=True)
                      + contact_fields() + field("URL of the material", "url", "url", required=True) + field("Details", "message", "textarea", required=True)
                      + '<label class="check"><input type="checkbox" name="declaration" required> <span>I have a good-faith belief the use is not authorised, the information is accurate, and I am the owner or authorised to act for the owner.</span></label>',
                      submit="Send notice", success="Notice received. We will review it promptly and reply.")
        simple("/legal.html", "Trademark & Copyright Notice", "BetterNic trademark and copyright disclosure, third-party marks and how to report infringement.", "Trademark & copyright notice", "",
               legal.LEGAL.format(date=SITE["content_date"], year=yr) + f'<div class="card">{notice}</div>', priority=.3)

        groups = [("Main", [("Home", "/"), ("Tools", "/tools/"), ("Marketplace", "/marketplace.html"), ("Sell a domain", "/sell.html"), ("Pricing", "/pricing.html"), ("Get help", "/leads.html"), ("Financing", "/financing.html")]),
                  ("Daily", [("Daily Brief", "/brief/"), ("News", "/news.html"), ("Videos", "/videos.html"), ("Auctions", "/tools/domain-auctions.html")]),
                  ("Learn", [("Learn", "/learn/"), ("Glossary", "/learn/glossary.html")] + [(g["title"], f"/learn/{g['slug']}.html") for g in GUIDES]),
                  ("Tools", [(t["name"], f"/tools/{t['slug']}.html") for t in TOOLS]),
                  ("Company", [("About", "/about.html"), ("Contact", "/contact.html"), ("Advertise", "/advertise.html"), ("Contests", "/contests.html"), ("Careers", "/careers.html"), ("Support us", "/support.html"), ("Compare platforms", "/compare.html")]),
                  ("Legal", [("Privacy", "/privacy.html"), ("Cookies", "/cookies.html"), ("Terms", "/terms.html"), ("Disclaimer", "/disclaimer.html"), ("Trademark & copyright", "/legal.html")])]
        sm = "".join(f'<h2>{e(g)}</h2><ul>' + "".join(f'<li><a href="{u}">{e(n)}</a></li>' for n, u in links) + "</ul>" for g, links in groups)
        simple("/sitemap.html", "Sitemap", "Every page on BetterNic.", "Sitemap", "", sm, priority=.3)

        simple("/thank-you.html", "Thank you", "Thanks for contacting BetterNic.", "Thank you", "We received your submission and will reply within one business day.",
               '<p><a class="btn btn-primary" href="/">Back to BetterNic</a> <a class="btn btn-ghost" href="/tools/">Explore the tools</a></p>', noindex=True, ads=False)
        nf = (f'<div class="wrap"><section class="hero center"><p class="eyebrow">404</p><h1>That page dropped.</h1><p class="lead" style="margin:0 auto 24px">Like an expired domain, this URL isn\'t registered here. Try a tool or head home.</p>'
              '<form class="search-hero" data-domain-search style="margin:0 auto"><input type="text" placeholder="Analyse a domain…" aria-label="Domain"><button class="btn btn-primary" type="submit">Analyse</button></form>'
              '<p style="margin-top:20px"><a href="/">Home</a> · <a href="/tools/">All tools</a> · <a href="/sitemap.html">Sitemap</a></p></section></div>')
        self.write("/404.html", {"title": "Page not found", "description": "Page not found.", "body": nf, "noindex": True, "ads": False}, index=False)

    # ------------------------------------------------------------ static
    def static_files(self):
        o = self.out
        pub = SITE["adsense_client"].replace("ca-", "")
        (o / "ads.txt").write_text(f"google.com, {pub}, DIRECT, f08c47fec0942fa0\n")
        (o / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /thank-you.html\nDisallow: /domain.html\n\nSitemap: {SITE['url']}/sitemap.xml\n")
        urls = "".join(f"<url><loc>{xesc(SITE['url'] + p)}</loc><lastmod>{lm}</lastmod><changefreq>{cf}</changefreq><priority>{pr:.1f}</priority></url>"
                       for p, lm, pr, cf in self.pages)
        (o / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n')
        items = ""
        for b in getattr(self, "feed_items", [])[:20]:
            d = datetime.datetime.fromisoformat(b["date"]).replace(tzinfo=datetime.timezone.utc)
            top = ", ".join(x["d"] for x in (b.get("top") or [])[:5])
            desc = f"{b.get('auctions', 0):,} auctions tracked. Top names: {top}"
            items += (f"<item><title>Daily Domain Brief — {xesc(b['date'])}</title><link>{SITE['url']}/brief/{b['date']}.html</link><guid>{SITE['url']}/brief/{b['date']}.html</guid>"
                      f"<pubDate>{d.strftime('%a, %d %b %Y 12:00:00 +0000')}</pubDate><description>{xesc(desc)}</description></item>")
        (o / "feed.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>BetterNic Daily Brief</title><link>{SITE["url"]}/brief/</link>'
                                    f'<description>Daily domain auctions, sales and news.</description><language>en</language>{items}</channel></rss>\n')
        (o / "site.webmanifest").write_text(json.dumps({"name": SITE["name"], "short_name": SITE["name"], "start_url": "/", "display": "standalone",
                                                       "background_color": "#faf9f6", "theme_color": "#0b0b0c",
                                                       "icons": [{"src": "/assets/logo-512.png", "sizes": "512x512", "type": "image/png"},
                                                                 {"src": "/assets/apple-touch-icon.png", "sizes": "180x180", "type": "image/png"}]}))
        # integrity manifest so the pipeline can report what changed
        h = hashlib.sha256()
        for p in sorted(o.rglob("*")):
            if p.is_file() and p.suffix in (".html", ".json", ".xml", ".txt"):
                h.update(p.read_bytes())
        (o / "data" / "build.json").write_text(json.dumps({"date": self.bd, "pages": len(self.pages), "hash": h.hexdigest()[:16]}))


if __name__ == "__main__":
    Site().run()
