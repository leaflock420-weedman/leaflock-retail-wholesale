"""Clean up the humidity pack lifestyle photo for banners and product display."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "raw" / "community-pack-lifestyle.jpg"
OUT = ROOT / "assets" / "products" / "humidity"
TARGET_WIDTH = 3840
WHITE = (248, 250, 248)


def upscale(img: Image.Image, width: int) -> Image.Image:
    if img.width >= width:
        return img
    height = round(img.height * (width / img.width))
    return img.resize((width, height), Image.Resampling.LANCZOS)


def clean_lifestyle(img: Image.Image) -> Image.Image:
    """Keep the pack/hand sharp; soften the busy pool background into a clean studio look."""
    w, h = img.size
    subject = img.crop((int(w * 0.18), int(h * 0.08), int(w * 0.82), int(h * 0.92)))
    subject = ImageEnhance.Contrast(subject).enhance(1.06)
    subject = ImageEnhance.Sharpness(subject).enhance(1.2)

    soft_bg = img.filter(ImageFilter.GaussianBlur(28))
    soft_arr = np.array(soft_bg, dtype=np.float32)
    # Lift shadows and wash the background toward white.
    soft_arr = soft_arr * 0.55 + 255 * 0.45
    soft_bg = Image.fromarray(np.clip(soft_arr, 0, 255).astype(np.uint8))

    canvas = Image.new("RGB", img.size, WHITE)
    canvas.paste(soft_bg, (0, 0))
    sx = (canvas.width - subject.width) // 2
    sy = int(canvas.height * 0.06)
    canvas.paste(subject, (sx, sy))
    return canvas


def pack_cutout(img: Image.Image) -> Image.Image:
    """Tight product crop for front display."""
    w, h = img.size
    crop = img.crop((int(w * 0.28), int(h * 0.12), int(w * 0.72), int(h * 0.82)))
    canvas = Image.new("RGB", (1800, 2200), WHITE)
    crop.thumbnail((1500, 2000), Image.Resampling.LANCZOS)
    x = (canvas.width - crop.width) // 2
    y = (canvas.height - crop.height) // 2
    canvas.paste(crop, (x, y))
    return canvas


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    source = upscale(Image.open(SRC).convert("RGB"), TARGET_WIDTH)

    clean = clean_lifestyle(source)
    front = pack_cutout(clean)

    clean_path = OUT / "community-pack-clean.jpg"
    front_path = OUT / "community-pack-front.jpg"

    clean.save(clean_path, format="JPEG", quality=92, optimize=True, subsampling=0)
    front.save(front_path, format="JPEG", quality=92, optimize=True, subsampling=0)

    print(f"Wrote {clean_path.relative_to(ROOT)} ({clean.size[0]}x{clean.size[1]})")
    print(f"Wrote {front_path.relative_to(ROOT)} ({front.size[0]}x{front.size[1]})")


if __name__ == "__main__":
    main()