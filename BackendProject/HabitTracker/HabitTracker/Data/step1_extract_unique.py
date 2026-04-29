"""
Step 1: Extract all unique Ukrainian text values from real.csv
Columns examined: custom_name, display_name, tags
Output is written to step1_output.txt in UTF-8 so Cyrillic is preserved.
"""

import csv
from pathlib import Path

CSV_PATH = Path(__file__).parent / "real.csv"
OUT_PATH = Path(__file__).parent / "step1_output.txt"
TARGET_COLUMNS = ["custom_name", "display_name", "tags"]

unique_plain = {col: set() for col in TARGET_COLUMNS}
unique_tags: set[str] = set()

with open(CSV_PATH, encoding="utf-8-sig", newline="") as fh:
    reader = csv.DictReader(fh)
    headers = reader.fieldnames or []

    present = [c for c in TARGET_COLUMNS if c in headers]
    missing = [c for c in TARGET_COLUMNS if c not in headers]

    for row in reader:
        for col in present:
            val = (row.get(col) or "").strip()
            if not val:
                continue
            if col == "tags":
                for tag in val.split(","):
                    tag = tag.strip()
                    if tag:
                        unique_tags.add(tag)
            else:
                unique_plain[col].add(val)


def is_likely_ukrainian(text: str) -> bool:
    return any("\u0400" <= ch <= "\u04ff" for ch in text)


with open(OUT_PATH, "w", encoding="utf-8") as out:
    out.write(f"CSV columns found: {headers}\n\n")
    if missing:
        out.write(f"WARNING – columns not found (skipped): {missing}\n\n")

    # --- custom_name ---
    out.write("=" * 60 + "\n")
    out.write("UNIQUE VALUES — custom_name\n")
    out.write("=" * 60 + "\n")
    cn_all = sorted(unique_plain["custom_name"])
    cn_uk  = [v for v in cn_all if is_likely_ukrainian(v)]
    cn_en  = [v for v in cn_all if not is_likely_ukrainian(v)]
    out.write(f"  Total: {len(cn_all)}  |  Ukrainian: {len(cn_uk)}  |  Other: {len(cn_en)}\n\n")
    out.write("  [Ukrainian / Cyrillic]\n")
    for v in cn_uk:
        out.write(f"    {repr(v)}\n")
    if cn_en:
        out.write("\n  [Non-Cyrillic]\n")
        for v in cn_en:
            out.write(f"    {repr(v)}\n")

    # --- display_name ---
    out.write("\n" + "=" * 60 + "\n")
    out.write("UNIQUE VALUES — display_name\n")
    out.write("=" * 60 + "\n")
    dn_all = sorted(unique_plain["display_name"])
    dn_uk  = [v for v in dn_all if is_likely_ukrainian(v)]
    dn_en  = [v for v in dn_all if not is_likely_ukrainian(v)]
    out.write(f"  Total: {len(dn_all)}  |  Ukrainian: {len(dn_uk)}  |  Other: {len(dn_en)}\n\n")
    out.write("  [Ukrainian / Cyrillic]\n")
    for v in dn_uk:
        out.write(f"    {repr(v)}\n")
    if dn_en:
        out.write("\n  [Non-Cyrillic]\n")
        for v in dn_en:
            out.write(f"    {repr(v)}\n")

    # --- tags ---
    out.write("\n" + "=" * 60 + "\n")
    out.write("UNIQUE TAG VALUES — tags (split by comma)\n")
    out.write("=" * 60 + "\n")
    tags_sorted = sorted(unique_tags)
    tags_uk = [t for t in tags_sorted if is_likely_ukrainian(t)]
    tags_en = [t for t in tags_sorted if not is_likely_ukrainian(t)]
    out.write(f"  Total unique tags: {len(tags_sorted)}  |  Ukrainian: {len(tags_uk)}  |  Other: {len(tags_en)}\n\n")
    out.write("  [Ukrainian / Cyrillic]\n")
    for t in tags_uk:
        out.write(f"    {repr(t)}\n")
    if tags_en:
        out.write("\n  [Non-Cyrillic]\n")
        for t in tags_en:
            out.write(f"    {repr(t)}\n")

    out.write("\nDone.\n")

print(f"Output written to: {OUT_PATH}")
