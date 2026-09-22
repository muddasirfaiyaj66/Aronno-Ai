"""Export best YOLOv8 weights to INT8 TFLite for on-device detection."""
from __future__ import annotations

import pathlib
import shutil

from ultralytics import YOLO

ROOT = pathlib.Path(__file__).resolve().parent
ART = ROOT.parent / "artifacts" / "v1_2026-09-22"
WEIGHTS = ART / "tool_yolo" / "weights" / "best.pt"
DATA = ROOT / "data.yaml"


def main() -> None:
    if not WEIGHTS.exists():
        raise SystemExit(f"Missing weights at {WEIGHTS}. Run train_yolo.py first.")
    model = YOLO(str(WEIGHTS))
    export_path = model.export(
        format="tflite", int8=True, imgsz=320, data=str(DATA)
    )
    # Ultralytics writes next to the weights; copy a stable name into artifacts
    src = pathlib.Path(export_path)
    dest = ART / "tool_detector_int8.tflite"
    if src.is_file():
        shutil.copy2(src, dest)
    else:
        # sometimes a directory with best_int8.tflite inside
        candidates = list(src.rglob("*int8*.tflite"))
        if not candidates:
            raise SystemExit(f"No INT8 tflite found under {src}")
        shutil.copy2(candidates[0], dest)
    print("Saved:", dest)


if __name__ == "__main__":
    main()
