# KU-PAS API

See ../README.md for the tested combined local setup and ../next-task.md for
status. Run `uvicorn main:app --host 127.0.0.1 --port 8000` in this directory.
`SEMANTIC_ENABLED=true` enables SBERT; false enables catalog/keyword/planning
without model loading. `/health`, `/metadata`, `/docs` and `/openapi.json` expose
status, source metadata and the complete API contract.

Install requirements.txt for the core API, requirements-ai.txt for semantic
search and requirements-dev.txt for tests. Local state is kept in `.local/`
and excluded from Git. Run `pytest -q` and `ruff check .` here.

Course schema: code, bilingual names/descriptions, nullable credits/faculty/
campus/department/prerequisites/period, and sections with stable IDs and complete
HH:MM day slots. `contracts/` contains generated JSON schemas.

Examples:

- `GET /keyword-search?q=01001241-64&top_n=20&page=1`
- `GET /search?q=computer%20programming&min_similarity=0.2`
- `POST /search` with `{"query":"เรียนเขียนโปรแกรม","top_n":20}`
- `GET /courses?faculty=...&min_credits=1&max_credits=3&days=Mon&days=Wed&start_time=09:00&end_time=16:00`
- `GET /courses/01001241-64`
- `POST /timetable/validate` with `{"dataset_version":"<from /metadata>","items":[{"subject_code":"01001241-64","section_id":"338887"}]}`

Validation returns authoritative items, conflicts, course_count, total_credits,
credit_status and limits. Unknown/stale references are rejected. GET/PUT
`/timetable` requires a JWT and stores separate account plans. Conflicts block
saving. Auth routes are `/auth/register`, `/auth/login`, `/auth/me`, `/auth/logout`.
Errors use `{"error":{"code":"...","message":"..."}}`; validation errors include
field details without echoing supplied passwords.

The main runtime uses `catalog.py` with a content/model/text-order-derived NPY
cache and disallows pickle loading. `course_data.py` and `embedding_cache.py`
retain the earlier CSV-preparation task and its isolated legacy-cache tests;
that pickle helper is not imported by the running API. Legacy CSV preparation
requires an explicitly supplied source via `--source` in this combined package.
