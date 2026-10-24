"""Shared API contracts. Exported as JSON Schema by export_contracts.py."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Day = Literal["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TimeSlot(StrictModel):
    day: Day
    start: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    end: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    location: str | None = None

    @model_validator(mode="after")
    def ordered(self):
        if self.start >= self.end:
            raise ValueError("Time slots must end after they start within the same day.")
        return self


class Section(StrictModel):
    section_id: str
    section_code: str
    faculty: str | None = None
    campus: str | None = None
    time_slots: list[TimeSlot] = Field(default_factory=list)
    schedule_complete: bool = False
    schedule_note: str | None = None
    total_seat: int | None = None
    total_registered: int | None = None


class Course(StrictModel):
    subject_code: str
    subject_name_th: str = ""
    subject_name_en: str = ""
    subject_desc_th: str = ""
    subject_desc_en: str = ""
    credits: float | None = Field(default=None, ge=0, le=100)
    faculty: str | None = None
    campus: str | None = None
    department: str | None = None
    prerequisites: str | None = None
    academic_year: int | None = None
    semester: str | None = None
    sections: list[Section] = Field(default_factory=list)


class Filters(StrictModel):
    faculty: str | None = None
    min_credits: float | None = Field(default=None, ge=0, le=100)
    max_credits: float | None = Field(default=None, ge=0, le=100)
    days: list[Day] = Field(default_factory=list)
    start_time: str | None = Field(default=None, pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    end_time: str | None = Field(default=None, pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    offered_only: bool = False

    @model_validator(mode="after")
    def ranges(self):
        if (
            self.min_credits is not None
            and self.max_credits is not None
            and self.min_credits > self.max_credits
        ):
            raise ValueError("Minimum credits cannot exceed maximum credits.")
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValueError("Start time must be before end time.")
        return self


class SearchRequest(Filters):
    query: str = Field(min_length=1, max_length=1000)
    top_n: int = Field(default=20, ge=1, le=100)
    page: int = Field(default=1, ge=1)
    min_similarity: float = Field(default=0.2, ge=-1, le=1)

    @field_validator("query")
    @classmethod
    def nonempty(cls, value):
        if not value.strip():
            raise ValueError("Query must not be empty.")
        return value.strip()


class CourseResult(Course):
    rank: int
    similarity_score: float | None = None


class SearchResponse(StrictModel):
    query: str
    mode: Literal["keyword", "semantic"]
    results: list[CourseResult]
    total_returned: int
    total_results: int
    page: int
    page_size: int
    has_more: bool
    active_filters: Filters
    elapsed_ms: float
    dataset_version: str


class TimetableRef(StrictModel):
    subject_code: str
    section_id: str


class TimetableRequest(StrictModel):
    dataset_version: str
    items: list[TimetableRef] = Field(default_factory=list, max_length=100)


class TimetableItem(StrictModel):
    course: Course
    section: Section


class Conflict(StrictModel):
    first: TimetableRef
    second: TimetableRef
    day: Day
    start: str
    end: str


class TimetableResponse(StrictModel):
    dataset_version: str
    items: list[TimetableItem]
    conflicts: list[Conflict]
    course_count: int
    total_credits: float
    credit_status: Literal["Normal", "Warning", "Exceeded"]
    min_credits: float
    max_credits: float


class Credentials(StrictModel):
    username: str = Field(min_length=3, max_length=60, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=10, max_length=128)


class Registration(Credentials):
    email: str = Field(max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
