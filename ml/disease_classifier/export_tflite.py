"""Quantize + export crop disease classifier to INT8 TFLite."""
from __future__ import annotations

import pathlib

import tensorflow as tf
import yaml

ROOT = pathlib.Path(__file__).resolve().parent
CFG = yaml.safe_load((ROOT / "config.yaml").read_text(encoding="utf-8"))
ART = (ROOT / CFG["artifacts_dir"]).resolve()
DATA_DIR = (ROOT / CFG["data_dir"]).resolve()
IMG_SIZE = tuple(CFG["img_size"])


def main() -> None:
    model = tf.keras.models.load_model(ART / "disease_classifier.keras")

    def rep_data():
        # Model already includes mobilenet_v3.preprocess_input — feed raw 0–255 images.
        val_ds = tf.keras.utils.image_dataset_from_directory(
            str(DATA_DIR / "val"), image_size=IMG_SIZE, batch_size=1
        )
        for images, _ in val_ds.take(200):
            yield [images]

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = rep_data
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.uint8
    converter.inference_output_type = tf.uint8
    tflite_model = converter.convert()

    out = ART / "crop_disease_int8.tflite"
    out.write_bytes(tflite_model)
    print("Saved:", out, f"{out.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
