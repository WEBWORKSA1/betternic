"""Bodies for marketplace, lead-generation, community and company pages."""
import datetime

from src.lib import (e, form, field, select, checkbox, payment_checks, consent_field, contact_fields,
                     faq_block, breadcrumbs)
from src.site import SITE, PAYMENT_METHODS

BUDGETS = [("<1k", "Under $1,000"), ("1-5k", "$1,000 – $5,000"), ("5-25k", "$5,000 – $25,000"),
           ("25-100k", "$25,000 – $100,000"), ("100k+", "$100,000+"), ("unsure", "Not sure yet")]
TIMELINES = [("now", "As soon as possible"), ("month", "Within a month"), ("quarter", "Within 3 months"), ("exploring", "Just exploring")]


def hero(title, lead, crumbs_trail, eyebrow=""):
    cr, sch = breadcrumbs(crumbs_trail)
    eb = f'<p class="eyebrow">{eyebrow}</p>' if eyebrow else ""
    return f'<div class="wrap">{cr}<section class="page-hero">{eb}<h1>{e(title)}</h1><p class="lead">{lead}</p></section>', sch


LTO_PILL = '<span class="pill pill-blue">Lease to own</span>'


def money(v):
    return "${:,.0f}".format(v)


def tiers_html():
    out = []
    for t, big in zip(SITE["commission"], ["5%", "4%", "3%"]):
        out.append(f'<div class="card"><b>{big}</b><p class="meta">{e(t["label"])}</p></div>')
    return '<div class="price-tiers">' + "".join(out) + "</div>"


# ------------------------------------------------------------------ marketplace
def marketplace(ctx):
    top, sch = hero("Domains for sale", "Curated domain listings from owners who sell direct at a 5% commission — plus today's best expiring auctions, scored and linked to the source.",
                    [("Home", "/"), ("Marketplace", None)], "Marketplace")
    listings = ctx["listings"]
    if listings:
        cards = "".join(
            f'<a class="card" href="/d/{e(l["slug"])}.html" data-text="{e((l["domain"] + " " + l.get("category", "") + " " + l.get("tagline", "")).lower())}" data-cat="{e(l.get("category", ""))}">'
            f'<div class="dn" style="font-size:20px">{e(l["domain"])}</div><p class="meta">{e(l.get("tagline", ""))}</p>'
            f'<p><b>{money(l["price"]) if l.get("price") else "Make offer"}</b> {LTO_PILL if l.get("lto") else ""}</p></a>'
            for l in listings)
        grid = (f'<div class="filters"><input type="search" placeholder="Search listings" data-filter-input="#lgrid" data-filter-count="#lcount"></div>'
                f'<p class="small"><b id="lcount">{len(listings)}</b> listings</p><div class="grid-3" id="lgrid">{cards}</div>')
    else:
        grid = ('<div class="empty"><h3>Owner listings are opening now</h3><p>BetterNic is accepting its first owner listings. Listing is free and you pay a commission only when you sell.</p>'
                '<p><a class="btn btn-accent" href="/sell.html">List your domain</a> <a class="btn btn-ghost" href="/leads.html?intent=buy">Ask us to find a domain</a></p></div>')
    auc = ctx["auctions"][:12]
    rows = "".join(
        f'<tr><td class="dn"><a href="/tools/domain-report.html?d={e(a["d"])}">{e(a["d"])}</a></td><td class="num">{a["s"]}</td>'
        f'<td class="num">{money(a["p"]) if a.get("p") is not None else "—"}</td><td class="num">{a.get("b") if a.get("b") is not None else "—"}</td>'
        f'<td data-until="{e(a.get("e") or "")}">—</td><td><a href="{e(a.get("l") or "#")}" target="_blank" rel="noopener nofollow">Bid ↗</a></td></tr>'
        for a in auc)
    auctions = (f'<section class="section"><div class="section-head"><div><h2>Expiring auctions worth a look today</h2><p>Top-scored names from today\'s public auction inventory. Bids happen at the source.</p></div>'
                f'<a class="btn btn-ghost" href="/tools/domain-auctions.html">All auctions →</a></div>'
                + (f'<div class="table-wrap"><table><thead><tr><th>Domain</th><th class="num">Score</th><th class="num">Price</th><th class="num">Bids</th><th>Ends</th><th></th></tr></thead><tbody>{rows}</tbody></table></div>' if auc else '<div class="empty">Today\'s auction feed is refreshing.</div>')
                + "</section>")
    body = (top + grid + auctions +
            '<section class="section"><div class="cta-band card"><div><h2>Own a great domain?</h2><p class="muted">List it free. Keep 95–97% of the sale price, choose from ten payment methods and offer lease-to-own in one click.</p></div>'
            '<div><a class="btn btn-accent btn-lg" href="/sell.html">List a domain</a></div></div></section></div>')
    return body, [sch]


def offer_form(domain="", methods=None, note=""):
    methods = methods or [m[1] for m in PAYMENT_METHODS]
    pm = [(m, m) for m in methods]
    inner = (f'<input type="hidden" name="domain" value="{e(domain)}">'
             + select("I want to", "offer_type", [("buy-now", "Buy at the listed price"), ("offer", "Make an offer"), ("lease", "Lease to own")], required=True)
             + '<div class="grid-2">' + field("Your offer (USD)", "amount", "number", attrs='min="1"') + select("Preferred payment method", "payment_method", pm) + "</div>"
             + field("Message to the seller", "message", "textarea", placeholder="Tell the seller what you plan to build — it helps.")
             + contact_fields(phone=True) + consent_field())
    return form("offer", inner, submit="Send to seller", note=note or "We forward your offer and reply within one business day. No payment is taken now.",
                success="Offer received. We'll confirm with the seller and email you within one business day.")


def listing_page(l):
    pm = l.get("payment_methods") or [PAYMENT_METHODS[0][1]]
    lto = ""
    if l.get("lto") and l.get("price"):
        lto = f'<p class="muted">or lease to own from <b>{money(l["price"] * 1.3 / 60)}/month</b> (60 months)</p>'
    cr, sch = breadcrumbs([("Home", "/"), ("Marketplace", "/marketplace.html"), (l["domain"], None)])
    price = money(l["price"]) if l.get("price") else "Make an offer"
    body = (f'<div class="wrap">{cr}<section class="section-tight"><div class="dotd"><div><p class="eyebrow">This domain is for sale</p>'
            f'<h1 class="dn dn-xl">{e(l["domain"])}</h1><p class="lead">{e(l.get("tagline", ""))}</p>'
            f'<div class="dn" style="font-size:34px">{price}</div>{lto}'
            f'<p class="small">Accepted: {e(" · ".join(pm))}</p>'
            f'<div class="tool-actions"><a class="btn btn-ghost btn-sm" href="/tools/domain-report.html?d={e(l["domain"])}">Domain report</a>'
            f'<a class="btn btn-ghost btn-sm" href="/tools/lease-to-own-calculator.html?price={int(l.get("price") or 0)}">Lease options</a></div></div>'
            f'<div class="card"><h2 style="font-size:20px">Buy, offer or lease</h2>{offer_form(l["domain"], pm)}</div></div></section>'
            '<section class="section"><div class="grid-3"><div class="card"><h3>Secure escrow</h3><p class="muted">Funds are held by the escrow method you agree with the seller until the transfer completes.</p></div>'
            '<div class="card"><h3>Fast transfer</h3><p class="muted">Most transfers complete within 1–5 days after payment clears.</p></div>'
            '<div class="card"><h3>Lease to own</h3><p class="muted">Use the domain now and pay monthly over 12–60 months.</p></div></div></section></div>')
    schema = {"@context": "https://schema.org", "@type": "Product", "name": l["domain"], "description": l.get("tagline") or f'{l["domain"]} domain name for sale',
              "category": "Domain name"}
    if l.get("price"):
        schema["offers"] = {"@type": "Offer", "price": l["price"], "priceCurrency": "USD", "availability": "https://schema.org/InStock",
                            "url": f'{SITE["url"]}/d/{l["slug"]}.html'}
    return body, [sch, schema]


def domain_page():
    top, sch = hero("Make an offer on a domain", "Interested in <b data-domain-name>this domain</b>? Send an offer or a buy request. If it isn't listed with us, a BetterNic broker can approach the owner confidentially.",
                    [("Home", "/"), ("Marketplace", "/marketplace.html"), ("Offer", None)], "Buy a domain")
    body = (top + '<div class="grid-2"><div class="card">' + offer_form() + '</div>'
            '<div><div class="card"><h3>How it works</h3><ol><li>Tell us the domain, your budget and how you want to pay.</li><li>If the owner lists with BetterNic we forward your offer directly; if not, our broker contacts them for you.</li>'
            '<li>Agree terms, pay into escrow, receive the domain, release funds.</li></ol><a class="btn btn-ghost btn-sm" data-report-link href="/tools/domain-report.html">Run a free domain report</a></div></div></div></div>')
    return body, [sch]


def sell(ctx):
    top, sch = hero("Sell your domain name", "List free. Pay 5% only when it sells — 4% from $50,000, 3% from $100,000. Choose how you get paid from ten methods, and offer lease-to-own in one click.",
                    [("Home", "/"), ("Sell a domain", None)], "For domain owners")
    inner = ('<h3>1. Your domain</h3><div class="grid-2">' + field("Domain name", "domain", required=True, placeholder="example.com")
             + field("Buy-now price (USD)", "price", "number", hint="Leave blank for make-offer only.", attrs='min="1"') + "</div>"
             + '<div class="grid-2">' + field("Minimum offer (USD)", "min_offer", "number", attrs='min="1"')
             + select("Category", "category", [(c, c) for c in ["Finance & fintech", "AI & software", "Crypto & web3", "E-commerce & retail", "Health & wellness", "Real estate", "Travel", "Education", "Media & entertainment", "Local / geo", "Brandable", "Numeric / short", "Other"]]) + "</div>"
             + field("One-line description", "tagline", placeholder="A short, memorable name for a fintech brand", attrs='maxlength="140"')
             + '<h3>2. How buyers can purchase</h3><div class="grid-2">'
             + select("Custody", "custody", [("park", "Park with BetterNic (hosted lander, lease-to-own available)"), ("self", "Keep my own DNS / lander")])
             + select("Lease to own", "lto", [("yes", "Yes — offer 12–60 month plans"), ("no", "No — full payment only")]) + "</div>"
             + '<h3>3. How you want to be paid</h3><p class="small">Pick every method you accept. The BetterNic commission applies whichever one the buyer uses.</p>'
             + payment_checks()
             + field("Custom payment instructions (if you chose Custom)", "custom_instructions", "textarea", placeholder="For example: wire to my business account; buyer covers fees.")
             + '<h3>4. About you</h3>' + contact_fields(phone=True)
             + checkbox("I own this domain (or am authorised to sell it) and it is not subject to any dispute I know of.", "ownership", required=True)
             + consent_field())
    f = form("sell-listing", inner, submit="Submit listing", note="Free. We review every listing within one business day.",
             success="Listing received. We'll review it and email you within one business day with next steps.")
    steps = ('<div class="grid-4">' + "".join(f'<div class="card"><p class="eyebrow">Step {i}</p><h3>{t}</h3><p class="muted">{d}</p></div>' for i, (t, d) in enumerate([
        ("Submit", "Tell us the domain, price and the payment methods you accept."), ("We review", "We check ownership and publish a fast listing page within a day."),
        ("Buyers find it", "Your name appears in the marketplace, daily brief and buyer matching."), ("Get paid", "Escrow-protected payment, transfer, and you keep 95–97%.")], 1)) + "</div>")
    faqs = [("How much does it cost to list?", "Nothing. BetterNic charges a commission only when your domain sells: 5% under $50,000, 4% from $50,000 to $99,999 and 3% from $100,000, applied to the full sale price."),
            ("Can I list a domain that is also on other marketplaces?", "Yes. BetterNic does not require exclusivity. Just keep your price consistent and remove listings promptly once it sells."),
            ("Which payment methods can I accept?", "BetterNic-managed escrow, Escrow.com, Sedo, Afternic, Atom, Efty, your own Stripe link, PayPal, wire via BetterNic or a custom arrangement you describe."),
            ("How is the commission collected if I use my own escrow?", "Where your escrow provider supports it, we set up a disbursement split. Otherwise the commission is invoiced and due within 7 days of the buyer's payment clearing."),
            ("Do you verify ownership?", "Yes. Before publishing we ask you to confirm ownership, typically with a DNS TXT record or a registrar account check.")]
    fb, fs = faq_block(faqs)
    body = (top + steps + '<section class="section"><div class="layout-2"><div class="card">' + f + '</div><aside class="sidebar"><div class="card"><h3>Commission</h3>' + tiers_html()
            + '<p class="small" style="margin-top:10px"><a href="/tools/marketplace-fee-calculator.html">Compare your net proceeds →</a></p></div>'
            '<div class="card"><h3>Free seller tools</h3><p><a href="/tools/domain-appraisal.html">Appraisal</a> · <a href="/tools/domain-price-calculator.html">Asking price</a> · <a href="/tools/for-sale-lander-builder.html">Lander builder</a> · <a href="/tools/social-card-generator.html">Social cards</a> · <a href="/tools/sales-outreach-generator.html">Outreach emails</a></p></div></aside></div></section>'
            + fb + "</div>")
    return body, [sch, fs]


def pricing(ctx):
    top, sch = hero("Pricing & commission", "Simple, published pricing. Listing is free; you pay a commission only on success.", [("Home", "/"), ("Pricing", None)], "Transparent fees")
    ex = "".join(f'<tr><td>{money(p)}</td><td>{int(r*100)}%</td><td>{money(p*r)}</td><td>{money(p*(1-r))}</td></tr>' for p, r in [(2500, .05), (12000, .05), (49999, .05), (60000, .04), (150000, .03), (500000, .03)])
    lto = "".join(f'<tr><td>{m} months</td><td>{int(v*100)}%</td><td>{money(10000*(1+v)/m)}</td></tr>' for m, v in SITE["lto_markups"].items())
    pm = "".join(f'<li><b>{e(t)}</b> — {e(d)}</li>' for _, t, d in PAYMENT_METHODS)
    faqs = [("Are there any listing or subscription fees?", "No. All 37 tools are free and listing is free. Commission applies only when a domain sells."),
            ("Is the tier marginal like income tax?", "No. The rate for the tier your full sale price falls into applies to the whole price. A $60,000 sale pays 4% of $60,000."),
            ("Who pays escrow fees?", "Buyer and seller agree this. Splitting 50/50 is common."),
            ("Do buyers pay a fee to BetterNic?", "No buyer fee is charged by BetterNic. Buyers pay their own escrow or payment-method fees if agreed.")]
    fb, fs = faq_block(faqs)
    body = (top + tiers_html() + '<section class="section"><h2>Examples</h2><div class="table-wrap"><table><thead><tr><th>Sale price</th><th>Rate</th><th>Commission</th><th>Seller receives*</th></tr></thead><tbody>' + ex + '</tbody></table></div><p class="small">*Before any escrow or payment-method fees.</p></section>'
            '<section class="section"><div class="grid-2"><div><h2>Lease-to-own markups</h2><div class="table-wrap"><table><thead><tr><th>Term</th><th>Markup</th><th>Monthly on $10,000</th></tr></thead><tbody>' + lto + '</tbody></table></div><p class="small"><a href="/tools/lease-to-own-calculator.html">Calculate your own →</a></p></div>'
            '<div><h2>Ten ways to get paid</h2><ul>' + pm + '</ul></div></div></section>' + fb +
            '<section class="section"><div class="cta-band card"><div><h2>Ready to sell?</h2><p class="muted">It takes about two minutes.</p></div><div><a class="btn btn-accent btn-lg" href="/sell.html">List a domain</a></div></div></section></div>')
    return body, [sch, fs]


# ------------------------------------------------------------------ lead generation hub
INTENTS = [("sell", "Sell a domain", "Get buyers, pricing help and a broker for premium names"),
           ("buy", "Buy a specific domain", "We approach the owner confidentially and negotiate for you"),
           ("appraisal", "Expert appraisal", "A human valuation with comparable sales and a pricing plan"),
           ("lease", "Lease a domain", "Use a premium name now, pay monthly"),
           ("financing", "Domain financing", "Liquidity backed by your domain portfolio (waitlist)"),
           ("portfolio", "Sell a portfolio", "Bulk sales and portfolio liquidation"),
           ("dispute", "Dispute or recovery", "UDRP, stolen domains, trademark issues"),
           ("develop", "Build a website / lander", "Turn a domain into a site that earns or converts"),
           ("monetize", "Monetize traffic", "Advertising and lead-gen setups for domains with traffic")]


def leads(ctx):
    top, sch = hero("Get buyers, brokers and expert help", "Tell us what you need in under a minute. A domain specialist replies within one business day — no obligation, no spam.",
                    [("Home", "/"), ("Get help", None)], "Free consultation")
    choices = "".join(f'<label class="choice"><input type="radio" name="intent" value="{k}"{" required" if i == 0 else ""}><b>{e(t)}</b><small>{e(d)}</small></label>' for i, (k, t, d) in enumerate(INTENTS))
    inner = ('<div class="steps-nav"><span></span><span></span><span></span></div>'
             f'<div class="step"><h3>What can we help with?</h3><div class="choice-grid">{choices}</div><button class="btn btn-primary" type="button" data-next>Next</button></div>'
             '<div class="step"><h3>The details</h3>' + field("Domain name(s)", "domain", placeholder="example.com — or several, separated by commas")
             + '<div class="grid-2">' + select("Budget or target price", "budget", BUDGETS) + select("Timeline", "timeline", TIMELINES) + "</div>"
             + field("Anything else we should know?", "message", "textarea", placeholder="Your goals, current offers, deadlines…")
             + '<div class="form-foot"><button class="btn btn-ghost" type="button" data-prev>Back</button><button class="btn btn-primary" type="button" data-next>Next</button></div></div>'
             '<div class="step"><h3>How do we reach you?</h3>' + contact_fields(phone=True) + field("Company (optional)", "company")
             + select("Preferred contact", "contact_pref", [("email", "Email"), ("phone", "Phone / WhatsApp"), ("video", "Video call")])
             + consent_field() + '<button class="btn btn-ghost" type="button" data-prev>Back</button></div>')
    f = form("lead", inner, submit="Get my free consultation", cls="", success="Thanks — a BetterNic specialist will email you within one business day.").replace('<form class="nf ', '<form data-steps class="nf ')
    proof = ('<div class="grid-3">' + "".join(f'<div class="card"><h3>{t}</h3><p class="muted">{d}</p></div>' for t, d in [
        ("Low, published fees", "5% commission (4% from $50k, 3% from $100k). No retainers for sellers."),
        ("Confidential acquisitions", "We approach owners without revealing who you are, so the price doesn't jump."),
        ("Data-driven pricing", "Every recommendation starts with comparable sales and our open appraisal model.")]) + "</div>")
    faqs = [("Is the consultation free?", "Yes. Telling us what you need costs nothing and there's no obligation."),
            ("How fast will you reply?", "Within one business day, usually sooner."),
            ("Do you charge buyers for acquisitions?", "For confidential acquisitions we agree a success fee with you before we contact the owner. You pay nothing if we don't secure the domain."),
            ("Will you share my details?", "Only with the other party to a transaction you ask us to pursue. See our privacy policy.")]
    fb, fs = faq_block(faqs)
    body = top + '<div class="layout-2"><div class="card" style="padding:28px">' + f + '</div><aside class="sidebar">' + \
        '<div class="card"><h3>What happens next</h3><ol><li>A specialist reviews your request.</li><li>You get a reply with options and an honest view of value.</li><li>You decide — no pressure.</li></ol></div>' + \
        '<div class="card"><h3>Prefer to explore first?</h3><p><a href="/tools/domain-report.html">Free domain report</a><br><a href="/tools/domain-appraisal.html">Instant appraisal</a><br><a href="/tools/domain-auctions.html">Today\'s auctions</a></p></div></aside></div>' + \
        '<section class="section">' + proof + '</section>' + fb + '</div>'
    return body, [sch, fs]


def financing(ctx):
    top, sch = hero("Domain-backed liquidity", "We're building a peer-funded marketplace where domain investors fund each other's bridge loans — secured by domain names and liquidated, if needed, through the BetterNic marketplace.",
                    [("Home", "/"), ("Financing", None)], "Coming soon · waitlist open")
    inner = ('<div class="choice-grid">' + "".join(f'<label class="choice"><input type="radio" name="role" value="{k}"{" required" if k == "borrower" else ""}><b>{t}</b><small>{d}</small></label>' for k, t, d in [
        ("borrower", "I want to borrow", "Unlock cash from my domain portfolio"), ("funder", "I want to fund loans", "Earn interest backed by domain collateral"), ("both", "Both", "")]) + "</div>"
        + '<div class="grid-2">' + select("Approximate portfolio / funding size", "size", BUDGETS) + select("Main extension", "extension", [("com", ".com"), ("cc", "Country codes"), ("new", "New gTLDs"), ("mixed", "Mixed")]) + "</div>"
        + field("Example domains (optional)", "domain", placeholder="Your strongest names") + contact_fields() + consent_field())
    f = form("financing-waitlist", inner, submit="Join the waitlist", success="You're on the waitlist. We'll contact you before launch.")
    how = ('<div class="grid-4">' + "".join(f'<div class="card"><p class="eyebrow">{i}</p><h3>{t}</h3><p class="muted">{d}</p></div>' for i, (t, d) in enumerate([
        ("Appraise", "Collateral is valued at wholesale using comparable sales and the BetterNic model."), ("Match", "Funders choose loans by LTV, term and collateral quality."),
        ("Secure", "Domains are held in escrow custody for the life of the loan."), ("Repay or liquidate", "Repay and get the domains back — or the marketplace sells them to repay funders.")], 1)) + "</div>")
    body = (top + how + '<section class="section"><div class="layout-2"><div class="card">' + f + '</div><aside class="sidebar"><div class="card"><h3>Estimate your borrowing power</h3><p class="muted">See indicative loan sizes at 25–50% loan-to-value.</p><a class="btn btn-ghost" href="/tools/domain-financing-calculator.html">Financing calculator</a></div>'
            '<div class="notice warn">BetterNic does not currently lend money or arrange loans, and nothing here is an offer of credit or an investment opportunity. The service will launch only where it complies with applicable lending and securities laws.</div></aside></div></section></div>')
    return body, [sch]


def advertise(ctx):
    top, sch = hero("Advertise & sponsor", "Reach domain investors, brokers, registrar customers and startup founders while they research, buy and sell domain names.",
                    [("Home", "/"), ("Advertise", None)], "Partnerships")
    pk = [("Daily Brief sponsor", "Your message in the Daily Brief page and email for a week."), ("Tool sponsorship", "Exclusive 'Sponsored by' placement on a tool page such as Appraisal or Auctions."),
          ("Homepage spotlight", "A featured card on the homepage for 30 days."), ("Category sponsorship", "Own a category of tools — research, valuation, acquisition or legal."),
          ("Contest prize sponsor", "Provide a prize for the monthly naming contest and get featured with it."), ("Custom partnership", "Integrations, data partnerships, co-marketing and more.")]
    cards = '<div class="grid-3">' + "".join(f'<div class="card"><h3>{t}</h3><p class="muted">{d}</p><a href="?package={e(t)}#form" class="small">Ask about this →</a></div>' for t, d in pk) + "</div>"
    inner = ('<div class="grid-2">' + field("Company", "company", required=True) + field("Website", "website", "url", placeholder="https://") + "</div>"
             + '<div class="grid-2">' + select("Interested in", "package", [(t, t) for t, _ in pk]) + select("Monthly budget", "budget", BUDGETS) + "</div>"
             + field("Goals", "message", "textarea", placeholder="Who do you want to reach and what does success look like?") + contact_fields(phone=True) + consent_field())
    f = form("advertise", inner, submit="Request the media kit", success="Thanks — we'll send the media kit and availability within one business day.")
    body = (top + cards + f'<section class="section" id="form"><div class="layout-2"><div class="card"><h2>Request the media kit</h2>{f}</div><aside class="sidebar"><div class="card"><h3>Audience</h3><ul class="check-list"><li>Domain investors and portfolio holders</li><li>Brokers and marketplace sellers</li><li>Founders choosing a brand name</li><li>Brand-protection and legal teams</li></ul></div>'
            '<div class="card"><h3>Our standards</h3><p class="muted">Sponsored placements are always labelled. We don\'t accept ads for domain-name scams, typosquatting or misleading financial products.</p></div></aside></div></section></div>')
    return body, [sch]


THEMES = ["Name an AI startup", "Best four-letter brandable", "Name a climate-tech company", "Best domain hack", "Name a fintech app",
          "Best one-word .com you'd develop", "Name a health & wellness brand", "Best numeric domain story", "Name a creator-economy tool",
          "Best expired domain find", "Name a travel brand", "Your best domain flip story"]


def contests(ctx):
    d = ctx["date"]
    month = d.strftime("%B %Y")
    theme = THEMES[(d.year * 12 + d.month) % len(THEMES)]
    start = d.replace(day=1)
    nxt = (start.replace(day=28) + datetime.timedelta(days=4)).replace(day=1)
    end = nxt - datetime.timedelta(days=1)
    top, sch = hero(f"Monthly contest: {theme}", f"Enter free until <b>{end.strftime('%B %-d, %Y')}</b>. Winners are chosen by the BetterNic team on creativity, brandability and fit with the brief.",
                    [("Home", "/"), ("Contests", None)], f"{month} contest · free to enter")
    inner = (f'<input type="hidden" name="contest" value="{e(theme)} — {e(month)}">'
             + field("Your entry", "entry", required=True, placeholder="A name, domain or short story — depending on the brief")
             + field("Why it works (max 300 characters)", "rationale", "textarea", attrs='maxlength="300"')
             + contact_fields() + field("Country / province of residence", "country", required=True)
             + checkbox("I am 18 or older and I accept the official rules below.", "rules", required=True) + consent_field())
    f = form("contest-entry", inner, submit="Submit my entry", success="Entry received — good luck! Winners are announced on this page after the contest closes.")
    rules = f"""<h2>Official rules</h2><ol class="small">
<li><b>Sponsor:</b> BetterNic. <b>Contest:</b> "{e(theme)}" ({e(month)}).</li>
<li><b>Entry period:</b> {start.strftime('%B %-d, %Y')} 00:00 to {end.strftime('%B %-d, %Y')} 23:59 Eastern Time. One entry per person per month.</li>
<li><b>Eligibility:</b> open to individuals aged 18 or older, where permitted by law. Void where prohibited. Employees of the Sponsor are not eligible.</li>
<li><b>No purchase necessary.</b> Entering is free. A purchase does not improve your chances.</li>
<li><b>Judging:</b> this is a contest of skill, not chance. Entries are judged by the Sponsor on creativity (40%), brandability (30%) and fit with the brief (30%). Decisions are final.</li>
<li><b>Prize:</b> {e(SITE['contest_prize'])}. No cash alternative. Prizes are not transferable. Sponsored prizes, when offered, are described on this page before the entry period starts.</li>
<li><b>Winner notification:</b> by email within 14 days of the close. Canadian residents must correctly answer a time-limited mathematical skill-testing question to receive a prize. Where required by law (including in Québec), the contest will be registered with the relevant authority before prizes are awarded.</li>
<li><b>Entries:</b> must be your original work and must not include third-party trademarks, offensive content or personal data of others. By entering you allow the Sponsor to display your entry and first name with the results.</li>
<li><b>Privacy:</b> entry data is used only to run this contest, as described in our <a href="/privacy.html">Privacy Policy</a>.</li>
<li>The Sponsor may cancel or modify the contest if it cannot run as planned, in compliance with applicable law.</li></ol>"""
    body = (top + '<div class="layout-2"><div><div class="card">' + f + '</div>' + '<section class="section">' + rules + '</section></div>'
            '<aside class="sidebar"><div class="card"><h3>Prize</h3><p>' + e(SITE["contest_prize"]) + '</p></div>'
            '<div class="card"><h3>Need inspiration?</h3><p><a href="/tools/domain-name-generator.html">Name generator</a><br><a href="/tools/brandability-score.html">Brandability score</a><br><a href="/tools/domain-hack-finder.html">Domain hack finder</a></p></div>'
            '<div class="card"><h3>Sponsor a prize</h3><p class="muted">Put your brand in front of every entrant.</p><a href="/advertise.html?package=Contest%20prize%20sponsor">Become a sponsor →</a></div></aside></div></div>')
    return body, [sch]


ROLES = [("Domain broker (commission)", "Remote · freelance", "Source buyers, negotiate and close aftermarket deals. Commission-based."),
         ("Content writer — domain industry", "Remote · contract", "Write guides, tool documentation and the Daily Brief."),
         ("Full-stack developer", "Remote · contract", "Build tools, data pipelines and the marketplace."),
         ("Outbound sales & lead generation", "Remote · commission", "Find end-user buyers for listed domains."),
         ("Video creator", "Remote · per project", "Tool walkthroughs and domain-investing explainers for YouTube."),
         ("Partnerships & community manager", "Remote · part-time", "Grow relationships with registrars, marketplaces and investors."),
         ("Data analyst — valuation", "Remote · contract", "Improve the appraisal model with sales data."),
         ("Customer support (part-time)", "Remote · part-time", "Help sellers and buyers through listings and transfers.")]


def careers(ctx):
    top, sch = hero("Careers & talent network", "Help build the command center for domain investors. We work remotely and hire for skills, not credentials.",
                    [("Home", "/"), ("Careers", None)], "We're growing")
    cards = '<div class="grid-2">' + "".join(f'<div class="card"><h3>{e(t)}</h3><p class="meta">{e(m)}</p><p class="muted">{e(d)}</p><a href="?role={e(t)}#apply" class="btn btn-ghost btn-sm">Apply</a></div>' for t, m, d in ROLES) + "</div>"
    inner = (select("Role", "role", [(t, t) for t, _, _ in ROLES] + [("Other", "Something else")], required=True) + contact_fields()
             + '<div class="grid-2">' + field("Portfolio, LinkedIn or GitHub URL", "portfolio", "url", placeholder="https://") + field("Location / time zone", "location") + "</div>"
             + select("Availability", "availability", [("full", "Full-time"), ("part", "Part-time"), ("project", "Per project")])
             + field("Why you, in a few lines", "message", "textarea", required=True) + consent_field())
    f = form("career-application", inner, submit="Send application", success="Application received. We review every application and reply within two weeks.")
    body = (top + cards + f'<section class="section" id="apply"><div class="layout-2"><div class="card"><h2>Apply</h2>{f}</div><aside class="sidebar"><div class="card"><h3>How we hire</h3><ol><li>Application review</li><li>Short paid trial task</li><li>Conversation with the founder</li></ol></div>'
            '<div class="card"><p class="small">BetterNic welcomes applicants of every background. We make hiring decisions on merit and provide accommodations on request.</p></div></aside></div></section></div>')
    return body, [sch]


def support(ctx):
    top, sch = hero("Support BetterNic", "BetterNic's 37 tools and daily data are free for everyone. Your support keeps them running and growing.",
                    [("Home", "/"), ("Support us", None)], "Keep the tools free")
    links = [(k, v) for k, v in SITE["donate_links"].items() if v]
    btns = ('<div class="tool-actions">' + "".join(f'<a class="btn btn-accent" href="{e(v)}" target="_blank" rel="noopener">Give with {e(k)}</a>' for k, v in links) + "</div>") if links else ""
    uses = [("Operations", "Hosting, data feeds and keeping the daily pipeline running."), ("Promotions & marketing", "Reaching more domain owners so the marketplace has more buyers and sellers."),
            ("Hiring talent", "Writers, developers and brokers who build new tools and help users."), ("Contests & prizes", "Monthly naming contests and prizes for the community.")]
    inner = ('<div class="grid-2">' + select("Amount (USD)", "amount", [(v, v) for v in ["$5", "$10", "$25", "$50", "$100", "$250", "Other"]], required=True)
             + select("Frequency", "frequency", [("once", "One-time"), ("monthly", "Monthly")]) + "</div>"
             + select("Put it toward", "purpose", [(t, t) for t, _ in uses] + [("Wherever needed", "Wherever it's needed most")])
             + contact_fields() + checkbox("You may thank me publicly by first name.", "public_thanks") + consent_field())
    f = form("donation-pledge", inner, submit="Pledge support", success="Thank you! We'll email you a secure payment link within one business day.")
    other = ('<div class="grid-3">' + "".join(f'<div class="card"><h3>{t}</h3><p class="muted">{d}</p></div>' for t, d in [
        ("Share a tool", "Link to a BetterNic tool from your blog, forum signature or newsletter."), ("List your domains", "Every listing brings more buyers to the marketplace."),
        ("Sponsor", "Businesses can sponsor tools, the Daily Brief or contest prizes — see <a href='/advertise.html'>Advertise</a>.")]) + "</div>")
    body = (top + '<div class="grid-4">' + "".join(f'<div class="card"><h3>{t}</h3><p class="muted">{d}</p></div>' for t, d in uses) + "</div>"
            + '<section class="section"><div class="layout-2"><div class="card"><h2>Make a contribution</h2>' + btns
            + '<p class="muted">Choose an amount and we\'ll send a secure payment link. You\'ll never be charged without completing payment yourself.</p>' + f + '</div>'
            '<aside class="sidebar"><div class="card"><h3>Transparency</h3><p class="muted">Contributions support a for-profit service and are not tax-deductible. We publish what contributions fund on this page.</p></div></aside></div></section>'
            + '<section class="section"><h2>Other ways to help</h2>' + other + "</section></div>")
    return body, [sch]


def compare(ctx, platforms):
    top, sch = hero(f"{len(platforms)} domain platforms compared", "The marketplaces, auction houses, data tools, news sources and legal services domain investors rely on — what each is best for, and the features BetterNic built in.",
                    [("Home", "/"), ("Compare", None)], "Industry map")
    cats = sorted(set(p[2] for p in platforms))
    rows = "".join(
        f'<tr data-text="{e((p[0] + " " + p[3] + " " + p[4]).lower())}" data-cat="{e(p[2].lower().replace(" ", "-").replace("&", "and"))}"><td><a href="{e(p[1])}" target="_blank" rel="noopener nofollow"><b>{e(p[0])}</b></a></td>'
        f'<td><span class="pill">{e(p[2])}</span></td><td>{e(p[3])}</td><td class="small">{e(p[4])}</td><td class="small">{e(p[5])}</td></tr>' for p in platforms)
    opts = "".join(f'<option value="{e(c.lower().replace(" ", "-").replace("&", "and"))}">{e(c)}</option>' for c in cats)
    matrix = [("Free domain tools", "37", "Some, often limited"), ("Daily auction aggregation", "Yes, scored", "Rare"), ("Seller commission", "5% / 4% / 3%", "Varies widely by platform and listing type"),
              ("Seller-chosen payment methods", "10 options", "Usually the platform's own checkout"), ("Lease to own", "12–60 months", "Some platforms"), ("Open, explainable appraisal", "Yes", "Usually a single number"),
              ("Exclusivity required", "No", "Sometimes"), ("Listing fee", "Free", "Free to paid")]
    mat = "".join(f"<tr><td>{e(a)}</td><td><b>{e(b)}</b></td><td>{e(c)}</td></tr>" for a, b, c in matrix)
    body = (top + '<section class="section-tight"><h2>BetterNic at a glance</h2><div class="table-wrap"><table><thead><tr><th>Feature</th><th>BetterNic</th><th>Typical alternatives</th></tr></thead><tbody>' + mat + '</tbody></table></div></section>'
            f'<section class="section"><div class="filters"><input type="search" placeholder="Search platforms or features" data-filter-input="#ptab" data-filter-select="#pcat" data-filter-count="#pc"><select id="pcat"><option value="">All categories</option>{opts}</select><span class="small"><b id="pc">{len(platforms)}</b> shown</span></div>'
            '<div class="table-wrap"><table id="ptab"><thead><tr><th>Platform</th><th>Category</th><th>Best for</th><th>Notable features</th><th>What BetterNic adopted</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
            f'<p class="small">Descriptions reflect publicly available information as of {ctx["date"].strftime("%B %Y")}. Fees and features change — check each platform before you rely on them. Names are trademarks of their owners; BetterNic is not affiliated with them.</p></section></div>')
    return body, [sch]
