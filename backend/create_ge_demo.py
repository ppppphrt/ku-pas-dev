"""Create explicitly synthetic GE/registration overlay; does not change the KU catalog."""

import argparse
import gzip
import json
from pathlib import Path

from chat import GROUPS, GEExport

# Curated demo identifiers only. These assignments are NOT official equivalencies.
DEMO = {
    "01001317": (3, [1, 2, 4, 5, 7, 8]),
    "01004101": (2, [1, 2, 3, 4]),
    "01005101": (2, [1, 3, 4, 8]),
    "01007101": (4, [1, 2, 4, 7]),
    "01009102": (3, [1, 2, 4, 8]),
    "01015202": (3, [1, 2, 4, 5, 6, 8]),
    "01051121": (1, [1, 2, 4]),
    "01101101": (2, [4]),
    "01131111": (2, [3, 4, 6]),
    "01173151": (1, [1, 2, 4, 6, 7, 8]),
    "01174123": (1, [1, 2, 4, 7]),
    "01174231": (1, [2, 4, 7]),
    "01175111": (1, [4, 6, 7]),
    "01175112": (1, [2, 4, 6, 7]),
    "01175114": (1, [2, 4, 6, 7]),
    "01175117": (1, [2, 4, 6, 7]),
    "01355101": (0, [1, 5, 7]),
    "01355102": (0, [1, 5, 7]),
    "01355103": (0, [1, 5, 7]),
    "01355104": (0, [1, 5, 7]),
    "01999021": (0, [1, 4, 7]),
    "01999032": (3, [4, 8]),
    "01999033": (4, [4, 5, 7]),
    "01999111": (3, [4, 6, 8]),
}


def generate(catalog_path, output):
    with gzip.open(catalog_path, "rt") as stream:
        catalog = json.load(stream)
    courses, offerings = [], []
    for course in catalog["courses"]:
        code = course["subject_code"]
        if code[:8] not in DEMO or course["campus"] != "บางเขน":
            continue
        group, competencies = DEMO[code[:8]]
        courses.append(
            {
                "subject_code": code,
                "groups": [GROUPS[group]],
                "competencies": competencies,
                "status": "mock",
            }
        )
        for section in course["sections"]:
            if section["campus"] != "บางเขน":
                continue
            # Synthetic examples include open, full, and not-offered states. Never infer
            # real program restrictions from a section number.
            seed = int(section["section_id"])
            offerings.append(
                {
                    "subject_code": code,
                    "section_id": section["section_id"],
                    "offered": seed % 11 != 0,
                    "remaining": min(seed % 30, section["total_seat"])
                    if section["total_seat"] is not None
                    else seed % 30,
                    "programs": ["regular" if seed % 2 else "special"],
                    "status": "mock",
                    "eligibility_note": "จำลองเฉพาะประเภทภาคเรียน ยังขาดหลักสูตร วิชาบังคับก่อน ชั้นปี และโควตาจริง",
                }
            )
    payload = GEExport(
        dataset_version=catalog["metadata"]["dataset_version"],
        source_url="demo://gened-regis",
        updated_at="2026-10-24",
        courses=courses,
        offerings=offerings,
    )
    Path(output).write_text(json.dumps(payload.model_dump(), ensure_ascii=False, indent=2) + "\n")
    print(f"Demo only: {len(courses)} course classifications, {len(offerings)} offerings")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", default=str(Path(__file__).parent / "data/catalog.json.gz"))
    parser.add_argument("--output", default=str(Path(__file__).parent / "data/gened.json"))
    args = parser.parse_args()
    generate(args.catalog, args.output)
