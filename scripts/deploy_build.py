#!/usr/bin/env python3
"""Build entry point for any host (Vercel: vercel.json, Netlify: netlify.toml). Makes every deploy self-sufficient:
1. restores yesterday's data, word list, brief archive and images from the live site (hosts don't keep files between builds)
2. installs optional packages (wordfreq for scoring, Pillow for images); failures are ignored
3. renders brand images if missing
4. refreshes data/*.json unless it was refreshed in the last 6 hours
5. builds the site into ./public, then publishes the brief archive index and the form settings
"""
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
PY = sys.executable


def run(args, check=False, timeout=900):
    print("$", " ".join(args), flush=True)
    try:
        return subprocess.run(args, cwd=ROOT, check=check, timeout=timeout).returncode
    except Exception as ex:  # noqa: BLE001
        if check:
            raise
        print("  (ignored)", ex)
        return 1


def live_base():
    for v in (os.environ.get("BN_RESTORE_URL"), os.environ.get("VERCEL_PROJECT_PRODUCTION_URL"), os.environ.get("URL")):
        if v:
            return (v if v.startswith("http") else "https://" + v).rstrip("/")
    return None


def get(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": "BetterNicBuild/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def restore(base):
    (DATA / "history").mkdir(parents=True, exist_ok=True)
    for name in ["auctions", "news", "videos", "tlds", "rdap", "words", "status", "brief"]:
        p = DATA / f"{name}.json"
        if p.exists():
            continue
        try:
            b = get(f"{base}/data/{name}.json")
            json.loads(b)
            p.write_bytes(b)
            print("restored data/%s.json" % name)
        except Exception as ex:  # noqa: BLE001
            print("  not restored %s: %s" % (name, ex))
    try:
        idx = json.loads(get(f"{base}/data/history/index.json"))
        n = 0
        for fn in idx.get("files", [])[-30:]:
            if not re.fullmatch(r"brief-\d{4}-\d{2}-\d{2}\.json", fn) or (DATA / "history" / fn).exists():
                continue
            b = get(f"{base}/data/history/{fn}")
            json.loads(b)
            (DATA / "history" / fn).write_bytes(b)
            n += 1
        print("restored %d brief snapshots" % n)
    except Exception as ex:  # noqa: BLE001
        print("  no brief archive restored:", ex)
    for name in ["logo-512.png", "apple-touch-icon.png", "favicon-32.png", "og-default.png"]:
        p = ROOT / "assets" / name
        if p.exists():
            continue
        try:
            b = get(f"{base}/assets/{name}")
            if b[:4] == b"\x89PNG":
                p.write_bytes(b)
        except Exception:  # noqa: BLE001
            pass


base = live_base()
if base:
    print("Restoring state from", base)
    restore(base)

pip = [PY, "-m", "pip", "install", "--quiet", "--disable-pip-version-check", "wordfreq", "pillow"]
if run(pip) != 0 and run(pip + ["--user"]) != 0:
    run(pip + ["--break-system-packages"])

run([PY, "scripts/make_images.py"], timeout=300)

fresh = False
try:
    st = json.loads((DATA / "status.json").read_text())
    age = datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(st["updated"])
    fresh = age < datetime.timedelta(hours=6) and (DATA / "auctions.json").exists()
except Exception:  # noqa: BLE001
    pass
if fresh and not os.environ.get("BN_FORCE_FETCH"):
    print("Data refreshed less than 6 hours ago; skipping fetch.")
else:
    run([PY, "scripts/update_data.py"], timeout=900)

run([PY, "scripts/build.py"], check=True)

# Publish the brief archive so the next build (on a host without persistent storage) can restore it.
out = ROOT / "public" / "data" / "history"
out.mkdir(parents=True, exist_ok=True)
files = sorted(p.name for p in (DATA / "history").glob("brief-*.json"))[-30:]
for fn in files:
    shutil.copy(DATA / "history" / fn, out / fn)
(out / "index.json").write_text(json.dumps({"files": files}))

# Form delivery settings. The Web3Forms access key is tied to the owner's inbox; the address itself is never published.
key = os.environ.get("WEB3FORMS_KEY", "").strip()
cfg = {"provider": "web3forms", "key": key} if key else {"provider": "netlify" if os.environ.get("NETLIFY") else "none"}
(ROOT / "public" / "data" / "forms.json").write_text(json.dumps(cfg))
print("forms provider:", cfg["provider"])
