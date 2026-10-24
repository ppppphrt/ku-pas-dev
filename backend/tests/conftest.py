import json

import pytest
from fastapi.testclient import TestClient

from main import create_app
from schemas import Course, Section, TimeSlot


@pytest.fixture
def client(tmp_path):
    # Synthetic fixtures exercise boundaries; these are never included in the app catalog.
    def course(code, name, credits, slots, faculty="Science", complete=True):
        section = Section(
            section_id="s" + code,
            section_code="1",
            faculty=faculty,
            time_slots=[TimeSlot(day=d, start=a, end=b) for d, a, b in slots],
            schedule_complete=complete,
        )
        return Course(
            subject_code=code,
            subject_name_en=name,
            subject_name_th="วิชา " + code,
            credits=credits,
            faculty=faculty,
            sections=[section],
        ).model_dump()

    courses = [
        course("001-61", "Programming", 3, [("Mon", "09:00", "10:00"), ("Wed", "09:00", "10:00")]),
        course("002-61", "Programming II", 3, [("Mon", "10:00", "11:00")]),
        course("003-61", "Calculus", 4, [("Wed", "09:30", "11:00")], faculty="Engineering"),
        course("004-61", "History", 2, [], complete=False),
        course("005-61", "Unknown credits", None, [("Tue", "09:00", "10:00")]),
    ]
    path = tmp_path / "catalog.json"
    path.write_text(
        json.dumps(
            {"metadata": {"dataset_version": "test-v1", "data_source": "test"}, "courses": courses}
        )
    )
    app = create_app(path, tmp_path / "accounts.sqlite", semantic=False)
    with TestClient(app) as instance:
        yield instance
