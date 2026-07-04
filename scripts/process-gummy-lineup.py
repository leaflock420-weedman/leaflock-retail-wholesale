"""Turn the black-background gummy lineup render into a clean white product shot."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "raw" / "gummy-lineup-black.jpg"
OUT_DIR = ROOT / "assets" / "products" / "gummies"
TARGET_WIDTH = 4000
WHITE = (248, 250, 248)  # matches site paper tone


def upscale(img: Image.Image, width: int) -> Image.Image:
    if img.width >= width:
        return img
    height = round(img.height * (width / img.width))
    return img.resize((width, height), Image.Resampling.LANCZOS)


def remove_black_background(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    arr = np.array(rgba, dtype=np.uint8)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]

    brightness = r.astype(np.int16) + g.astype(np.int16) + b.astype(np.int16)
    chroma = np.maximum.reduce([r, g, b]).astype(np.int16) - np.minimum.reduce([r, g, b]).astype(np.int16)

    # Pure/near-black studio backdrop, keep dark pouch artwork.
    background = (brightness < 90) & (chroma < 40)
    arr[background, 3] = 0

    cleaned = Image.fromarray(arr, "RGBA")

    # Trim stray backdrop specks touching the edges.
    bbox = cleaned.getbbox()
    if not bbox:
        return cleaned
    return cleaned.crop(bbox)


def add_canvas_and_shadow(
    subject: Image.Image,
    *,
    canvas_width: int,
    canvas_height: int,
    padding_x: int,
    padding_top: int,
    padding_bottom: int,
) -> Image.Image:
    max_w = canvas_width - padding_x * 2
    max_h = canvas_height - padding_top - padding_bottom
    scale = min(max_w / subject.width, max_h / subject.height, 1.0)
    subject = subject.resize(
        (max(1, int(subject.width * scale)), max(1, int(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )

    canvas = Image.new("RGB", (canvas_width, canvas_height), WHITE)

    alpha = subject.split()[-1]
    shadow = Image.new("RGBA", subject.size, (0, 0, 0, 0))
    shadow_mask = alpha.point(lambda v: int(v * 0.22))
    shadow.putalpha(shadow_mask)
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))

    x = (canvas_width - subject.width) // 2
    y = padding_top + int((max_h - subject.height) * 0.08)

    canvas.paste(shadow, (x + 10, y + 16), shadow)
    canvas.paste(subject, (x, y), subject)
    return canvas


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    source = Image.open(SRC).convert("RGB")
    source = upscale(source, TARGET_WIDTH)

    cutout = remove_black_background(source)
    cutout = ImageOps.expand(cutout, border=24, fill=(0, 0, 0, 0))

    aspect = cutout.width / cutout.height
    canvas_h = int(TARGET_WIDTH / aspect) + 280
    canvas_h = max(canvas_h, 1800)

    final = add_canvas_and_shadow(
        cutout,
        canvas_width=TARGET_WIDTH,
        canvas_height=canvas_h,
        padding_x=180,
        padding_top=120,
        padding_bottom=160,
    )

    hero_path = OUT_DIR / "gummy-lineup-white.jpg"
    final.save(hero_path, format="JPEG", quality=92, optimize=True, subsampling=0)
    print(f"Wrote {hero_path.relative_to(ROOT)} ({final.size[0]}x{final.size[1]})")


if __name__ == "__main__":
    main()