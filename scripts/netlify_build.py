#!/usr/bin/env python3
"""Netlify build entry point. Makes every deploy self-sufficient:
1. installs optional packages (wordfreq for scoring, Pillow for images) — failures are ignored
2. renders brand images if missing
3. refreshes data/*.json unless the daily GitHub Action already did so in the last 20 hours
4. builds the site into ./public
"""
import datetime
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
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


if run([PY, "-m", "pip", "install", "--quiet", "--disable-pip-version-check", "wordfreq", "pillow"]) != 0:
    run([PY, "-m", "pip", "install", "--quiet", "--user", "--disable-pip-version-check", "wordfreq", "pillow"])

run([PY, "scripts/make_images.py"], timeout=300)

fresh = False
try:
    st = json.loads((ROOT / "data" / "status.json").read_text())
    age = datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(st["updated"])
    fresh = age < datetime.timedelta(hours=20) and (ROOT / "data" / "auctions.json").exists()
except Exception:  # noqa: BLE001
    pass
if fresh:
    print("Data refreshed by the daily Action less than 20 hours ago; skipping fetch.")
else:
    run([PY, "scripts/update_data.py"], timeout=900)

run([PY, "scripts/build.py"], check=True)
