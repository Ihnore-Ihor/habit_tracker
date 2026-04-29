"""
Step 2 + 3: Translation dictionary + bulk replace → real_en.csv
"""

import csv
import re
from pathlib import Path

CSV_PATH  = Path(__file__).parent / "real.csv"
OUT_PATH  = Path(__file__).parent / "real_en.csv"

# ── Translation dictionary (Ukrainian → English) ─────────────────────────────

# Habit names (custom_name / display_name) — exact-match replacement
HABIT_DICT: dict[str, str] = {
    "Біг":                  "Running",
    "Вивчення мови":        "Language Learning",
    "Випити воду":          "Drink Water",
    "Вітаміни":             "Vitamins",
    "Енергетики":           "Energy Drinks",
    "Йога":                 "Yoga",
    "Кава після 16:00":     "Coffee After 4 PM",
    "Куріння":              "Smoking",
    "Медитація":            "Meditation",
    "Плавання":             "Swimming",
    "Прогулянка":           "Walk",
    "Скролінг перед сном":  "Scrolling Before Sleep",
    "Солодощі":             "Sweets",
    "Спортзал":             "Gym",
    "Фастфуд":              "Fast Food",
    "Читання":              "Reading",
}

# Tags — used for substring replacement inside comma-separated tag strings
TAG_DICT: dict[str, str] = {
    "активність":       "activity",
    "бадьорість":       "alertness",
    "баланс":           "balance",
    "басейн":           "pool",
    "безсоння":         "insomnia",
    "бургери":          "burgers",
    "вечір":            "evening",
    "витривалість":     "endurance",
    "вихідні":          "weekends",
    "вода":             "water",
    "втома":            "fatigue",
    "гнучкість":        "flexibility",
    "гідратація":       "hydration",
    "десерт":           "dessert",
    "дистанція":        "distance",
    "дисципліна":       "discipline",
    "дихання":          "breathing",
    "добавки":          "supplements",
    "дуолінго":         "duolingo",
    "екрани":           "screens",
    "енергія":          "energy",
    "залежність":       "addiction",
    "звичка":           "habit",
    "здоров'я":         "health",
    "знання":           "knowledge",
    "кава":             "coffee",
    "кардіо":           "cardio",
    "книга":            "book",
    "книги":            "books",
    "концентрація":     "concentration",
    "кофеїн":           "caffeine",
    "кроки":            "steps",
    "легкий":           "light",
    "лінь":             "laziness",
    "література":       "literature",
    "мова":             "language",
    "нагадування":      "reminder",
    "ніч":              "night",
    "освіта":           "education",
    "офіс":             "office",
    "парк":             "park",
    "пляшка":           "bottle",
    "початок":          "start",
    "природа":          "nature",
    "прогрес":          "progress",
    "пізно":            "late",
    "піца":             "pizza",
    "ранковий":         "morning (adj)",
    "ранок":            "morning",
    "регулярність":     "regularity",
    "релакс":           "relaxation",
    "робота":           "work",
    "робочий день":     "workday",
    "розвиток":         "development",
    "розслаблення":     "relaxation",
    "розтяжка":         "stretching",
    "рутина":           "routine",
    "саморозвиток":     "self-development",
    "свіже повітря":    "fresh air",
    "сила":             "strength",
    "силові":           "strength training",
    "солодке":          "sweets",
    "соцмережі":        "social media",
    "спокій":           "calm",
    "спорт":            "sport",
    "стимулятори":      "stimulants",
    "стрес":            "stress",
    "телефон":          "phone",
    "темп":             "pace",
    "техніка":          "technique",
    "тиша":             "silence",
    "тренування":       "workout",
    "тютюн":            "tobacco",
    "усвідомленість":   "mindfulness",
    "фастфуд":          "fast food",
    "фітнес":           "fitness",
    "ходьба":           "walking",
    "хімія":            "chemistry",
    "цигарки":          "cigarettes",
    "цукерки":          "candies",
    "цукор":            "sugar",
    "шкідлива їжа":     "junk food",
    "шоколад":          "chocolate",
    "щодня":            "daily",
    "імунітет":         "immunity",
    "іспанська":        "Spanish",
}


def translate_habit(value: str) -> str:
    """Exact-match translation for habit names."""
    return HABIT_DICT.get(value.strip(), value)


def translate_tags(value: str) -> str:
    """
    Translate each comma-separated tag individually.
    Sorts longest keys first to avoid partial-match collisions.
    """
    if not value:
        return value
    tags = [t.strip() for t in value.split(",")]
    translated = []
    for tag in tags:
        translated.append(TAG_DICT.get(tag, tag))
    return ", ".join(translated)


# ── Bulk replace ──────────────────────────────────────────────────────────────

HABIT_COLS = {"custom_name", "display_name"}
TAG_COLS   = {"tags"}

print(f"Reading {CSV_PATH} ...")

rows: list[dict] = []
with open(CSV_PATH, encoding="utf-8-sig", newline="") as fh:
    reader = csv.DictReader(fh)
    fieldnames = reader.fieldnames or []
    for row in reader:
        for col in HABIT_COLS:
            if col in row:
                row[col] = translate_habit(row[col])
        for col in TAG_COLS:
            if col in row:
                row[col] = translate_tags(row[col])
        rows.append(row)

print(f"Writing {OUT_PATH} ...")
with open(OUT_PATH, "w", encoding="utf-8", newline="") as fh:
    writer = csv.DictWriter(fh, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"Done! {len(rows):,} rows written to {OUT_PATH.name}")

# ── Spot-check: print first 5 translated rows (habit columns + tags) ──────────
print("\nSpot-check — first 5 rows (selected columns):")
check_cols = [c for c in ["custom_name", "display_name", "tags"] if c in fieldnames]
rows_sample = rows[:5]
header_line = " | ".join(f"{c:<30}" for c in check_cols)
print(header_line)
print("-" * len(header_line))
for r in rows_sample:
    print(" | ".join(f"{r.get(c,''):<30}" for c in check_cols))
