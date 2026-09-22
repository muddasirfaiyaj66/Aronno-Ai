"""Transfer-learn MobileNetV3-Small on processed PlantVillage splits."""
from __future__ import annotations

import pathlib

import tensorflow as tf
import yaml

ROOT = pathlib.Path(__file__).resolve().parent
CFG = yaml.safe_load((ROOT / "config.yaml").read_text(encoding="utf-8"))

IMG_SIZE = tuple(CFG["img_size"])
BATCH = CFG["batch_size"]
DATA_DIR = (ROOT / CFG["data_dir"]).resolve()
ART = (ROOT / CFG["artifacts_dir"]).resolve()
ART.mkdir(parents=True, exist_ok=True)


def main() -> None:
    train_ds = tf.keras.utils.image_dataset_from_directory(
        str(DATA_DIR / "train"), image_size=IMG_SIZE, batch_size=BATCH
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        str(DATA_DIR / "val"), image_size=IMG_SIZE, batch_size=BATCH
    )
    class_names = train_ds.class_names
    num_classes = len(class_names)

    autotune = tf.data.AUTOTUNE
    train_ds = train_ds.cache().shuffle(1000).prefetch(autotune)
    val_ds = val_ds.cache().prefetch(autotune)

    augment = tf.keras.Sequential(
        [
            tf.keras.layers.RandomFlip("horizontal"),
            tf.keras.layers.RandomRotation(0.15),
            tf.keras.layers.RandomZoom(0.15),
            tf.keras.layers.RandomBrightness(0.2),
        ]
    )

    base = tf.keras.applications.MobileNetV3Small(
        input_shape=IMG_SIZE + (3,),
        include_top=False,
        weights="imagenet",
        pooling="avg",
    )
    base.trainable = False

    inputs = tf.keras.Input(shape=IMG_SIZE + (3,))
    x = augment(inputs)
    x = tf.keras.applications.mobilenet_v3.preprocess_input(x)
    x = base(x, training=False)
    x = tf.keras.layers.Dropout(CFG["dropout"])(x)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax")(x)
    model = tf.keras.Model(inputs, outputs)

    model.compile(
        optimizer=tf.keras.optimizers.Adam(CFG["learning_rate_phase1"]),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    callbacks = [
        tf.keras.callbacks.EarlyStopping(patience=4, restore_best_weights=True)
    ]
    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=CFG["epochs_phase1"],
        callbacks=callbacks,
    )

    base.trainable = True
    for layer in base.layers[:-30]:
        layer.trainable = False
    model.compile(
        optimizer=tf.keras.optimizers.Adam(CFG["learning_rate_phase2"]),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=CFG["epochs_phase2"],
        callbacks=callbacks,
    )

    saved = ART / "disease_classifier_saved"
    model.save(saved)
    (ART / "class_names.txt").write_text("\n".join(class_names), encoding="utf-8")
    print("Saved:", saved)


if __name__ == "__main__":
    main()
