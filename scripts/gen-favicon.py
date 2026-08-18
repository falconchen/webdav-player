#!/usr/bin/env python3
"""Generate the iOS6 skeuomorphic favicon (public/favicon.png).

64x64: blue gradient rounded square + glass highlight + play triangle,
matching the app's iOS6 look. Drawn at 4x supersampling for smooth edges.

Requires: python3 + Pillow (PIL).
Usage: python3 scripts/gen-favicon.py
"""
import os

from PIL import Image, ImageDraw

SIZE = 64
SS = 4  # supersample factor
W = H = SIZE * SS
RADIUS = int(W * 0.22)
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "favicon.png")


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def main():
    # --- rounded-square mask ---
    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, W - 1, H - 1], radius=RADIUS, fill=255)

    # --- vertical gradient (matches navbar blues) ---
    grad = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = grad.load()
    top = (96, 134, 190)
    mid = (80, 110, 168)
    bottom = (52, 78, 130)
    for y in range(H):
        t = y / (H - 1)
        c = lerp(top, mid, t * 0.6) if t < 0.6 else lerp(mid, bottom, (t - 0.6) / 0.4)
        for x in range(W):
            px[x, y] = c + (255,)

    img = Image.composite(grad, Image.new("RGBA", (W, H), (0, 0, 0, 0)), mask)

    # --- glass highlight (top half) ---
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.rounded_rectangle([0, 0, W - 1, H - 1], radius=RADIUS, fill=(255, 255, 255, 90))
    highlight = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    hd = ImageDraw.Draw(highlight)
    hd.ellipse([-W * 0.25, -H * 0.9, W * 1.25, H * 0.5], fill=(255, 255, 255, 120))
    img = Image.alpha_composite(img, highlight)

    # --- play triangle (white with soft shadow) ---
    tri_shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    tsd = ImageDraw.Draw(tri_shadow)
    tsd.polygon([(W * 0.40, H * 0.30), (W * 0.40, H * 0.70), (W * 0.66, H * 0.50)], fill=(20, 30, 60, 130))
    tri = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    td = ImageDraw.Draw(tri)
    td.polygon([(W * 0.38, H * 0.30), (W * 0.38, H * 0.70), (W * 0.64, H * 0.50)], fill=(250, 252, 255, 255))
    img = Image.alpha_composite(img, tri_shadow)
    img = Image.alpha_composite(img, tri)

    # --- subtle inner border ---
    border = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(border)
    bd.rounded_rectangle([1, 1, W - 2, H - 2], radius=RADIUS, outline=(255, 255, 255, 60), width=2)
    img = Image.alpha_composite(img, border)

    # --- downscale with LANCZOS for smooth edges ---
    img = img.resize((SIZE, SIZE), Image.LANCZOS)

    out = os.path.abspath(OUT)
    img.save(out, "PNG")
    print(f"favicon written: {out} ({SIZE}x{SIZE})")


if __name__ == "__main__":
    main()
