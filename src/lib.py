"""Shared HTML helpers and the page layout used by every generated page."""
import html
import json

from src.site import SITE, NAV, MORE_NAV, PAYMENT_METHODS


def e(s):
    return html.escape(str(s if s is not None else ""), quote=True)


LOGO_SVG = (
    '<svg class="logo-mark" width="30" height="30" viewBox="0 0 80 80" aria-hidden="true">'
    '<rect width="80" height="80" rx="18" fill="currentColor"/>'
    '<path d="M26 22 L26 58 M26 22 L46 22 C53 22 56 26 56 31 C56 36 53 39 47 39 L26 39 '
    'M26 39 L48 39 C55 39 58 43 58 49 C58 54 55 58 47 58 L26 58" stroke="var(--logo-ink)" '
    'stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
)

EEA = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS", "IE",
       "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
       "GB", "CH"]


def jsonld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, separators=(",", ":")).replace("</", "<\\/") + "</script>"


def faq_block(faqs, heading="Frequently asked questions"):
    if not faqs:
        return "", None
    items = "".join(
        f'<details class="faq"><summary>{e(q)}</summary><div class="faq-a"><p>{a}</p></div></details>'
        for q, a in faqs
    )
    schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": q,
             "acceptedAnswer": {"@type": "Answer", "text": html.unescape(_strip_tags(a))}}
            for q, a in faqs
        ],
    }
    return f'<section class="section faq-section"><h2>{e(heading)}</h2>{items}</section>', schema


def _strip_tags(s):
    import re
    return re.sub(r"<[^>]+>", "", s)


def breadcrumbs(trail):
    """trail: list of (name, url) ending with current page (url may be None)."""
    parts = []
    for i, (name, url) in enumerate(trail):
        if url and i < len(trail) - 1:
            parts.append(f'<a href="{e(url)}">{e(name)}</a>')
        else:
            parts.append(f'<span aria-current="page">{e(name)}</span>')
    schema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": name,
             "item": SITE["url"] + (url or "")}
            for i, (name, url) in enumerate(trail)
        ],
    }
    return '<nav class="crumbs" aria-label="Breadcrumb">' + '<span class="sep">/</span>'.join(parts) + "</nav>", schema


# ---------------------------------------------------------------- forms
def form(name, inner, submit="Send", note="", cls="", success=None):
    """A Netlify form. Submissions are delivered to the site owner's inbox via Netlify; no address is published."""
    success = success or "Thanks — your message is in. We reply within one business day."
    return (
        f'<form class="nf {cls}" name="{e(name)}" method="POST" action="/thank-you.html" '
        f'data-netlify="true" netlify-honeypot="company_site" data-success="{e(success)}">'
        f'<input type="hidden" name="form-name" value="{e(name)}">'
        f'<p class="hp" aria-hidden="true"><label>Leave this empty <input name="company_site" tabindex="-1" autocomplete="off"></label></p>'
        f'<input type="hidden" name="page" value="">'
        f"{inner}"
        f'<div class="form-foot"><button class="btn btn-primary" type="submit">{e(submit)}</button>'
        f'{f"<p class=small>{note}</p>" if note else ""}</div>'
        f'<p class="form-status" role="status" aria-live="polite"></p>'
        f"</form>"
    )


def field(label, name, type="text", required=False, placeholder="", hint="", value="", attrs=""):
    req = " required" if required else ""
    star = ' <span class="req">*</span>' if required else ""
    if type == "textarea":
        ctrl = f'<textarea name="{e(name)}" id="f-{e(name)}" rows="4" placeholder="{e(placeholder)}"{req} {attrs}>{e(value)}</textarea>'
    else:
        ctrl = f'<input type="{e(type)}" name="{e(name)}" id="f-{e(name)}" placeholder="{e(placeholder)}" value="{e(value)}"{req} {attrs}>'
    h = f'<small class="hint">{hint}</small>' if hint else ""
    return f'<div class="field"><label for="f-{e(name)}">{e(label)}{star}</label>{ctrl}{h}</div>'


def select(label, name, options, required=False, hint="", attrs=""):
    req = " required" if required else ""
    star = ' <span class="req">*</span>' if required else ""
    opts = '<option value="">Select…</option>' + "".join(
        f'<option value="{e(v)}">{e(t)}</option>' for v, t in options
    )
    h = f'<small class="hint">{hint}</small>' if hint else ""
    return f'<div class="field"><label for="f-{e(name)}">{e(label)}{star}</label><select name="{e(name)}" id="f-{e(name)}"{req} {attrs}>{opts}</select>{h}</div>'


def checkbox(label, name, value="yes", required=False):
    req = " required" if required else ""
    return f'<label class="check"><input type="checkbox" name="{e(name)}" value="{e(value)}"{req}> <span>{label}</span></label>'


def payment_checks(name="payment_methods", checked=("betternic",)):
    out = []
    for key, title, desc in PAYMENT_METHODS:
        c = " checked" if key in checked else ""
        out.append(
            f'<label class="pm"><input type="checkbox" name="{e(name)}" value="{e(title)}"{c}>'
            f'<span><b>{e(title)}</b><small>{e(desc)}</small></span></label>'
        )
    return '<div class="pm-grid">' + "".join(out) + "</div>"


def consent_field():
    return checkbox(
        'I agree to the <a href="/privacy.html">Privacy Policy</a> and to be contacted about this request.',
        "consent", required=True,
    )


def contact_fields(phone=False):
    out = '<div class="grid-2">' + field("Your name", "name", required=True, attrs='autocomplete="name"')
    out += field("Your email", "email", "email", required=True, attrs='autocomplete="email"') + "</div>"
    if phone:
        out += field("Phone or WhatsApp (optional)", "phone", "tel", attrs='autocomplete="tel"')
    return out


def newsletter_form(source="footer"):
    return form(
        "newsletter",
        f'<input type="hidden" name="source" value="{e(source)}">'
        '<div class="inline-field"><label class="sr" for="nl-' + e(source) + '">Email</label>'
        f'<input type="email" name="email" id="nl-{e(source)}" placeholder="Your email address" required autocomplete="email">'
        "</div>",
        submit="Get the Daily Brief",
        cls="newsletter",
        success="You're on the list. The Daily Brief lands in your inbox soon.",
    )


# ---------------------------------------------------------------- layout
def _nav_html(current):
    items = []
    for label, url in NAV:
        cur = ' aria-current="page"' if current and current.startswith(url) and url != "/" else ""
        items.append(f'<a href="{url}"{cur}>{e(label)}</a>')
    more = "".join(f'<a href="{u}">{e(l)}</a>' for l, u in MORE_NAV)
    return (
        '<nav class="nav" id="nav" aria-label="Main">' + "".join(items)
        + '<div class="more"><button class="more-btn" type="button" aria-expanded="false" aria-controls="more-menu">More'
        '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5l3 3 3-3" stroke="currentColor" fill="none" stroke-width="1.5"/></svg></button>'
        f'<div class="more-menu" id="more-menu">{more}</div></div>'
        '<a class="btn btn-primary nav-cta" href="/sell.html">Sell a domain</a></nav>'
    )


FOOT_COLS = [
    ("Top tools", [
        ("Domain report", "/tools/domain-report.html"), ("Domain appraisal", "/tools/domain-appraisal.html"),
        ("WHOIS lookup", "/tools/whois-lookup.html"), ("Domain auctions", "/tools/domain-auctions.html"),
        ("Name generator", "/tools/domain-name-generator.html"), ("Portfolio tracker", "/tools/portfolio-tracker.html"),
        ("All 37 tools", "/tools/"),
    ]),
    ("Marketplace", [
        ("Browse domains", "/marketplace.html"), ("Sell a domain", "/sell.html"), ("Pricing & commission", "/pricing.html"),
        ("Lease to own", "/tools/lease-to-own-calculator.html"), ("Domain financing", "/financing.html"),
        ("Get buyers & help", "/leads.html"),
    ]),
    ("Daily intelligence", [
        ("Daily Brief", "/brief/"), ("Industry news", "/news.html"), ("Expiring auctions", "/tools/domain-auctions.html"),
        ("Videos", "/videos.html"), ("Learn", "/learn/"), ("Glossary", "/learn/glossary.html"),
        ("Compare platforms", "/compare.html"),
    ]),
    ("Company", [
        ("About", "/about.html"), ("Contact", "/contact.html"), ("Advertise & sponsor", "/advertise.html"),
        ("Careers", "/careers.html"), ("Contests", "/contests.html"), ("Support us", "/support.html"),
    ]),
    ("Legal", [
        ("Privacy policy", "/privacy.html"), ("Terms of use", "/terms.html"), ("Cookie policy", "/cookies.html"),
        ("Disclaimer", "/disclaimer.html"), ("Trademark & copyright", "/legal.html"), ("Sitemap", "/sitemap.html"),
    ]),
]


def layout(page, build_date):
    """page: dict(path,title,description,body,[schema],[noindex],[scripts],[og_image],[ads],[current],[head])"""
    path = page["path"]
    canon = SITE["url"] + (path if path != "/index.html" else "/")
    canon = canon.replace("/index.html", "/")
    title = page["title"]
    full_title = title if SITE["name"] in title else f"{title} | {SITE['name']}"
    desc = page.get("description", SITE["description"])
    og = page.get("og_image", "/assets/og-default.png")
    robots = "noindex,follow" if page.get("noindex") else "index,follow,max-image-preview:large"
    schemas = [
        {"@context": "https://schema.org", "@type": "Organization", "name": SITE["name"], "url": SITE["url"],
         "logo": SITE["url"] + "/assets/logo-512.png"},
        {"@context": "https://schema.org", "@type": "WebSite", "name": SITE["name"], "url": SITE["url"],
         "potentialAction": {"@type": "SearchAction",
                             "target": SITE["url"] + "/tools/domain-report.html?d={search_term_string}",
                             "query-input": "required name=search_term_string"}},
    ] + [s for s in page.get("schema", []) if s]
    ads = page.get("ads", True)
    adsense = (
        f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={SITE["adsense_client"]}" crossorigin="anonymous"></script>'
        if ads else ""
    )
    consent = (
        "<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}"
        "gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',"
        f"region:{json.dumps(EEA)},wait_for_update:500}});"
        "gtag('consent','default',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});"
        "try{var c=localStorage.getItem('bn_consent');if(c){var g=c==='all'?'granted':'denied';"
        "gtag('consent','update',{ad_storage:g,ad_user_data:g,ad_personalization:g,analytics_storage:g});"
        "if(c!=='all'){(window.adsbygoogle=window.adsbygoogle||[]).requestNonPersonalizedAds=1;}}}catch(e){}</script>"
    )
    scripts = "".join(f'<script src="{s}?v={build_date}" defer></script>' for s in page.get("scripts", []))
    cols = "".join(
        f'<div class="foot-col"><h3>{e(h)}</h3>' + "".join(f'<a href="{u}">{e(l)}</a>' for l, u in links) + "</div>"
        for h, links in FOOT_COLS
    )
    return f"""<!DOCTYPE html>
<html lang="{SITE['locale']}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(full_title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{e(canon)}">
<meta property="og:type" content="{e(page.get('og_type', 'website'))}">
<meta property="og:site_name" content="{SITE['name']}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{e(canon)}">
<meta property="og:image" content="{SITE['url']}{e(og)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0b0b0c">
<meta name="google-adsense-account" content="{SITE['adsense_client']}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="alternate" type="application/rss+xml" title="BetterNic Daily Brief" href="/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap">
<link rel="stylesheet" href="/assets/site.css?v={build_date}">
{consent}
{adsense}
{''.join(jsonld(s) for s in schemas)}
{page.get('head', '')}
</head>
<body data-build="{build_date}" data-page="{e(path)}">
<a class="skip" href="#main">Skip to content</a>
<div class="topbar"><a href="{SITE['banner_url']}" target="_blank" rel="noopener">{e(SITE['banner_text'])} <span aria-hidden="true">→</span></a></div>
<header class="site-header">
  <div class="wrap header-in">
    <a class="logo" href="/" aria-label="{SITE['name']} home">{LOGO_SVG}<span>Better<b>Nic</b></span></a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav" aria-label="Open menu"><span></span><span></span><span></span></button>
    {_nav_html(page.get('current', path))}
  </div>
</header>
<main id="main">
{page['body']}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div class="foot-top">
      <div class="foot-brand">
        <a class="logo" href="/">{LOGO_SVG}<span>Better<b>Nic</b></span></a>
        <p>{e(SITE['tagline'])}. Free tools, daily intelligence and a 5% marketplace for people who own domain names.</p>
        <div class="foot-news"><h3>The Daily Brief</h3><p class="small">Auctions, sales and news for domain investors — one email a day.</p>{newsletter_form('footer')}</div>
      </div>
      <div class="foot-cols">{cols}</div>
    </div>
    <div class="foot-legal">
      <p>© {build_date[:4]} {SITE['name']}. All rights reserved. BetterNic™ and the B monogram are trademarks of BetterNic.
      All other trademarks, service marks and trade names belong to their respective owners; their use here is for identification only and implies no affiliation or endorsement.
      Auction, news and video data come from public sources and link back to them. Nothing on this site is legal, tax or financial advice. <a href="/legal.html">Trademark &amp; copyright notice</a>.</p>
      <p class="small">Updated automatically every day · Last build {build_date} · <button class="linkish" type="button" data-consent-open>Cookie settings</button></p>
    </div>
  </div>
</footer>
<div class="consent" id="consent" hidden>
  <p>We use cookies to show ads (Google AdSense) and keep the site free. Choose “Accept all” for personalised ads or “Essential only” for non-personalised ads. <a href="/cookies.html">Cookie policy</a></p>
  <div class="consent-btns"><button class="btn btn-ghost" type="button" data-consent="essential">Essential only</button><button class="btn btn-primary" type="button" data-consent="all">Accept all</button></div>
</div>
<script src="/assets/site.js?v={build_date}" defer></script>
{scripts}
</body>
</html>
"""
