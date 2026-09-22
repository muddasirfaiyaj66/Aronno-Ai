# Crop disease classifier (TFLite)

| Field | Value |
|-------|-------|
| Status | **Not trained yet** — scaffold only (Sprint 3) |
| Architecture | MobileNetV3-Small → INT8 TFLite |
| Train script | `ml/disease_classifier/train.py` |
| Export | `ml/disease_classifier/export_tflite.py` |
| Intended asset | `mobile/assets/models/vision/crop_disease_int8.tflite` |
| Datasets (planned) | PlantVillage (pretrain) → PlantDoc + BD Roboflow (fine-tune) |
| Known limits | Lab-photo accuracy ≠ field-phone accuracy; BD crops (jute, rice BLB) need local data |

Fill accuracy / confusion-matrix numbers after first `evaluate.py` run.
