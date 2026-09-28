# Aronno ML — Offline Vision & Knowledge Base

Training code for on-device crop-disease classification and farm-tool detection.
Models export to TFLite (INT8) and ship into `mobile/assets/models/vision/`.
Gemini remains the online high-accuracy path; these are the **offline fallback**.

Shopping, SSLCommerz, and the website are documented in the repository [README](../README.md), not in this training guide.

## Layout

| Path | Purpose |
|------|---------|
| `data/raw/` | Untouched downloads (gitignored) |
| `data/processed/` | Train/val/test splits |
| `data/annotations/` | Roboflow / CVAT / YOLO exports |
| `notebooks/` | EDA on Colab or local |
| `disease_classifier/` | MobileNetV3-Small transfer learning → TFLite |
| `tool_detector/` | YOLOv8n train → TFLite |
| `knowledge_base/` | Agronomist CSV → `bn_knowledge_base.json` (LLM grounding / RAG-lite, not canned chat) |
| `artifacts/` | Versioned `.tflite` / SavedModel outputs |

## Quick start

```bash
cd ml
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
```

### Crop disease (PlantVillage)

1. Download [PlantVillage](https://www.kaggle.com/datasets/emmarex/plantdisease) into `data/raw/plantvillage/`.
2. `python disease_classifier/prepare_data.py`
3. `python disease_classifier/train.py`
4. `python disease_classifier/export_tflite.py`
5. Copy `artifacts/.../crop_disease_int8.tflite` + `class_names.txt` into `mobile/assets/models/vision/`.

### Farm tools (YOLO)

1. Annotate on [Roboflow](https://roboflow.com) (free tier) → export YOLOv8 → `data/annotations/tools_yolo/`.
2. Edit `tool_detector/data.yaml`.
3. `python tool_detector/train_yolo.py`
4. `python tool_detector/export_tflite.py`

### Knowledge base

1. Edit `knowledge_base/disease_treatment_bn.csv` (agronomist-reviewed).
2. `python knowledge_base/build_kb.py`
3. Copy output JSON to `mobile/assets/models/kb/bn_knowledge_base.json`.

## Accounts (free)

- **Kaggle** — PlantVillage download
- **Roboflow** — tool image annotation / BD disease datasets
- **Google Colab** — free T4 GPU for training if you have no local GPU

## License notes

- PlantVillage: check dataset license on Kaggle before redistribution.
- Ultralytics YOLOv8: AGPL-3.0 — confirm with your team before commercial distribution, or use EfficientDet-Lite (Apache).
