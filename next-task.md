# KU-PAS — local MVP status

Updated: October 24, 2026 (Asia/Bangkok).

The user's latest priority is completing the core local flow before expanding.
This file records local acceptance separately from the original backlog's PR,
merge, production, research and human-testing requirements.

## Implemented core

- [x] Keyword search by Thai/English names and normalized course codes; exact matches first.
- [x] Natural-language search with multilingual SBERT; GET/POST, threshold, pagination and dataset/model-aware cache.
- [x] Combined faculty, credit, available-day and time-window filters on both search modes.
- [x] Course details with real credits, faculties, campuses, sections and multiple meeting slots.
- [x] Section selection, add/remove, duplicate prevention and stable course colors.
- [x] Server-validated overlap checks across all meeting days; consecutive classes allowed.
- [x] Conflict dialog; overlapping section is blocked and the prior timetable stays intact.
- [x] Course/credit totals and configurable Normal/Warning/Exceeded thresholds.
- [x] Guest Local Storage persistence, restored through authoritative server validation.
- [x] Confirmation before clearing the timetable and recovery for stale/damaged saved data.
- [x] Shared schemas, API service, loading/error/empty states and retry controls.
- [x] Local account/password hashing/JWT/logout and separate per-user timetable storage.
- [x] Frontend/backend unit and integration checks; build and lint.
- [x] Local startup script and prepared catalog; no GitHub connection required to run.

## Final local acceptance

Browser-verified: real course-code search, section details, add, rendered meeting,
credit totals, refresh persistence, overlap rejection without changing the saved plan.
Live browser checks also verify remove and confirmed clear, including refresh
after clear. Automated UI tests verify filter/reset state, error retry and
corrupt-data recovery. See docs/VERIFICATION.md for scope.

## Still open / outside the current local MVP

- [ ] Confirm academic year/semester and curriculum counting rules from the source owner/SRS.
- [ ] Resolve 2,041 malformed schedule rows and missing schedules upstream.
- [ ] Obtain departments, rooms and prerequisites where available.
- [ ] Confirm authoritative program-specific credit rules.
- [ ] Create and human-review a relevance-labeled evaluation set and independent splits.
- [ ] Calculate research Precision@K/Recall@K/MRR and compare SBERT vs keyword on reviewed labels.
- [ ] Student acceptance testing and complete device/assistive-technology testing.
- [ ] Production account hardening, SSO decision, hosting, monitoring and production smoke tests.
- [ ] GitHub CI run, reviewer approval, branch protection and the original backlog's full merge Definition of Done.

The original backlog remains in docs/BACKLOG.original.md. The original AI notebooks
and historical claimed metrics have not been re-run or treated as validation of
this new catalog. No research result or human acceptance has been invented.
