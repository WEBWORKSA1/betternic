#!/usr/bin/env python3
"""Render brand PNGs (logo, touch icon, favicon, social card) only when missing.
Uses headless Chrome when available (GitHub Actions), otherwise draws them with Pillow (Netlify)."""
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

LOGO = ('<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" width="{w}" height="{w}"><rect width="80" height="80" rx="18" fill="{bg}"/>'
        '<path d="M26 22 L26 58 M26 22 L46 22 C53 22 56 26 56 31 C56 36 53 39 47 39 L26 39 M26 39 L48 39 C55 39 58 43 58 49 C58 54 55 58 47 58 L26 58" '
        'stroke="{fg}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>')
FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap">'
OG = f"""<html><head>{FONT}</head><body style="margin:0;width:1200px;height:630px;background:linear-gradient(135deg,#0b0b0c,#1d1d22);font-family:Inter,Arial,sans-serif;color:#f3f2ee;display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box">
<div style="display:flex;align-items:center;gap:22px">{LOGO.format(w=96, bg='#f3f2ee', fg='#0b0b0c')}<div style="font-size:64px;font-weight:600;letter-spacing:-2px">Better<b style="font-weight:800">Nic</b></div></div>
<div style="font-size:54px;font-weight:700;letter-spacing:-1.5px;margin-top:40px;line-height:1.1">The command center<br>for domain investors.</div>
<div style="font-size:26px;color:#34d399;margin-top:28px;font-weight:600">37 free tools &middot; Daily auctions &amp; news &middot; 5% marketplace</div></body></html>"""

# The B monogram as polylines (80x80 design grid), cubic curves sampled.
SEGS = [[(26, 22), (26, 58)],
        [(26, 22), (46, 22), ("C", (53, 22), (56, 26), (56, 31)), ("C", (56, 36), (53, 39), (47, 39)), (26, 39)],
        [(26, 39), (48, 39), ("C", (55, 39), (58, 43), (58, 49)), ("C", (58, 54), (55, 58), (47, 58)), (26, 58)]]


def _poly(seg):
    pts = []
    for item in seg:
        if item and item[0] == "C":
            p0 = pts[-1]
            (x1, y1), (x2, y2), (x3, y3) = item[1], item[2], item[3]
            for i in range(1, 17):
                t = i / 16
                u = 1 - t
                pts.append((u ** 3 * p0[0] + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3,
                            u ** 3 * p0[1] + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3))
        else:
            pts.append(item)
    return pts


def pillow_logo(size, bg, fg, radius=18, stroke=5):
    from PIL import Image, ImageDraw
    k = 4  # supersample
    S = size * k
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=radius * S / 80, fill=bg)
    w = stroke * S / 80
    for seg in SEGS:
        pts = [(x * S / 80, y * S / 80) for x, y in _poly(seg)]
        d.line(pts, fill=fg, width=int(round(w)), joint="curve")
        for x, y in (pts[0], pts[-1]):
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=fg)
    return im.resize((size, size), Image.LANCZOS)


def font(size, bold=True):
    from PIL import ImageFont
    for p in (["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"] if bold else
              ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"]):
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def with_pillow():
    from PIL import Image, ImageDraw
    logo = pillow_logo(512, "#0b0b0c", "#ffffff").convert("RGB")
    logo.save(A / "logo-512.png", optimize=True)
    logo.resize((180, 180), Image.LANCZOS).save(A / "apple-touch-icon.png", optimize=True)
    logo.resize((32, 32), Image.LANCZOS).save(A / "favicon-32.png", optimize=True)
    W, H = 1200, 630
    og = Image.new("RGB", (W, H), "#0b0b0c")
    d = ImageDraw.Draw(og)
    for y in range(H):  # subtle diagonal-ish gradient
        t = y / H
        c = tuple(int(a + (b - a) * t) for a, b in zip((11, 11, 12), (29, 29, 34)))
        d.line([(0, y), (W, y)], fill=c)
    mark = pillow_logo(96, "#f3f2ee", "#0b0b0c")
    og.paste(mark, (90, 120), mark)
    d.text((210, 128), "BetterNic", font=font(64), fill="#f3f2ee")
    d.text((90, 270), "The command center", font=font(54), fill="#f3f2ee")
    d.text((90, 334), "for domain investors.", font=font(54), fill="#f3f2ee")
    d.text((90, 440), "37 free tools · Daily auctions & news · 5% marketplace", font=font(26), fill="#34d399")
    og.quantize(colors=128).save(A / "og-default.png", optimize=True)


def with_chrome(chrome):
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
        for n in ("logo-512.png", "apple-touch-icon.png", "favicon-32.png"):
            shutil.copy(tmp / "logo.png", A / n)
        shutil.copy(tmp / "og.png", A / "og-default.png")


chrome = next((shutil.which(c) for c in ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"] if shutil.which(c)), None)
try:
    if chrome:
        with_chrome(chrome)
    else:
        with_pillow()
    print("images rendered")
except Exception as ex:  # noqa: BLE001
    print("image rendering skipped:", ex)
