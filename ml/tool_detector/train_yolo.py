"""Train YOLOv8n on farm-tool annotations (Roboflow YOLO export)."""
from __future__ import annotations

import pathlib

from ultralytics import YOLO

ROOT = pathlib.Path(__file__).resolve().parent
DATA = ROOT / "data.yaml"


def main() -> None:
    model = YOLO("yolov8n.pt")
    model.train(
        data=str(DATA),
        epochs=100,
        imgsz=320,
        batch=16,
        patience=15,
        project=str(ROOT.parent / "artifacts" / "v1_2026-09-22"),
        name="tool_yolo",
    )
    model.val()


if __name__ == "__main__":
    main()
