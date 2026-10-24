import csv
import json
import tempfile
import unittest
from pathlib import Path

from course_data import FIELDS, normalize, prepare_courses, write_outputs


class CourseDataTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "source.csv"

    def write(self, rows, fields=FIELDS):
        with self.path.open("w", encoding="utf-8-sig", newline="") as target:
            writer = csv.DictWriter(target, fieldnames=fields)
            writer.writeheader()
            writer.writerows(rows)

    def row(self, code="00123456-61", name="Course", description="Description"):
        return dict(zip(FIELDS, (code, "วิชา", name, "", description), strict=True))

    def test_duplicates_normalized_but_codes_and_conflicts_preserved(self):
        a = self.row()
        duplicate = dict(a, subject_name_en=" Course \n ")
        conflict = self.row(description="Different description")
        revision = self.row(code="00123456-62")
        self.write([a, duplicate, conflict, revision])
        courses, report = prepare_courses(self.path)
        self.assertEqual(courses, [a, conflict, revision])
        self.assertEqual(report["duplicates_removed"], 1)
        self.assertEqual(report["unique_full_course_codes"], 2)
        self.assertEqual(report["unique_base_codes_exploratory"], 1)
        self.assertEqual(len(report["conflicting_codes"][a["subject_code"]]), 2)

    def test_missing_code_or_all_text_rejected_but_partial_text_valid(self):
        self.write(
            [
                dict.fromkeys(FIELDS, ""),
                self.row(code=""),
                dict.fromkeys(FIELDS, "") | {"subject_code": "0001"},
                self.row(name="", description=""),
            ]
        )
        courses, report = prepare_courses(self.path)
        self.assertEqual(len(courses), 1)
        self.assertEqual(report["rejected_rows"], 3)
        self.assertEqual(report["missing_values_in_source"]["subject_code"], 2)

    def test_required_columns(self):
        self.write([], fields=("subject_code",))
        with self.assertRaisesRegex(ValueError, "missing columns"):
            prepare_courses(self.path)

    def test_empty_input(self):
        self.write([])
        courses, report = prepare_courses(self.path)
        self.assertEqual(courses, [])
        self.assertEqual(report["unique_full_course_codes"], 0)

    def test_version_tracks_content_order_and_is_repeatable(self):
        self.write([self.row(), self.row(code="002")])
        first = prepare_courses(self.path)[1]["dataset_version"]
        self.assertEqual(first, prepare_courses(self.path)[1]["dataset_version"])
        self.write([self.row(code="002"), self.row()])
        self.assertNotEqual(first, prepare_courses(self.path)[1]["dataset_version"])
        self.write([self.row(description="Changed"), self.row(code="002")])
        self.assertNotEqual(first, prepare_courses(self.path)[1]["dataset_version"])

    def test_unicode_and_output_roundtrip_original_untouched(self):
        self.assertEqual(normalize(" Cafe\u0301\tวิชา\n "), "Café วิชา")
        self.write([self.row(), self.row()])
        original = self.path.read_bytes()
        destination = Path(self.directory.name) / "generated"
        report = write_outputs(self.path, destination)
        self.assertEqual(self.path.read_bytes(), original)
        with (destination / "courses.cleaned.csv").open(encoding="utf-8", newline="") as source:
            self.assertEqual(list(csv.DictReader(source)), [self.row()])
        self.assertEqual(json.loads((destination / "validation.json").read_text()), report)
        self.assertFalse(report["srs_count_confirmed"])


if __name__ == "__main__":
    unittest.main()
