"""BetterNic site configuration — the one place to change brand, links and monetization settings."""

SITE = {
    "name": "BetterNic",
    "domain": "betternic.com",
    "url": "https://betternic.com",
    "tagline": "The command center for domain investors",
    "description": (
        "Free domain investing tools, daily auction and industry intelligence, and a "
        "low-commission marketplace to buy, sell and lease domain names."
    ),
    "launch_date": "2026-05-06",
    "content_date": "2026-11-13",  # bump when static copy changes (sitemap lastmod)
    "locale": "en",
    "twitter": "",
    # Top-of-page enquiry banner (required on every page). Text shown; URL stays inside the link.
    "banner_text": "Contact, if you are interested in this website / domain name / Sponsorship / Advertisement / Partnership",
    "banner_url": "https://web.works/contact",
    # Google AdSense
    "adsense_client": "ca-pub-6620975821265271",
    # Commission tiers (rate applies to the full sale price of the tier the price falls in)
    "commission": [
        {"max": 50000, "rate": 0.05, "label": "Under $50,000"},
        {"max": 100000, "rate": 0.04, "label": "$50,000 – $99,999"},
        {"max": None, "rate": 0.03, "label": "$100,000 and above"},
    ],
    "lto_markups": {12: 0.0, 24: 0.10, 36: 0.20, 48: 0.25, 60: 0.30},
    # Donation / support links. Leave a value empty to hide that button; the pledge form always works.
    "donate_links": {
        "Stripe": "",
        "PayPal": "",
        "Buy Me a Coffee": "",
        "Ko-fi": "",
        "GitHub Sponsors": "",
    },
    # Monthly contest prize (edit freely)
    "contest_prize": (
        "Homepage spotlight for 30 days, a featured marketplace listing for 90 days, "
        "and 0% BetterNic commission on one sale"
    ),
    # YouTube channels pulled daily (filter=True keeps only domain-related titles)
    "youtube_channels": [
        {"id": "UCKaZnZE20kmE5uEZQdnHQIQ", "name": "DomainSherpa", "filter": False},
        {"id": "UC4JN1fr5IWXCV42QYfVPGaQ", "name": "Namefi", "filter": False},
        {"id": "UCCgq8yIroWHZuM0JU8-I7sw", "name": "ICANN", "filter": False},
        {"id": "UCcH6KB1MDEsNqn5i6I5W1Qw", "name": "Dynadot", "filter": False},
        {"id": "UCzVlyc5Ts9tL3qyUKqccaeA", "name": "Namecheap", "filter": True},
        {"id": "UCgH_SmWw9WianYyOB5Y6tEA", "name": "GoDaddy", "filter": True},
        {"id": "UCSRJtbCY_XRRMi6e-evXHWg", "name": "Escrow.com", "filter": True},
        {"id": "UC6CbAK73ohEL5XeRi0wbN9w", "name": "WIPO", "filter": True},
        {"id": "UCGcH24BkRWWIcGuw-rmDTsg", "name": "Spaceship", "filter": True},
    ],
    # Industry news feeds pulled daily (headline + link only)
    "news_feeds": [
        {"name": "Domain Name Wire", "url": "https://domainnamewire.com/feed/"},
        {"name": "DomainInvesting", "url": "https://domaininvesting.com/feed/"},
        {"name": "OnlineDomain", "url": "https://onlinedomain.com/feed/"},
        {"name": "DomainGang", "url": "https://domaingang.com/feed/"},
        {"name": "DotWeekly", "url": "https://www.dotweekly.com/feed/"},
        {"name": "Domain Incite", "url": "https://domainincite.com/feed"},
        {"name": "CircleID", "url": "https://circleid.com/rss/topics/domain_names"},
        {"name": "Morgan Linton", "url": "https://morganlinton.com/feed/"},
        {"name": "DomainShane", "url": "https://domainshane.com/feed/"},
        {"name": "Rick's Blog", "url": "https://www.ricksblog.com/feed/"},
    ],
    # GoDaddy Auctions public inventory files used for the daily auction feed
    "auction_files": [
        "most_active_feed_all.json.zip",
        "listings_with_pageviews.json.zip",
        "auctions_ending_today.json.zip",
        "auctions_ending_tomorrow.json.zip",
        "5_letter_auctions.json.zip",
    ],
    "auction_base": "https://inventory.auctions.godaddy.com/",
}

# The ten payment / escrow methods a seller can accept (kept in sync with assets/site.js)
PAYMENT_METHODS = [
    ("betternic", "BetterNic-managed", "We coordinate payment and escrow end to end. Easiest for first-time sellers."),
    ("escrow_com", "Escrow.com", "Industry-standard escrow opened directly between buyer and seller."),
    ("sedo_escrow", "Sedo escrow / transfer service", "For sellers who already use Sedo's transfer service."),
    ("afternic_escrow", "Afternic", "Seller arranges the transaction through their Afternic account."),
    ("atom_escrow", "Atom.com", "Seller arranges the transaction through their Atom account."),
    ("efty_escrow", "Efty", "Seller arranges the transaction through their Efty setup."),
    ("stripe_seller", "Stripe (seller's payment link)", "Buyer pays the seller's own Stripe payment link."),
    ("paypal", "PayPal", "Best for smaller deals; PayPal payments can be reversed, so transfer after funds clear."),
    ("wire_betternic", "Wire via BetterNic", "Buyer wires funds; BetterNic releases them to the seller after the transfer is confirmed."),
    ("custom", "Custom arrangement", "Seller describes their own payment instructions."),
]

NAV = [
    ("Tools", "/tools/"),
    ("Auctions", "/tools/domain-auctions.html"),
    ("Marketplace", "/marketplace.html"),
    ("News", "/news.html"),
    ("Daily Brief", "/brief/"),
    ("Learn", "/learn/"),
    ("Videos", "/videos.html"),
]

MORE_NAV = [
    ("Get buyers & help", "/leads.html"),
    ("Domain financing", "/financing.html"),
    ("Pricing", "/pricing.html"),
    ("Contests", "/contests.html"),
    ("Careers", "/careers.html"),
    ("Advertise", "/advertise.html"),
    ("Support us", "/support.html"),
    ("Compare platforms", "/compare.html"),
    ("About", "/about.html"),
    ("Contact", "/contact.html"),
]
