"""Split PlantVillage (or similar class-folder layout) into train/val/test."""
from __future__ import annotations

import pathlib
import random
import shutil

SRC = pathlib.Path(__file__).resolve().parent.parent / "data" / "raw" / "plantvillage"
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "processed"


def main() -> None:
    if not SRC.exists():
        raise SystemExit(
            f"Missing {SRC}. Download PlantVillage into data/raw/plantvillage/ first."
        )

    class_dirs = [p for p in SRC.iterdir() if p.is_dir()]
    if not class_dirs:
        # Some Kaggle zips nest one extra folder
        nested = list(SRC.glob("*/*"))
        class_dirs = [p for p in nested if p.is_dir()]

    for class_dir in class_dirs:
        images = [
            f
            for f in class_dir.iterdir()
            if f.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
        ]
        random.seed(42)
        random.shuffle(images)
        n = len(images)
        if n == 0:
            continue
        cuts = {
            "train": images[: int(n * 0.8)],
            "val": images[int(n * 0.8) : int(n * 0.9)],
            "test": images[int(n * 0.9) :],
        }
        for split, files in cuts.items():
            dest = OUT / split / class_dir.name
            dest.mkdir(parents=True, exist_ok=True)
            for f in files:
                shutil.copy2(f, dest / f.name)

    print("Done. Classes:", len(class_dirs), "→", OUT)


if __name__ == "__main__":
    main()
