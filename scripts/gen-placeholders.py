#!/usr/bin/env python3
"""Generate gallery placeholder assets.

- public/img-loading.gif : transparent animated spinner (rotating arc ring)
- public/img-error.png   : gray-red placeholder with a warning mark

Requires python3 + Pillow.
Usage: python3 scripts/gen-placeholders.py
"""
import math
import os

from PIL import Image, ImageDraw

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public")
SPIN_SIZE = 96
SPIN_FRAMES = 12
FRAME_MS = 70


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


def make_spinner_frame(angle_deg):
    """One frame: transparent bg + white arc ring (270deg) rotated by angle."""
    s = SPIN_SIZE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    margin = 10
    width = 8
    box = [margin, margin, s - margin, s - margin]
    # full faint ring for stability
    d.ellipse(box, outline=(255, 255, 255, 60), width=width)
    # bright leading arc
    d.arc(box, start=angle_deg - 60, end=angle_deg, fill=(255, 255, 255, 255), width=width)
    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # ---- loading spinner GIF (transparent) ----
    frames = [make_spinner_frame(i * (360 / SPIN_FRAMES)) for i in range(SPIN_FRAMES)]
    gif_path = os.path.join(OUT_DIR, "img-loading.gif")
    frames[0].save(
        gif_path,
        save_all=True,
        append_images=frames[1:],
        duration=FRAME_MS,
        loop=0,
        transparency=0,
        disposal=2,  # restore background between frames (true transparency)
    )
    print("written:", gif_path)

    # ---- error placeholder ----
    W, H = 640, 360
    error = rounded_gradient((W, H), (124, 84, 84), (66, 42, 44))
    d = ImageDraw.Draw(error, "RGBA")
    cx, cy = W // 2, H // 2
    tri = [(cx, cy - 52), (cx - 58, cy + 42), (cx + 58, cy + 42)]
    d.polygon(tri, outline=(255, 255, 255, 220), width=6)
    d.line([(cx, cy - 12), (cx, cy + 16)], fill=(255, 255, 255, 220), width=7)
    d.ellipse([cx - 5, cy + 28, cx + 5, cy + 38], fill=(255, 255, 255, 220))
    error_path = os.path.join(OUT_DIR, "img-error.png")
    error.save(error_path)
    print("written:", error_path)


if __name__ == "__main__":
    main()
