#!/usr/bin/env python3
"""Generate gallery placeholder images (public/img-loading.png, public/img-error.png).

- img-loading.png: neutral gray-blue placeholder with a spinner-ish ring
- img-error.png:   gray-red placeholder with a warning mark

16:9 (640x360), iOS6-ish flat-skeuo style. Requires python3 + Pillow.
Usage: python3 scripts/gen-placeholders.py
"""
import os

from PIL import Image, ImageDraw

W, H = 640, 360
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public")


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def rounded_gradient(size, top, bottom, radius_ratio=0.06):
    w, h = size
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        c = lerp(top, bottom, y / (h - 1))
        for x in range(w):
            px[x, y] = c
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, w - 1, h - 1], radius=int(h * radius_ratio), fill=255)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # ---- loading placeholder ----
    loading = rounded_gradient((W, H), (92, 104, 124), (46, 54, 68))
    d = ImageDraw.Draw(loading, "RGBA")
    # ring
    cx, cy, r = W // 2, H // 2, 44
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255, 120), width=8)
    # spinner gap (draw a filled arc segment as pie to simulate loading)
    d.pieslice([cx - r, cy - r, cx + r, cy + r], start=30, end=150, fill=(255, 255, 255, 200))
    d.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=(255, 255, 255, 230))
    loading.save(os.path.join(OUT_DIR, "img-loading.png"))
    print("written:", os.path.join(OUT_DIR, "img-loading.png"))

    # ---- error placeholder ----
    error = rounded_gradient((W, H), (124, 84, 84), (66, 42, 44))
    d = ImageDraw.Draw(error, "RGBA")
    cx, cy = W // 2, H // 2
    # warning triangle
    tri = [(cx, cy - 52), (cx - 58, cy + 42), (cx + 58, cy + 42)]
    d.polygon(tri, outline=(255, 255, 255, 220), width=6)
    d.line([(cx, cy - 12), (cx, cy + 16)], fill=(255, 255, 255, 220), width=7)
    d.ellipse([cx - 5, cy + 28, cx + 5, cy + 38], fill=(255, 255, 255, 220))
    error.save(os.path.join(OUT_DIR, "img-error.png"))
    print("written:", os.path.join(OUT_DIR, "img-error.png"))


if __name__ == "__main__":
    main()
