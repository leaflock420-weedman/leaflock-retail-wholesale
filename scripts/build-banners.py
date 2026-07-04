"""Build hero banners — humidity pack on hub; gummies banner for gummies page only."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "banners"
OUT.mkdir(parents=True, exist_ok=True)

BANNER_SIZE = (1920, 560)
MINT = (234, 245, 237)
WHITE = (248, 250, 248)

PHARMACY_PACK = ROOT / "assets" / "products" / "humidity" / "white-pharmacy-pack.jpg"
GUMMY_LINEUP = ROOT / "assets" / "products" / "gummies" / "gummy-lineup-white.jpg"


def save_banner(img: Image.Image, name: str) -> None:
    path = OUT / name
    img.save(path, format="JPEG", quality=90, optimize=True, subsampling=0)
    print(f"Wrote {path.relative_to(ROOT)}")


def pack_banner(src: Path, name: str, *, bg=MINT, inset_right=140) -> None:
    banner = Image.new("RGB", BANNER_SIZE, bg)
    pack = Image.open(src).convert("RGB")

    target_h = int(BANNER_SIZE[1] * 0.78)
    scale = target_h / pack.height
    target_w = int(pack.width * scale)
    pack = pack.resize((target_w, target_h), Image.Resampling.LANCZOS)

    x = BANNER_SIZE[0] - target_w - inset_right
    y = (BANNER_SIZE[1] - target_h) // 2
    banner.paste(pack, (x, y))
    save_banner(banner, name)


def main() -> None:
    pack_banner(PHARMACY_PACK, "hub-banner.jpg")
    pack_banner(PHARMACY_PACK, "humidity-banner.jpg")

    if GUMMY_LINEUP.exists():
        pack_banner(GUMMY_LINEUP, "gummies-banner.jpg", bg=WHITE, inset_right=60)


if __name__ == "__main__":
    main()