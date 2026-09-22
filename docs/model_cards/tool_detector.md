# Farm tool detector (YOLOv8n TFLite)

| Field | Value |
|-------|-------|
| Status | **Not trained yet** — scaffold only (Sprint 4) |
| Architecture | YOLOv8n, imgsz 320, INT8 TFLite |
| Train script | `ml/tool_detector/train_yolo.py` |
| Export | `ml/tool_detector/export_tflite.py` |
| Intended asset | `mobile/assets/models/vision/tool_detector_int8.tflite` |
| Data | Custom / Roboflow (≥300 images/class recommended) |
| License note | Ultralytics YOLOv8 is AGPL-3.0 — confirm distribution model with the team |

Fill mAP / per-class AP after first validation run.
