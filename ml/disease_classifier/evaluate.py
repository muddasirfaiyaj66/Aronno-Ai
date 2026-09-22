"""Evaluate disease classifier on held-out test split; write metrics JSON."""
from __future__ import annotations

import json
import pathlib

import numpy as np
import tensorflow as tf
import yaml
from sklearn.metrics import classification_report, confusion_matrix

ROOT = pathlib.Path(__file__).resolve().parent
CFG = yaml.safe_load((ROOT / "config.yaml").read_text(encoding="utf-8"))
ART = (ROOT / CFG["artifacts_dir"]).resolve()
DATA_DIR = (ROOT / CFG["data_dir"]).resolve()
IMG_SIZE = tuple(CFG["img_size"])


def main() -> None:
    model = tf.keras.models.load_model(ART / "disease_classifier.keras")
    test_ds = tf.keras.utils.image_dataset_from_directory(
        str(DATA_DIR / "test"), image_size=IMG_SIZE, batch_size=32, shuffle=False
    )
    class_names = test_ds.class_names
    y_true: list[int] = []
    y_pred: list[int] = []
    for images, labels in test_ds:
        probs = model.predict(images, verbose=0)
        y_true.extend(labels.numpy().tolist())
        y_pred.extend(np.argmax(probs, axis=1).tolist())

    report = classification_report(
        y_true, y_pred, target_names=class_names, output_dict=True
    )
    cm = confusion_matrix(y_true, y_pred).tolist()
    out = {
        "accuracy": report.get("accuracy"),
        "classification_report": report,
        "confusion_matrix": cm,
        "class_names": class_names,
        "note": "Prefer a separate field-photo (PlantDoc / own) accuracy for product claims.",
    }
    path = ART / "disease_eval.json"
    path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print("Wrote", path, "accuracy=", out["accuracy"])


if __name__ == "__main__":
    main()
