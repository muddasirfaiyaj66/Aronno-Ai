"""Train YOLOv8n on farm-tool annotations (Roboflow YOLO export)."""
from __future__ import annotations

import pathlib
import sys

import yaml
from ultralytics import YOLO

ROOT = pathlib.Path(__file__).resolve().parent
DATA = ROOT / "data.yaml"
DATASET_ROOT = (ROOT.parent / "data" / "annotations" / "tools_yolo").resolve()

# Windows DataLoader workers re-spawn processes that each reload CUDA DLLs and
# hit WinError 1455 (paging file too small). Keep workers=0 on Win32.
WORKERS = 0 if sys.platform == "win32" else 8


def _data_yaml_with_abs_path() -> pathlib.Path:
    """Rewrite `path` to an absolute dataset root so Ultralytics settings.json
    datasets_dir cannot redirect relative paths to another project."""
    cfg = yaml.safe_load(DATA.read_text(encoding="utf-8"))
    if not (DATASET_ROOT / "train" / "images").is_dir():
        raise FileNotFoundError(
            f"Missing tool images at {DATASET_ROOT / 'train' / 'images'}. "
            "Export a Roboflow YOLO dataset into ml/data/annotations/tools_yolo/."
        )
    cfg["path"] = str(DATASET_ROOT).replace("\\", "/")
    out = ROOT / "_data_resolved.yaml"
    out.write_text(yaml.safe_dump(cfg, sort_keys=False), encoding="utf-8")
    return out


def main() -> None:
    data_yaml = _data_yaml_with_abs_path()
    model = YOLO("yolov8n.pt")
    model.train(
        data=str(data_yaml),
        epochs=100,
        imgsz=320,
        batch=16,
        patience=15,
        workers=WORKERS,
        exist_ok=True,
        project=str(ROOT.parent / "artifacts" / "v1_2026-09-22"),
        name="tool_yolo",
    )
    model.val(workers=WORKERS)


if __name__ == "__main__":
    main()
