"""Build mobile/assets/models/kb/bn_knowledge_base.json from CSV + FAQ seed."""
from __future__ import annotations

import csv
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
CSV_PATH = ROOT / "disease_treatment_bn.csv"
OUT_ML = ROOT.parent / "artifacts" / "v1_2026-09-22" / "bn_knowledge_base.json"
OUT_MOBILE = (
    ROOT.parent.parent
    / "mobile"
    / "assets"
    / "models"
    / "kb"
    / "bn_knowledge_base.json"
)

TOOLS = [
    {
        "id": "sickle",
        "toolNameBn": "কাস্তে",
        "toolNameEn": "Sickle",
        "usageBn": "ধান বা গম কাটার জন্য ব্যবহৃত হাতিয়ার।",
    },
    {
        "id": "hoe",
        "toolNameBn": "কোদাল",
        "toolNameEn": "Hoe",
        "usageBn": "মাটি আলগা করা ও আগাছা পরিষ্কারের জন্য ব্যবহৃত।",
    },
    {
        "id": "spade",
        "toolNameBn": "কোদাল/বেলচা",
        "toolNameEn": "Spade",
        "usageBn": "মাটি খোঁড়া ও স্থানান্তরের জন্য ব্যবহৃত।",
    },
    {
        "id": "sprayer",
        "toolNameBn": "স্প্রেয়ার",
        "toolNameEn": "Sprayer",
        "usageBn": "কীটনাশক বা সার দ্রবণ স্প্রে করার জন্য ব্যবহৃত।",
    },
]

FAQ = [
    {
        "intent": "greeting",
        "patternsBn": ["আসসালামু আলাইকুম", "হ্যালো", "কেমন আছেন", "নমস্কার"],
        "responseBn": "আসসালামু আলাইকুম! আমি আপনার ফসলের সমস্যা নিয়ে সাহায্য করতে পারি। ছবি তুলুন বা বলুন কী সমস্যা।",
    },
    {
        "intent": "how_to_scan",
        "patternsBn": ["কিভাবে ছবি তুলব", "রোগ কিভাবে দেখব", "স্ক্যান কিভাবে"],
        "responseBn": "ক্যামেরা আইকনে চাপ দিন, আক্রান্ত পাতার একটি স্পষ্ট ছবি তুলুন।",
    },
    {
        "intent": "offline_help",
        "patternsBn": ["অফলাইনে কাজ করে", "ইন্টারনেট ছাড়া"],
        "responseBn": "হ্যাঁ, অফলাইনেও রোগ ও হাতিয়ার চিনতে এবং বাংলায় উত্তর দিতে পারি।",
    },
]


def main() -> None:
    diseases = []
    with CSV_PATH.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            diseases.append(
                {
                    "id": row["id"].strip(),
                    "diseaseNameBn": row["diseaseNameBn"].strip(),
                    "diseaseNameEn": row["diseaseNameEn"].strip(),
                    "symptomsBn": row["symptomsBn"].strip(),
                    "treatmentBn": row["treatmentBn"].strip(),
                    "preventionBn": row["preventionBn"].strip(),
                    "severity": row.get("severity", "moderate").strip(),
                }
            )

    kb = {"diseases": diseases, "tools": TOOLS, "faq": FAQ}
    text = json.dumps(kb, ensure_ascii=False, indent=2)
    OUT_ML.parent.mkdir(parents=True, exist_ok=True)
    OUT_ML.write_text(text + "\n", encoding="utf-8")
    OUT_MOBILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_MOBILE.write_text(text + "\n", encoding="utf-8")
    print("Wrote", OUT_ML)
    print("Wrote", OUT_MOBILE)


if __name__ == "__main__":
    main()
