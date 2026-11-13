#!/usr/bin/env python3
"""Render brand PNGs (logo, touch icon, favicon, social card) with headless Chrome + Pillow.
Runs in the GitHub Action only when an image is missing."""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / "assets"
NEED = ["logo-512.png", "apple-touch-icon.png", "favicon-32.png", "og-default.png"]
if all((A / n).exists() for n in NEED):
    sys.exit(0)

chrome = next((shutil.which(c) for c in ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"] if shutil.which(c)), None)
if not chrome:
    print("No Chrome found; skipping images")
    sys.exit(0)

LOGO = ('<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" width="{w}" height="{w}"><rect width="80" height="80" rx="18" fill="{bg}"/>'
        '<path d="M26 22 L26 58 M26 22 L46 22 C53 22 56 26 56 31 C56 36 53 39 47 39 L26 39 M26 39 L48 39 C55 39 58 43 58 49 C58 54 55 58 47 58 L26 58" '
        'stroke="{fg}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>')
FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap">'
OG = f"""<html><head>{FONT}</head><body style="margin:0;width:1200px;height:630px;background:linear-gradient(135deg,#0b0b0c,#1d1d22);font-family:Inter,Arial,sans-serif;color:#f3f2ee;display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box">
<div style="display:flex;align-items:center;gap:22px">{LOGO.format(w=96, bg='#f3f2ee', fg='#0b0b0c')}<div style="font-size:64px;font-weight:600;letter-spacing:-2px">Better<b style="font-weight:800">Nic</b></div></div>
<div style="font-size:54px;font-weight:700;letter-spacing:-1.5px;margin-top:40px;line-height:1.1">The command center<br>for domain investors.</div>
<div style="font-size:26px;color:#34d399;margin-top:28px;font-weight:600">37 free tools &middot; Daily auctions &amp; news &middot; 5% marketplace</div></body></html>"""


def shot(html, out, w, h):
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write(html)
    subprocess.run([chrome, "--headless=new", "--no-sandbox", "--hide-scrollbars", "--disable-gpu", f"--window-size={w},{h}",
                    "--virtual-time-budget=6000", f"--screenshot={out}", f"file://{f.name}"], check=True, timeout=120)


tmp = Path(tempfile.mkdtemp())
shot(f'<html><body style="margin:0;background:#0b0b0c">{LOGO.format(w=512, bg="#0b0b0c", fg="#ffffff")}</body></html>', tmp / "logo.png", 512, 512)
shot(OG, tmp / "og.png", 1200, 630)
try:
    from PIL import Image
    logo = Image.open(tmp / "logo.png").convert("RGB").crop((0, 0, 512, 512))
    logo.save(A / "logo-512.png", optimize=True)
    logo.resize((180, 180), Image.LANCZOS).save(A / "apple-touch-icon.png", optimize=True)
    logo.resize((32, 32), Image.LANCZOS).save(A / "favicon-32.png", optimize=True)
    og = Image.open(tmp / "og.png").convert("RGB").crop((0, 0, 1200, 630)).quantize(colors=128)
    og.save(A / "og-default.png", optimize=True)
except ImportError:
    shutil.copy(tmp / "logo.png", A / "logo-512.png")
    shutil.copy(tmp / "logo.png", A / "apple-touch-icon.png")
    shutil.copy(tmp / "logo.png", A / "favicon-32.png")
    shutil.copy(tmp / "og.png", A / "og-default.png")
print("images rendered")
