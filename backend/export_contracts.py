import json
from pathlib import Path

from schemas import (
    Conflict,
    Course,
    Filters,
    SearchRequest,
    SearchResponse,
    Section,
    TimeSlot,
    TimetableItem,
    TimetableRequest,
    TimetableResponse,
)

if __name__ == "__main__":
    destination = Path(__file__).with_name("contracts")
    destination.mkdir(exist_ok=True)
    for schema in [
        Course,
        Section,
        TimeSlot,
        Filters,
        SearchRequest,
        SearchResponse,
        TimetableItem,
        TimetableRequest,
        TimetableResponse,
        Conflict,
    ]:
        (destination / f"{schema.__name__}.schema.json").write_text(
            json.dumps(schema.model_json_schema(), indent=2) + "\n"
        )
