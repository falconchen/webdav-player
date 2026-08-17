#!/usr/bin/env python3
"""Generate the default video poster (public/video-poster.png).

iOS6 skeuomorphic style: dark blue gradient + glass highlight +
centered play triangle. 16:9, 960x540.

Requires: python3 + Pillow (PIL).
Usage: python3 scripts/gen-poster.py
"""
import os

from PIL import Image, ImageDraw, ImageFilter

W, H = 960, 540
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "video-poster.png")


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def main():
    img = Image.new("RGB", (W, H))
    px = img.load()

    # Vertical gradient: deep navy -> royal blue
    top = (58, 90, 158)      # #3a5a9e
    mid = (41, 78, 148)      # #294e94
    bottom = (23, 45, 96)    # #172d60
    for y in range(H):
        t = y / (H - 1)
        if t < 0.5:
            c = lerp(top, mid, t * 2)
        else:
            c = lerp(mid, bottom, (t - 0.5) * 2)
        for x in range(W):
            px[x, y] = c

    # Glass highlight: rounded top glow
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-W * 0.4, -H * 0.75, W * 1.4, H * 0.45], fill=(255, 255, 255, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")

    # Bottom inner shadow
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rectangle([0, H - 60, W, H], fill=(0, 0, 20, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(20))
    img = Image.alpha_composite(img.convert("RGBA"), shadow).convert("RGB")

    d = ImageDraw.Draw(img)

    # Play triangle (white with subtle drop shadow)
    cx, cy = W // 2, H // 2
    r = 110
    tip = (cx - int(r * 0.62), cy - r)
    right = (cx - int(r * 0.62), cy + r)
    base_mid = (cx + int(r * 0.72), cy)
    # shadow
    d.polygon([(tip[0] + 3, tip[1] + 5), (right[0] + 3, right[1] + 5), (base_mid[0] + 3, base_mid[1] + 5)], fill=(10, 20, 45))
    # glow behind triangle
    glow2 = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g2d = ImageDraw.Draw(glow2)
    g2d.polygon([tip, right, base_mid], fill=(255, 255, 255, 60))
    glow2 = glow2.filter(ImageFilter.GaussianBlur(18))
    img = Image.alpha_composite(img.convert("RGBA"), glow2).convert("RGB")
    d = ImageDraw.Draw(img)
    d.polygon([tip, right, base_mid], fill=(240, 244, 250))

    # Subtle rounded rect frame inset (film-border feel)
    frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle([28, 22, W - 28, H - 22], radius=18, outline=(255, 255, 255, 40), width=4)
    img = Image.alpha_composite(img.convert("RGBA"), frame).convert("RGB")

    out = os.path.abspath(OUT)
    img.save(out, "PNG")
    print(f"poster written: {out} ({W}x{H})")


if __name__ == "__main__":
    main()
