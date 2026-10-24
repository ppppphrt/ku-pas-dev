"""Conservative, reproducible course-master preparation (standard library only)."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path

FIELDS = (
    "subject_code",
    "subject_name_th",
    "subject_name_en",
    "subject_desc_th",
    "subject_desc_en",
)
TEXT_FIELDS = FIELDS[1:]
NORMALIZATION_VERSION = "nfc-whitespace-v1"
DEFAULT_SOURCE = Path(__file__).with_name("cur_m_cur_subject_2563_202605071501.csv")


def normalize(value: str | None) -> str:
    """Preserve Thai marks, English case, punctuation, and course-code suffixes."""
    return " ".join(unicodedata.normalize("NFC", value or "").split())


def prepare_courses(path: str | Path) -> tuple[list[dict[str, str]], dict]:
    """Remove identical normalized records; retain and report conflicting versions.

    A course code alone is deliberately not a deduplication key. Different
    curricula may share a base code, and conflicting descriptions need review.
    """
    path = Path(path)
    raw = path.read_bytes()
    with path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        missing = set(FIELDS) - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV is missing columns: {', '.join(sorted(missing))}")
        records = list(reader)

    seen = set()
    courses = []
    duplicates = []
    rejected = []
    groups = defaultdict(list)
    missing_values = Counter()
    for source_row, original in enumerate(records, start=2):
        if None in original:
            raise ValueError(f"CSV record {source_row} has unexpected extra fields")
        row = {field: normalize(original[field]) for field in FIELDS}
        for field in FIELDS:
            if not row[field]:
                missing_values[field] += 1
        if not row["subject_code"] or not any(row[field] for field in TEXT_FIELDS):
            rejected.append(
                {
                    "source_row": source_row,
                    "subject_code": row["subject_code"],
                    "reason": "missing code or all searchable text",
                }
            )
            continue
        key = tuple(row[field] for field in FIELDS)
        if key in seen:
            duplicates.append({"source_row": source_row, "subject_code": row["subject_code"]})
            continue
        seen.add(key)
        courses.append(row)
        groups[row["subject_code"]].append({"source_row": source_row, "record": row})

    # Ordered data hash: changes in row order also invalidate aligned embeddings.
    content = json.dumps(courses, ensure_ascii=False, separators=(",", ":")).encode()
    dataset_hash = hashlib.sha256(content).hexdigest()
    unique_codes = len(groups)
    conflicts = {code: variants for code, variants in sorted(groups.items()) if len(variants) > 1}
    report = {
        "dataset_version": f"{NORMALIZATION_VERSION}:{dataset_hash}",
        "updated_at": datetime.now(UTC).isoformat(),
        "source_file": path.name,
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "normalization_version": NORMALIZATION_VERSION,
        "source_rows": len(records),
        "prepared_rows": len(courses),
        "duplicates_removed": len(duplicates),
        "rejected_rows": len(rejected),
        "unique_full_course_codes": unique_codes,
        "unique_base_codes_exploratory": len({re.sub(r"-\d+$", "", code) for code in groups}),
        "srs_expected_courses": 12456,
        "difference_from_srs_full_codes": unique_codes - 12456,
        "srs_count_confirmed": False,
        "srs_note": "12,456 is quoted from the backlog; the SRS and its counting rules were not supplied.",
        "missing_values_in_source": {field: missing_values[field] for field in FIELDS},
        "missing_schedule_columns": [
            "credits",
            "faculty",
            "department",
            "section_id",
            "day",
            "start_time",
            "end_time",
        ],
        "duplicate_rows": duplicates,
        "rejections": rejected,
        "conflicting_codes": conflicts,
        "policy": "Deduplicate all five normalized fields. Preserve code suffixes and differing records; no inferred schedules or credits.",
    }
    return courses, report


def write_outputs(source: str | Path, destination: str | Path) -> dict:
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    courses, report = prepare_courses(source)
    with (destination / "courses.cleaned.csv").open("w", encoding="utf-8", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(courses)
    (destination / "validation.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (destination / "VALIDATION.md").write_text(
        "# Course data validation\n\n"
        f"Source: `{report['source_file']}`\n\n"
        f"- Source rows: {report['source_rows']:,}\n"
        f"- Prepared rows: {report['prepared_rows']:,}\n"
        f"- Duplicate rows removed: {report['duplicates_removed']:,}\n"
        f"- Rejected rows: {report['rejected_rows']:,}\n"
        f"- Unique full course codes: {report['unique_full_course_codes']:,}\n"
        f"- Base codes (exploratory only): {report['unique_base_codes_exploratory']:,}\n"
        f"- Codes with conflicting records: {len(report['conflicting_codes'])}\n\n"
        "## Counting limits\n\n"
        "The backlog estimates 56,260 input rows and quotes 12,456 courses from an SRS. "
        "This supplied export does not establish either number. The SRS was not supplied. "
        "Course codes include suffixes; their meaning and a rule for selecting the active "
        "curriculum must be confirmed before reducing the catalog to base codes. "
        "No rows were discarded simply to reach the expected count.\n\n"
        "## Preparation policy\n\n"
        "Apply Unicode NFC normalization, trim text, and collapse whitespace. Preserve "
        "Thai marks, English case, punctuation, leading zeros, and code suffixes. "
        "Remove only records identical across all five normalized fields. "
        "Reject missing codes and records without any searchable text. "
        "Keep differing records under the same code for review; details and source record "
        "numbers (header is record 1) are in `validation.json`. "
        "Do not remove boilerplate without an approved rule.\n\n"
        "## Missing data\n\n"
        "This export contains only codes, names, and descriptions. Credits, faculty, "
        "department, sections, days, and start/end times need an authoritative semester "
        "dataset before the timetable MVP can use real data.\n\n"
        "## Reproducibility\n\n"
        "The original export is preserved. `validation.json` records a source SHA-256, "
        "a version derived from ordered prepared records and the normalization policy, "
        "and the report generation time in UTC (`updated_at`, not a source modification "
        "date). Re-running preparation produces the same cleaned data and version.\n",
        encoding="utf-8",
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).with_name("data"))
    args = parser.parse_args()
    report = write_outputs(args.source, args.output_dir)
    print(
        json.dumps(
            {
                key: report[key]
                for key in (
                    "source_rows",
                    "prepared_rows",
                    "duplicates_removed",
                    "unique_full_course_codes",
                )
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
