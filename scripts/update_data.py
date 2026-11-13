#!/usr/bin/env python3
"""Daily data pipeline for BetterNic. Stdlib only (wordfreq optional, for the word list).

Fetches public sources, normalises and scores them, and writes data/*.json.
Every source is isolated: a failure keeps yesterday's file and is recorded in data/status.json.
"""
import csv
import datetime
import email.utils
import gzip
import html
import io
import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))
from src.site import SITE  # noqa: E402
import appraise  # noqa: E402

DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)
UA = "Mozilla/5.0 (compatible; BetterNicBot/1.0; +https://betternic.com/about.html)"
NOW = datetime.datetime.now(datetime.timezone.utc)
STATUS = {"updated": NOW.isoformat(timespec="seconds"), "sources": []}
DOMAIN_KW = re.compile(r"\b(domain|domains|dns|whois|rdap|registrar|registry|tld|gtld|cctld|icann|udrp|url|website name|\.com|\.ai|\.io|aftermarket|brand name|naming|cybersquat|typosquat|escrow)\b", re.I)


def fetch(url, timeout=60, binary=False, retries=2):
    last = None
    for i in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*", "Accept-Encoding": "gzip"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    data = gzip.decompress(data)
                return data if binary else data.decode("utf-8", "replace")
        except Exception as ex:  # noqa: BLE001
            last = ex
            time.sleep(2 * (i + 1))
    raise last


def record(name, ok, count=0, error="", **extra):
    STATUS["sources"].append({"name": name, "ok": ok, "count": count, "error": str(error)[:300], **extra})
    print(("OK  " if ok else "ERR ") + f"{name}: {count} {error}")


def save(name, obj):
    (DATA / f"{name}.json").write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False))


def clean(s):
    s = html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()
    return re.sub(r"\s+", " ", s)


def parse_date(s):
    if not s:
        return None
    try:
        d = email.utils.parsedate_to_datetime(s)
    except Exception:  # noqa: BLE001
        try:
            d = datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:  # noqa: BLE001
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=datetime.timezone.utc)
    return d.astimezone(datetime.timezone.utc)


# ------------------------------------------------------------------ words (for scoring)
def words():
    p = DATA / "words.json"
    fresh = p.exists() and (time.time() - p.stat().st_mtime) < 30 * 86400
    if not fresh:
        try:
            import wordfreq
            bad = re.compile(r"(fuck|shit|cunt|nigg|porn|rape|nazi|slut|whore|fag|dick|cock|pussy|bitch)")
            lst = [w for w in wordfreq.top_n_list("en", 60000) if re.fullmatch(r"[a-z]{2,15}", w) and not bad.search(w)]
            lst = ["a"] + lst[:30000]
            (DATA / "words.json").write_text(json.dumps({"source": "wordfreq (Robyn Speer), CC BY-SA 4.0", "words": lst}, separators=(",", ":")))
            record("words", True, len(lst))
        except Exception as ex:  # noqa: BLE001
            record("words", p.exists(), 0, ex)
    try:
        appraise.load_words(json.loads(p.read_text())["words"])
    except Exception:  # noqa: BLE001
        pass


# ------------------------------------------------------------------ news
def news():
    items, seen = [], set()
    cutoff = NOW - datetime.timedelta(days=45)
    for f in SITE["news_feeds"]:
        try:
            xml = fetch(f["url"], timeout=40)
            root = ET.fromstring(xml.encode("utf-8") if isinstance(xml, str) else xml)
            n = 0
            entries = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")
            for it in entries:
                title = it.findtext("title") or it.findtext("{http://www.w3.org/2005/Atom}title") or ""
                link = it.findtext("link") or ""
                if not link:
                    le = it.find("{http://www.w3.org/2005/Atom}link")
                    link = le.get("href") if le is not None else ""
                date = parse_date(it.findtext("pubDate") or it.findtext("{http://www.w3.org/2005/Atom}published") or it.findtext("{http://www.w3.org/2005/Atom}updated") or it.findtext("{http://purl.org/dc/elements/1.1/}date"))
                title, link = clean(title), link.strip()
                if not title or not link.startswith("http") or link in seen:
                    continue
                if date and date < cutoff:
                    continue
                seen.add(link)
                items.append({"title": title[:220], "link": link, "source": f["name"], "date": (date or NOW).isoformat(timespec="minutes")})
                n += 1
            record(f"news:{f['name']}", True, n)
        except Exception as ex:  # noqa: BLE001
            record(f"news:{f['name']}", False, 0, ex)
    if items:
        items.sort(key=lambda x: x["date"], reverse=True)
        save("news", {"updated": NOW.isoformat(timespec="minutes"), "items": items[:200]})


# ------------------------------------------------------------------ videos
def videos():
    items = []
    ns = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015", "media": "http://search.yahoo.com/mrss/"}
    for ch in SITE["youtube_channels"]:
        try:
            xml = fetch(f"https://www.youtube.com/feeds/videos.xml?channel_id={ch['id']}", timeout=40)
            root = ET.fromstring(xml.encode("utf-8"))
            n = 0
            for en in root.findall("a:entry", ns):
                vid = en.findtext("yt:videoId", namespaces=ns)
                title = clean(en.findtext("a:title", namespaces=ns))
                date = en.findtext("a:published", namespaces=ns)
                if not vid or not title:
                    continue
                if ch.get("filter") and not DOMAIN_KW.search(title):
                    continue
                if "#shorts" in title.lower():
                    continue
                items.append({"id": vid, "title": title[:160], "channel": ch["name"], "date": (date or "")[:10]})
                n += 1
            record(f"youtube:{ch['name']}", True, n)
        except Exception as ex:  # noqa: BLE001
            record(f"youtube:{ch['name']}", False, 0, ex)
    if items:
        items.sort(key=lambda x: x["date"], reverse=True)
        save("videos", {"updated": NOW.isoformat(timespec="minutes"), "items": items[:60]})


# ------------------------------------------------------------------ TLDs + RDAP bootstrap
LEGACY = set("com net org info biz name pro mobi asia tel travel jobs museum aero coop cat int edu gov mil arpa xxx post".split())


def tlds():
    try:
        txt = fetch("https://data.iana.org/TLD/tlds-alpha-by-domain.txt")
        out = []
        for line in txt.splitlines():
            t = line.strip().lower()
            if not t or t.startswith("#"):
                continue
            g = "idn" if t.startswith("xn--") else "cc" if len(t) == 2 else "generic" if t in LEGACY else "new"
            rec = {"t": t, "g": g}
            if g == "idn":
                try:
                    rec["u"] = t.encode("ascii").decode("idna")
                except Exception:  # noqa: BLE001
                    pass
            out.append(rec)
        save("tlds", {"updated": NOW.isoformat(timespec="minutes"), "count": len(out), "tlds": out})
        record("iana:tlds", True, len(out))
    except Exception as ex:  # noqa: BLE001
        record("iana:tlds", False, 0, ex)
    try:
        j = json.loads(fetch("https://data.iana.org/rdap/dns.json"))
        svc = {}
        for tl, urls in j.get("services", []):
            u = next((x for x in urls if x.startswith("https://")), urls[0] if urls else None)
            for t in tl:
                if u:
                    svc[t.lower()] = u
        save("rdap", {"updated": NOW.isoformat(timespec="minutes"), "services": svc})
        record("iana:rdap", True, len(svc))
    except Exception as ex:  # noqa: BLE001
        record("iana:rdap", False, 0, ex)


# ------------------------------------------------------------------ auctions
KEYMAP = {
    "d": ["domainname", "domain", "name", "domain_name"],
    "p": ["price", "currentprice", "currentbid", "minbid", "minimumbid", "auctionprice", "buynowprice", "bid"],
    "b": ["numberofbids", "bids", "bidcount", "num_bids"],
    "e": ["auctionendtime", "endtime", "enddate", "auctionenddate", "end", "auctionend"],
    "t": ["traffic", "pageviews", "visitors", "monthlytraffic", "page_views"],
    "a": ["domainage", "age"],
    "v": ["valuation", "estimatedvalue", "value", "estibotvalue"],
    "l": ["link", "url", "auctionurl", "listingurl"],
    "x": ["isadult", "adult"],
}


def _norm_keys(rec):
    return {re.sub(r"[^a-z_]", "", str(k).lower()).replace("_", "") if k else "": v for k, v in rec.items()}


def _pick(rec, key):
    for k in KEYMAP[key]:
        k2 = k.replace("_", "")
        if k2 in rec and rec[k2] not in (None, ""):
            return rec[k2]
    return None


def _num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return v
    m = re.search(r"-?[\d,]+(\.\d+)?", str(v))
    return float(m.group(0).replace(",", "")) if m else None


def _date(v):
    if not v:
        return None
    s = str(v).strip()
    off = -8 if re.search(r"\((PST|PT)\)", s) else -7 if "PDT" in s else None
    core = re.sub(r"\s*\(.*\)$", "", s)
    for fmt in ("%m/%d/%Y %I:%M %p", "%m/%d/%Y %H:%M", "%m/%d/%Y %I:%M:%S %p", "%m/%d/%Y"):
        try:
            dt = datetime.datetime.strptime(core, fmt)
            tz = datetime.timezone(datetime.timedelta(hours=off if off is not None else -8))
            return dt.replace(tzinfo=tz).astimezone(datetime.timezone.utc).isoformat(timespec="minutes")
        except Exception:  # noqa: BLE001
            pass
    d = parse_date(s)
    return d.isoformat(timespec="minutes") if d else None


def _records(blob, name):
    """Yield dict records from a zipped JSON/CSV/XML inventory file."""
    zf = zipfile.ZipFile(io.BytesIO(blob))
    for inner in zf.namelist():
        raw = zf.read(inner)
        low = inner.lower()
        if low.endswith(".json"):
            j = json.loads(raw.decode("utf-8-sig", "replace"))
            stack = [j]
            while stack:
                cur = stack.pop()
                if isinstance(cur, list):
                    if cur and isinstance(cur[0], dict):
                        for r in cur:
                            yield r
                    else:
                        stack.extend(cur)
                elif isinstance(cur, dict):
                    lists = [v for v in cur.values() if isinstance(v, list) and v and isinstance(v[0], dict)]
                    if lists:
                        for l in lists:
                            for r in l:
                                yield r
                    else:
                        stack.extend(v for v in cur.values() if isinstance(v, (list, dict)))
        elif low.endswith(".csv"):
            for r in csv.DictReader(io.StringIO(raw.decode("utf-8-sig", "replace"))):
                yield r
        elif low.endswith(".xml"):
            root = ET.fromstring(raw)
            for el in root.iter():
                kids = list(el)
                if kids and all(len(list(k)) == 0 for k in kids) and len(kids) >= 3:
                    yield {k.tag: (k.text or "") for k in kids}


def auctions():
    best, scanned, schema = {}, 0, {}
    base = SITE["auction_base"]
    for fname in SITE["auction_files"]:
        try:
            blob = fetch(base + fname, timeout=180, binary=True)
            n = 0
            for raw in _records(blob, fname):
                rec = _norm_keys(raw)
                if not schema.get(fname):
                    schema[fname] = sorted(rec.keys())[:40]
                dom = _pick(rec, "d")
                if not dom:
                    continue
                dom = str(dom).strip().lower().rstrip(".")
                if not re.fullmatch(r"[a-z0-9-]+(\.[a-z0-9-]+)+", dom):
                    continue
                adult = _pick(rec, "x")
                if str(adult).lower() in ("true", "1", "yes"):
                    continue
                scanned += 1
                n += 1
                parts = dom.split(".")
                sld, tld = parts[0], ".".join(parts[1:])
                sc = appraise.appraise(sld, tld)
                item = {"d": dom, "s": sc["score"], "tl": tld, "n": len(sld)}
                p = _num(_pick(rec, "p"))
                if p is not None:
                    item["p"] = round(p, 2)
                b = _num(_pick(rec, "b"))
                if b is not None:
                    item["b"] = int(b)
                t = _num(_pick(rec, "t"))
                if t is not None:
                    item["t"] = int(t)
                a = _num(_pick(rec, "a"))
                if a is not None:
                    item["a"] = int(a)
                v = _num(_pick(rec, "v"))
                if v is not None:
                    item["v"] = int(v)
                end = _date(_pick(rec, "e"))
                if end:
                    item["e"] = end
                link = _pick(rec, "l")
                item["l"] = str(link) if link and str(link).startswith("http") else f"https://auctions.godaddy.com/trpItemListing.aspx?domain={dom}"
                old = best.get(dom)
                if not old or (item.get("b") or 0) > (old.get("b") or 0):
                    best[dom] = {**(old or {}), **item}
            record(f"auctions:{fname}", True, n)
        except Exception as ex:  # noqa: BLE001
            record(f"auctions:{fname}", False, 0, ex)
    if best:
        now_iso = NOW.isoformat(timespec="minutes")
        items = [x for x in best.values() if not x.get("e") or x["e"] >= now_iso]

        def rank(x):
            return x["s"] * 3 + min(x.get("b") or 0, 50) + min((x.get("t") or 0) / 20, 30)
        items.sort(key=rank, reverse=True)
        items = items[:2500]
        save("auctions", {"updated": now_iso, "source": "GoDaddy Auctions public inventory", "scanned": scanned, "items": items})
        STATUS["auction_schema"] = schema


def main():
    words()
    for fn in (tlds, news, videos, auctions):
        try:
            fn()
        except Exception as ex:  # noqa: BLE001
            record(fn.__name__, False, 0, ex)
    save("status", STATUS)
    print("done")


if __name__ == "__main__":
    main()
