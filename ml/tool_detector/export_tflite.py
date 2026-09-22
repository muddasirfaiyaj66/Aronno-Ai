"""Export best YOLOv8 weights to INT8 TFLite for on-device detection.

Avoids Ultralytics' `format=tflite` auto-install (broken on Windows: NGC DNS +
outdated `ai-edge-litert<1.4` pin). Pipeline: best.pt → ONNX → onnx2tf → INT8 .tflite.
"""
from __future__ import annotations

import pathlib
import shutil
import sys

import numpy as np
import yaml
from ultralytics import YOLO

ROOT = pathlib.Path(__file__).resolve().parent
ART = ROOT.parent / "artifacts" / "v1_2026-09-22"
WEIGHTS = ART / "tool_yolo" / "weights" / "best.pt"
DATASET_ROOT = (ROOT.parent / "data" / "annotations" / "tools_yolo").resolve()
IMGSZ = 320


def _require_export_deps() -> None:
    missing: list[str] = []
    for mod in ("onnx", "onnxruntime", "onnxslim", "sng4onnx", "onnx2tf"):
        try:
            __import__(mod)
        except ImportError:
            missing.append(mod)
    if missing:
        raise SystemExit(
            "Missing export packages: "
            + ", ".join(missing)
            + "\nInstall (keeps TF 2.17): pip install onnx==1.16.2 onnxslim==0.1.65 "
            "onnxruntime==1.19.2 sng4onnx tf_keras==2.17.0 && "
            "pip install onnx2tf==1.26.3 --no-deps"
        )


def _data_yaml() -> pathlib.Path:
    cfg = yaml.safe_load((ROOT / "data.yaml").read_text(encoding="utf-8"))
    cfg["path"] = str(DATASET_ROOT).replace("\\", "/")
    out = ROOT / "_data_resolved.yaml"
    out.write_text(yaml.safe_dump(cfg, sort_keys=False), encoding="utf-8")
    return out


def _calibration_npy(out: pathlib.Path, n: int = 100) -> pathlib.Path:
    """Build BHWC float32 calibration images from the tool val set (0–255)."""
    import cv2

    img_dir = DATASET_ROOT / "valid" / "images"
    paths = sorted(img_dir.glob("*.*"))[:n]
    if not paths:
        raise SystemExit(f"No calibration images in {img_dir}")
    batch = []
    for p in paths:
        im = cv2.imread(str(p))
        if im is None:
            continue
        im = cv2.cvtColor(im, cv2.COLOR_BGR2RGB)
        im = cv2.resize(im, (IMGSZ, IMGSZ))
        batch.append(im.astype(np.float32))
    arr = np.stack(batch, axis=0)  # NHWC, 0–255
    np.save(out, arr)
    return out


def main() -> None:
    _require_export_deps()
    if not WEIGHTS.exists():
        raise SystemExit(f"Missing weights at {WEIGHTS}. Run train_yolo.py first.")

    import onnx2tf

    data_yaml = _data_yaml()
    model = YOLO(str(WEIGHTS))

    print("1/3 Exporting ONNX…")
    onnx_path = pathlib.Path(
        model.export(format="onnx", imgsz=IMGSZ, simplify=True, opset=12)
    )

    saved_dir = ART / "tool_yolo_saved_model"
    if saved_dir.exists():
        shutil.rmtree(saved_dir)
    saved_dir.mkdir(parents=True, exist_ok=True)

    calib = saved_dir / "calib_nhwc_float32.npy"
    _calibration_npy(calib)
    # onnx2tf expects: [[input_name, npy_path, mean, std]] for custom calibration
    np_data = [["images", str(calib), [[[[0, 0, 0]]]], [[[[255, 255, 255]]]]]]

    print("2/3 Converting ONNX → TF SavedModel + INT8 TFLite (onnx2tf)…")
    onnx2tf.convert(
        input_onnx_file_path=str(onnx_path),
        output_folder_path=str(saved_dir),
        not_use_onnxsim=True,
        verbosity="error",
        output_integer_quantized_tflite=True,
        quant_type="per-tensor",
        custom_input_op_name_np_data_path=np_data,
        enable_batchmatmul_unfold=True,
        output_signaturedefs=True,
    )

    print("3/3 Locating INT8 TFLite…")
    # onnx2tf names: best_full_integer_quant.tflite, best_integer_quant.tflite, …
    candidates = [
        p
        for p in saved_dir.rglob("*.tflite")
        if "integer_quant" in p.name.lower() and "int16_act" not in p.name.lower()
    ]
    # Prefer full_integer_quant (uint8 I/O) over integer_quant
    preferred = sorted(
        candidates,
        key=lambda p: (0 if "full_integer_quant" in p.name.lower() else 1, p.name),
    )
    if not preferred:
        raise SystemExit(f"No INT8 tflite under {saved_dir}")
    src = preferred[0]
    dest = ART / "tool_detector_int8.tflite"
    shutil.copy2(src, dest)

    # Keep class names next to the model for the mobile app
    names = yaml.safe_load(data_yaml.read_text(encoding="utf-8")).get("names", [])
    (ART / "tool_class_names.txt").write_text("\n".join(names), encoding="utf-8")

    print("Saved:", dest, f"({dest.stat().st_size / 1e6:.2f} MB) from {src.name}")
    print("Classes:", ART / "tool_class_names.txt")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
