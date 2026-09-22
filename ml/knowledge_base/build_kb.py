"""Build mobile/assets/models/kb/bn_knowledge_base.json from CSV + FAQ seed.

Disease `id` values MUST match PlantVillage / TFLite class_names.txt exactly
(diseaseModel.ts looks up diagnosisFromKbId(className)).

Tool `id` values MUST match YOLO class names in class-index order
(toolModel.ts uses kb.tools.map(t => t.id) as class index → id).
"""
from __future__ import annotations

import csv
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
CSV_PATH = ROOT / "disease_treatment_bn.csv"
CLASS_NAMES = (
    ROOT.parent / "artifacts" / "v1_2026-09-22" / "class_names.txt"
)
OUT_ML = ROOT.parent / "artifacts" / "v1_2026-09-22" / "bn_knowledge_base.json"
OUT_MOBILE = (
    ROOT.parent.parent
    / "mobile"
    / "assets"
    / "models"
    / "kb"
    / "bn_knowledge_base.json"
)

# Order = YOLO class index 0..7 from tools_yolo / tool_class_names.txt
TOOLS = [
    {
        "id": "ARROSOIR",
        "toolNameBn": "ঝাঁঝরি / পানি দেওয়ার ক্যান",
        "toolNameEn": "Watering can (Arrosoir)",
        "usageBn": "চারা ও সবজি গাছে নিয়ন্ত্রিতভাবে পানি দেওয়ার জন্য ব্যবহৃত।",
    },
    {
        "id": "BROUETTE",
        "toolNameBn": "ঠেলাগাড়ি",
        "toolNameEn": "Wheelbarrow (Brouette)",
        "usageBn": "মাটি, সার, ফসল বা আবর্জনা এক স্থান থেকে অন্য স্থানে নিয়ে যাওয়ার জন্য ব্যবহৃত।",
    },
    {
        "id": "HOUE",
        "toolNameBn": "কোদাল / নিদানি",
        "toolNameEn": "Hoe (Houe)",
        "usageBn": "মাটি আলগা করা, আগাছা পরিষ্কার ও সার মাটিতে মেশানোর জন্য ব্যবহৃত।",
    },
    {
        "id": "MACHETTE",
        "toolNameBn": "দা / কাটারি",
        "toolNameEn": "Machete (Machette)",
        "usageBn": "ঝোপঝাড় পরিষ্কার, ডালপালা কাটা ও হালকা ফসল কাটার কাজে ব্যবহৃত।",
    },
    {
        "id": "PELLE",
        "toolNameBn": "বেলচা",
        "toolNameEn": "Shovel / Spade (Pelle)",
        "usageBn": "মাটি খোঁড়া, স্থানান্তর ও গর্ত তৈরির জন্য ব্যবহৃত।",
    },
    {
        "id": "PULVERISATEUR",
        "toolNameBn": "স্প্রেয়ার",
        "toolNameEn": "Sprayer (Pulvérisateur)",
        "usageBn": "কীটনাশক, ছত্রাকনাশক বা পাতা সার দ্রবণ স্প্রে করার জন্য ব্যবহৃত।",
    },
    {
        "id": "RATEAU",
        "toolNameBn": "রেক / আঁচড়ানোর হাতিয়ার",
        "toolNameEn": "Rake (Rateau)",
        "usageBn": "মাটি সমান করা, আবর্জনা জড়ো করা ও বীজতলা তৈরির কাজে ব্যবহৃত।",
    },
    {
        "id": "SEAU",
        "toolNameBn": "বালতি",
        "toolNameEn": "Bucket (Seau)",
        "usageBn": "পানি, সার দ্রবণ বা ফসল বহন ও মেশানোর জন্য ব্যবহৃত।",
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

    if CLASS_NAMES.exists():
        expected = [
            ln.strip()
            for ln in CLASS_NAMES.read_text(encoding="utf-8").splitlines()
            if ln.strip()
        ]
        got = [d["id"] for d in diseases]
        missing = [c for c in expected if c not in got]
        extra = [c for c in got if c not in expected]
        if missing or extra:
            raise SystemExit(
                f"KB disease ids must match {CLASS_NAMES}.\n"
                f"Missing: {missing}\nExtra: {extra}"
            )
        # Keep TFLite index order
        by_id = {d["id"]: d for d in diseases}
        diseases = [by_id[c] for c in expected]

    kb = {"diseases": diseases, "tools": TOOLS, "faq": FAQ}
    text = json.dumps(kb, ensure_ascii=False, indent=2)
    OUT_ML.parent.mkdir(parents=True, exist_ok=True)
    OUT_ML.write_text(text + "\n", encoding="utf-8")
    OUT_MOBILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_MOBILE.write_text(text + "\n", encoding="utf-8")

    # Keep mobile class_names.json in sync with the same labels
    class_json = (
        ROOT.parent.parent
        / "mobile"
        / "assets"
        / "models"
        / "vision"
        / "class_names.json"
    )
    class_json.parent.mkdir(parents=True, exist_ok=True)
    class_json.write_text(
        json.dumps([d["id"] for d in diseases], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print("Wrote", OUT_ML)
    print("Wrote", OUT_MOBILE)
    print("Wrote", class_json)
    print(f"diseases={len(diseases)} tools={len(TOOLS)}")


if __name__ == "__main__":
    main()
