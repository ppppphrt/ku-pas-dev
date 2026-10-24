# Local verification

Verification performed on the supplied Mac workspace with Python 3.12 and the
Node.js runtime bundled with Codex. This is local validation, not a student UAT
or production certification.

- Backend: 31 tests pass. Coverage includes preprocessing, source identity,
  search schemas, exact-code/name/Thai matching, pagination, filters, invalid
  inputs, offline semantic errors, GET/POST agreement with deterministic model
  fixtures, multi-day overlap, adjacent intervals, duplicate/missing sections,
  unknown credits, credit thresholds, account isolation, persistence and logout.
- Frontend: 7 tests pass with Vitest, React Testing Library and MSW. Tests exercise
  add/restore/conflict/remove/confirmed clear, blank search, filter URL/reset,
  retry and damaged storage recovery, plus overlap/credit helper boundaries.
- Frontend production build and lint pass. Backend Ruff checks pass.
- Actual SBERT model loaded and encoded the new catalog. A Thai query asking
  about computer programming returned real offered courses: `02204101-65`,
  `01205215-65`, `03603101-65` with similarity around 0.77/0.75/0.73. This is a
  smoke check, not a relevance benchmark or probability of correctness.
- Real browser test: `01001241-64`, section 400, Wednesday 09:00–12:00 added and
  displayed as one course / three credits, and survived refresh.
- Real browser test: `01001251-64`, section 1, with the same Wednesday hours was
  rejected by the conflict dialog; the original one-course plan was retained.
- The combined repository launcher was also run successfully. Live browser
  checks verified remove, add again, confirmed clear, and refresh after clear.
  Full device/assistive-technology verification is not claimed.

Data provenance, hashes, missing fields, invalid schedule record numbers and
counts are in backend/data/workbook-validation.json. Academic period remains
unknown in the source. No enrollment/student records are part of the app.
