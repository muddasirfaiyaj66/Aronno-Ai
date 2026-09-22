"""Build professional Aronno icon / splash assets for Expo."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter

SRC = Path(r"C:\Users\USER\.cursor\projects\f-aronno\assets")
OUT = Path(r"F:\aronno\mobile\assets\images")
OUT.mkdir(parents=True, exist_ok=True)

SAND = (244, 246, 244, 255)  # #F4F6F4
FOREST = (27, 94, 74, 255)  # #1B5E4A
SIZE = 1024


def fit(im: Image.Image, size: int = SIZE, scale: float = 1.0) -> Image.Image:
    im = im.convert("RGBA")
    copy = im.copy()
    target = int(size * scale)
    copy.thumbnail((target, target), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(copy, ((size - copy.width) // 2, (size - copy.height) // 2), copy)
    return canvas


def flatten(im: Image.Image, bg: tuple[int, int, int, int]) -> Image.Image:
    base = Image.new("RGBA", im.size, bg)
    return Image.alpha_composite(base, im.convert("RGBA")).convert("RGB")


def knock_out_bg(im: Image.Image) -> Image.Image:
    """Make near-white / near-black / sand backgrounds transparent."""
    rgba = im.convert("RGBA")
    out = []
    for r, g, b, a in rgba.getdata():
        if a < 12:
            out.append((0, 0, 0, 0))
        elif r < 28 and g < 28 and b < 28:
            out.append((0, 0, 0, 0))
        elif r > 232 and g > 232 and b > 228:
            out.append((0, 0, 0, 0))
        elif abs(r - 244) < 20 and abs(g - 246) < 20 and abs(b - 244) < 20:
            out.append((0, 0, 0, 0))
        # forest plate bg leftover near edges
        elif abs(r - 27) < 18 and abs(g - 94) < 25 and abs(b - 74) < 22 and (
            r + g + b
        ) < 220:
            # keep mark mint/leaf colors; only knock solid plate IF pixel is deep forest
            # mint leaf is much lighter — skip knockout for light greens
            if g < 120 and r < 60:
                out.append((0, 0, 0, 0))
            else:
                out.append((r, g, b, a))
        else:
            out.append((r, g, b, a))
    rgba.putdata(out)
    return rgba


def monochrome_white(im: Image.Image) -> Image.Image:
    rgba = im.convert("RGBA")
    out = []
    for r, g, b, a in rgba.getdata():
        if a < 20:
            out.append((255, 255, 255, 0))
        else:
            out.append((255, 255, 255, a))
    mono = Image.new("RGBA", rgba.size)
    mono.putdata(out)
    alpha = mono.split()[-1].filter(ImageFilter.MaxFilter(3))
    mono.putalpha(alpha)
    return mono


def main() -> None:
    forest_plate = SRC / "aronno-icon-on-forest.png"
    clean = SRC / "aronno-icon-clean.png"
    splash_src = SRC / "aronno-splash-logo.png"
    fg_src = SRC / "aronno-icon-foreground.png"

    # --- Primary app icon: forest plate (high contrast on home screen) ---
    plate = Image.open(forest_plate).convert("RGBA")
    plate = fit(plate, scale=1.0)
    # ensure opaque full-bleed forest (cover any residual transparency)
    flatten(plate, FOREST).save(OUT / "icon.png", "PNG")
    flatten(plate, FOREST).save(OUT / "logo.png", "PNG")
    print("icon.png / logo.png (forest plate)")

    # --- Adaptive background: solid forest ---
    Image.new("RGB", (SIZE, SIZE), FOREST[:3]).save(
        OUT / "android-icon-background.png", "PNG"
    )
    print("android-icon-background.png")

    # --- Adaptive foreground: mark only, safe-zone padded ---
    # Prefer transparent-capable mark; fall back to knocking forest plate
    if fg_src.exists():
        mark = knock_out_bg(Image.open(fg_src))
    else:
        mark = knock_out_bg(Image.open(clean))
    # If mark is mostly empty, derive from clean
    bbox = mark.getbbox()
    if not bbox:
        mark = knock_out_bg(Image.open(clean))
    # Crop to content then pad into safe zone (~58%)
    bbox = mark.getbbox()
    if bbox:
        mark = mark.crop(bbox)
    fg = fit(mark, scale=0.58)
    fg.save(OUT / "android-icon-foreground.png", "PNG")
    print("android-icon-foreground.png")

    mono = monochrome_white(fg)
    mono.save(OUT / "android-icon-monochrome.png", "PNG")
    print("android-icon-monochrome.png")

    # --- Splash: soft sand + centered mark ---
    splash_in = splash_src if splash_src.exists() else clean
    splash_mark = knock_out_bg(Image.open(splash_in))
    bb = splash_mark.getbbox()
    if bb:
        splash_mark = splash_mark.crop(bb)
    splash = fit(splash_mark, scale=0.48)
    flatten(splash, SAND).save(OUT / "splash-icon.png", "PNG")
    flatten(splash, SAND).save(OUT / "logo-mark.png", "PNG")
    print("splash-icon.png / logo-mark.png")

    # Favicon
    fav = flatten(fit(knock_out_bg(Image.open(clean)), size=192, scale=0.85), FOREST)
    fav.resize((48, 48), Image.Resampling.LANCZOS).save(OUT / "favicon.png", "PNG")
    print("favicon.png")
    print("DONE")


if __name__ == "__main__":
    main()
