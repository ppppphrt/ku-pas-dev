"""Validate a normalized registration/GE JSON export before installing it atomically."""

import argparse
import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile

from openpyxl import load_workbook

from catalog import Catalog
from chat import GEData, GEExport


def install(source, catalog_path, destination):
    catalog = Catalog(catalog_path)
    GEData(catalog, source)  # Strict schema, exact identities, snapshot version.
    payload = GEExport.model_validate_json(Path(source).read_text())
    return write_export(payload, destination)


def import_competencies(source, catalog_path, destination):
    catalog = Catalog(catalog_path)
    existing = GEExport.model_validate_json(Path(destination).read_text())
    GEData(catalog, destination)
    courses = {
        course.subject_code: course.model_dump()
        for course in existing.courses
        if course.status == "mock"
    }
    for course in courses.values():
        course.update(competencies=[], competency_weights={})

    book = load_workbook(source, data_only=True, read_only=True)
    seen, missing, outside = set(), [], []
    try:
        header, *rows = book.active.values
        columns = [
            header.index(name) for name in ("subject_code", "competency_ids", "comp_weights")
        ]
        for row in rows:
            if all(value is None for value in row):
                continue
            code, ids, weights = (str(row[i]).strip() for i in columns)
            if code in seen:
                raise ValueError(f"Duplicate workbook course: {code}")
            seen.add(code)
            ids = [int(value.strip()) for value in ids.split(",")]
            pairs = dict(zip(ids, map(int, weights.split(",")), strict=True))
            if (
                len(pairs) != len(ids)
                or any(not 1 <= key <= 9 or not 0 <= value <= 100 for key, value in pairs.items())
                or sum(pairs.values()) not in {0, 100}
            ):
                raise ValueError(f"Invalid competency weights for {code}")
            course = catalog.by_code.get(code)
            if course is None:
                missing.append(code)
            elif course["campus"] != "บางเขน":
                outside.append(code)
            else:
                courses[code] = {
                    "subject_code": code,
                    "status": "verified",
                    "competencies": sorted(
                        key for key, weight in pairs.items() if key <= 8 and weight
                    ),
                    "competency_weights": {
                        key: weight for key, weight in sorted(pairs.items()) if weight
                    },
                }
    finally:
        book.close()
    verified = {code for code, course in courses.items() if course["status"] == "verified"}
    payload = GEExport(
        dataset_version=existing.dataset_version,
        source_url="",
        source_name=Path(source).name,
        updated_at="",
        courses=[courses[code] for code in sorted(courses)],
        offerings=[
            offering
            for offering in existing.offerings
            if offering.subject_code in courses
            and (offering.status == "verified" or offering.subject_code not in verified)
        ],
    )
    write_export(payload, destination, compact_rows=True)
    print(f"Imported {len(verified)} Bangkhen courses; skipped {len(outside)} other campuses.")
    print("Codes absent from current catalog:", ", ".join(missing) or "none")


def write_export(payload, destination, *, compact_rows=False):
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=destination.parent, delete=False
        ) as stream:
            temporary = Path(stream.name)
            if compact_rows:
                fields = payload.model_dump(mode="json", exclude_defaults=True)
                fields.update(
                    courses=[
                        course.model_dump(mode="json", exclude_defaults=True)
                        for course in payload.courses
                    ]
                )
                lists = {name: fields.pop(name, []) for name in ("courses", "offerings")}
                header = json.dumps(fields, ensure_ascii=False, indent=2)[:-2]
                stream.write(header)
                for name, items in lists.items():
                    stream.write(f',\n  "{name}": [\n')
                    stream.write(
                        ",\n".join(
                            "    " + json.dumps(item, ensure_ascii=False, separators=(",", ":"))
                            for item in items
                        )
                    )
                    stream.write("\n  ]")
                stream.write("\n}\n")
            else:
                stream.write(payload.model_dump_json(indent=2) + "\n")
        os.replace(temporary, destination)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()
    return len(payload.courses), len(payload.offerings)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("--catalog", default=str(Path(__file__).parent / "data/catalog.json.gz"))
    parser.add_argument("--output", default=str(Path(__file__).parent / "data/gened.json"))
    parser.add_argument("--competency-workbook", action="store_true")
    args = parser.parse_args()
    if args.competency_workbook:
        import_competencies(args.source, args.catalog, args.output)
    else:
        print("Installed GE courses / offerings:", install(args.source, args.catalog, args.output))
