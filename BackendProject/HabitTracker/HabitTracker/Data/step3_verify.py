"""
Verification script:
  1. Structural comparison between real.csv and real_en.csv
  2. Scan real_en.csv for any remaining Cyrillic/Ukrainian characters
Output written to verify_output.txt (UTF-8)
"""

import csv
import io
from pathlib import Path

DATA_DIR  = Path(__file__).parent
ORIG_PATH = DATA_DIR / "real.csv"
ENGL_PATH = DATA_DIR / "real_en.csv"
OUT_PATH  = DATA_DIR / "verify_output.txt"

CYRILLIC_RANGE = ("\u0400", "\u04ff")


def has_cyrillic(text: str) -> bool:
    return any(CYRILLIC_RANGE[0] <= ch <= CYRILLIC_RANGE[1] for ch in text)


def load_csv(path: Path) -> tuple[list[str], list[dict]]:
    with open(path, encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        headers = list(reader.fieldnames or [])
        rows = list(reader)
    return headers, rows


# ── Load both files ───────────────────────────────────────────────────────────
print("Loading files...")
orig_headers, orig_rows = load_csv(ORIG_PATH)
engl_headers, engl_rows = load_csv(ENGL_PATH)

with open(OUT_PATH, "w", encoding="utf-8") as out:

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 1 — STRUCTURAL COMPARISON
    # ═══════════════════════════════════════════════════════════════════════════
    out.write("=" * 70 + "\n")
    out.write("STRUCTURAL COMPARISON: real.csv  vs  real_en.csv\n")
    out.write("=" * 70 + "\n\n")

    # Row counts
    out.write(f"  Row count — real.csv    : {len(orig_rows):>7,}\n")
    out.write(f"  Row count — real_en.csv : {len(engl_rows):>7,}\n")
    rows_match = len(orig_rows) == len(engl_rows)
    out.write(f"  Row counts match        : {'✓ YES' if rows_match else '✗ NO  ← MISMATCH'}\n\n")

    # Column counts
    out.write(f"  Column count — real.csv    : {len(orig_headers)}\n")
    out.write(f"  Column count — real_en.csv : {len(engl_headers)}\n")
    cols_match = orig_headers == engl_headers
    out.write(f"  Column order/names match   : {'✓ YES' if cols_match else '✗ NO  ← MISMATCH'}\n\n")

    # Column-by-column diff
    if not cols_match:
        only_orig = [c for c in orig_headers if c not in engl_headers]
        only_engl = [c for c in engl_headers if c not in orig_headers]
        reordered  = orig_headers != engl_headers and set(orig_headers) == set(engl_headers)
        if only_orig:
            out.write(f"  Columns ONLY in real.csv    : {only_orig}\n")
        if only_engl:
            out.write(f"  Columns ONLY in real_en.csv : {only_engl}\n")
        if reordered:
            out.write("  Columns are same but ORDER differs.\n")
    else:
        out.write("  Columns (in order):\n")
        for i, col in enumerate(orig_headers, 1):
            out.write(f"    {i:>2}. {col}\n")

    # Spot-check: non-translated columns should be byte-for-byte identical
    SKIP_COLS = {"custom_name", "display_name", "tags"}  # these are intentionally changed
    mismatch_cols: list[str] = []
    for col in orig_headers:
        if col in SKIP_COLS:
            continue
        for idx, (o, e) in enumerate(zip(orig_rows, engl_rows)):
            if o.get(col) != e.get(col):
                mismatch_cols.append(f"{col} (first diff at row {idx+1})")
                break

    out.write("\n")
    if mismatch_cols:
        out.write("  ✗ Columns changed unexpectedly (should be identical):\n")
        for m in mismatch_cols:
            out.write(f"    - {m}\n")
    else:
        out.write("  ✓ All non-translated columns are byte-for-byte identical.\n")

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 2 — CYRILLIC / UKRAINIAN RESIDUE SCAN
    # ═══════════════════════════════════════════════════════════════════════════
    out.write("\n\n")
    out.write("=" * 70 + "\n")
    out.write("CYRILLIC RESIDUE SCAN: real_en.csv\n")
    out.write("=" * 70 + "\n\n")

    cyrillic_hits: list[tuple[int, str, str]] = []   # (row_num, col, value)

    for row_num, row in enumerate(engl_rows, 1):
        for col, val in row.items():
            if val and has_cyrillic(val):
                cyrillic_hits.append((row_num, col, val))

    if not cyrillic_hits:
        out.write("  ✓ No Cyrillic characters found anywhere in real_en.csv!\n")
    else:
        out.write(f"  ✗ Found {len(cyrillic_hits)} cell(s) with remaining Cyrillic text:\n\n")

        # Group by column for readability
        by_col: dict[str, list] = {}
        for row_num, col, val in cyrillic_hits:
            by_col.setdefault(col, []).append((row_num, val))

        for col, entries in sorted(by_col.items()):
            out.write(f"  Column: '{col}'  ({len(entries)} occurrence(s))\n")
            unique_vals = sorted(set(v for _, v in entries))
            out.write(f"    Unique remaining values:\n")
            for uv in unique_vals:
                # show first row number where it appears
                first_row = next(r for r, v in entries if v == uv)
                out.write(f"      row {first_row:>5}: {repr(uv)}\n")
            out.write("\n")

    out.write("\nVerification complete.\n")

print(f"Output written to: {OUT_PATH}")
