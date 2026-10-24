# KU-PAS - Remaining Task Backlog

Last updated: September 16, 2026  
Based on the latest reviewed versions of `KU-PAS-Frontend` and `KU-PAS-Backend`.

## Legend

- `[x]` Completed
- `[ ]` Not completed
- `P0` Critical task or blocker
- `P1` Core MVP task
- `P2` Post-MVP improvement
- Suggested ownership: **Phavida = Backend/Data/AI**, **Nicha = Frontend/UX**

## MVP Goal

The user must be able to:

1. Search using keywords or natural language.
2. Filter by faculty, credits, day, and time.
3. View course details and select a section.
4. Add or remove a section from the timetable.
5. Receive a warning when class times overlap.
6. View the total number of courses and credits.
7. Keep the timetable after refreshing the page.

---

# Epic 1: Data Foundation

## US 1.1 - Course Master Data

> As a student, I want accurate course information so that I can trust the search results.

- [x] Load course codes, Thai and English names, and descriptions.
- [x] Handle null values and build embedding text.
- [ ] `P0` Identify and remove duplicates from the approximately 56,260-row dataset. — **Phavida**
- [ ] `P0` Confirm the unique-course count against the 12,456 courses stated in the SRS. — **Phavida**
- [ ] Improve Thai and English text normalization. — **Phavida**
- [ ] Remove boilerplate text that does not improve search quality. — **Phavida**
- [ ] Add `dataset_version` and `updated_at`. — **Phavida**
- [ ] Produce a data-validation report. — **Phavida**

## US 1.2 - Course Section and Schedule Data

> As a student, I want section and schedule data so that I can build a valid timetable.

- [ ] `P0` Obtain the section dataset for the selected academic year and semester. — **Phavida**
- [ ] `P0` Add faculty and department fields. — **Phavida**
- [ ] `P0` Add course credits. — **Phavida**
- [ ] `P0` Add section IDs. — **Phavida**
- [ ] `P0` Add day, start time, and end time. — **Phavida**
- [ ] Add classroom/location and prerequisite data when available. — **Phavida**
- [ ] `P0` Join course master data with section data. — **Phavida**
- [ ] Support sections containing multiple time slots. — **Phavida**
- [ ] Validate missing and malformed schedule data. — **Phavida**

## US 1.3 - Shared Data Contract

> As a development team, we want one shared schema so that the Frontend and Backend integrate without repeated rework.

- [ ] `P0` Define the Course JSON schema. — **Both**
- [ ] `P0` Define the Section and Time Slot JSON schemas. — **Both**
- [ ] Define Search request and response formats. — **Both**
- [ ] Define filter parameters. — **Both**
- [ ] Define Timetable Item and Conflict response formats. — **Both**
- [ ] Add response examples to API documentation. — **Phavida**
- [ ] Create mock JSON for Frontend development. — **Nicha**

---

# Epic 2: Backend API and Search

## US 2.1 - Semantic Search

> As a student, I want to search using natural language so that I can discover relevant courses without knowing their exact names.

- [x] Use multilingual SBERT.
- [x] Generate and cache course embeddings.
- [x] Encode queries and calculate cosine similarity.
- [x] Return ranked Top-N results.
- [x] Support GET and POST `/search`.
- [ ] `P0` Validate the embedding cache using a dataset hash/version instead of row count only. — **Phavida**
- [ ] Add a minimum similarity threshold. — **Phavida**
- [ ] Add pagination or cursor-based loading. — **Phavida**
- [ ] Add response-time logging. — **Phavida**
- [ ] Handle model or dataset loading failures. — **Phavida**

## US 2.2 - Keyword Search

> As a student, I want to search by course name or code so that I can quickly locate a known course.

- [x] Search Thai course names.
- [x] Search English course names.
- [ ] `P1` Support course-code search. — **Phavida**
- [ ] Rank exact matches before partial matches. — **Phavida**
- [ ] Normalize case, spaces, and separators in course codes. — **Phavida**

## US 2.3 - Course APIs

- [x] Provide paginated `GET /courses`.
- [x] Provide the basic `GET /courses/{subject_code}` endpoint.
- [ ] `P1` Add credits, faculty, and department to course responses. — **Phavida**
- [ ] `P1` Add sections and time slots to course details. — **Phavida**
- [ ] Add prerequisites, academic year, and semester. — **Phavida**
- [ ] Standardize error responses across all endpoints. — **Phavida**

## US 2.4 - Filter API

> As a student, I want server-side filtering so that search results match my constraints.

- [ ] `P1` Filter by faculty. — **Phavida**
- [ ] `P1` Filter by credit range. — **Phavida**
- [ ] `P1` Filter by day. — **Phavida**
- [ ] `P1` Filter by time range. — **Phavida**
- [ ] Support multiple filters simultaneously. — **Phavida**
- [ ] Apply filters to both semantic and keyword search. — **Phavida**
- [ ] Return the total result count and active filters. — **Phavida**

## US 2.5 - Conflict and Credit Rules

- [ ] `P1` Implement a time-slot overlap function. — **Phavida**
- [ ] Support sections that meet on multiple days. — **Phavida**
- [ ] Treat consecutive classes as non-conflicting. — **Phavida**
- [ ] Create a conflict-check API or shared rule. — **Phavida**
- [ ] Return the conflicting course and section pairs. — **Phavida**
- [ ] Store minimum and maximum credit rules in configuration. — **Phavida**

---

# Epic 3: Frontend Foundation

## US 3.1 - Maintainable Frontend Structure

- [ ] `P0` Organize the project into `components/pages/services/hooks/context/utils`. — **Nicha**
- [ ] `P0` Create `services/courseApi.js` and a shared Axios instance. — **Nicha**
- [ ] Separate development and production environment configuration. — **Nicha**
- [ ] Create shared Button, Badge, Modal, Loading, and Empty State components. — **Nicha**
- [ ] Add an Error Boundary and 404 page. — **Nicha**
- [ ] Remove unused assets and imports. — **Nicha**

## US 3.2 - Code Quality

- [ ] `P0` Remove the unused `navigate` variable from `CoursePage.jsx`. — **Nicha**
- [ ] `P0` Separate `useAuth` to resolve `react-refresh/only-export-components`. — **Nicha**
- [ ] `P0` Make `npm run lint` pass. — **Nicha**
- [x] Production build passes.
- [ ] Add an `npm run test` command. — **Nicha**
- [ ] Add a formatter and naming conventions. — **Nicha**

## US 3.3 - Responsive and Accessible UI

- [ ] `P1` Support desktop, tablet, and mobile layouts. — **Nicha**
- [ ] Add mobile navigation. — **Nicha**
- [ ] Add labels and ARIA attributes to forms and icon buttons. — **Nicha**
- [ ] Support keyboard navigation. — **Nicha**
- [ ] Verify color contrast. — **Nicha**
- [ ] Prevent long text from overflowing course cards. — **Nicha**

---

# Epic 4: Course Discovery Frontend

## US 4.1 - Search Experience

- [x] Provide Search/Ask mode switching.
- [x] Connect keyword and semantic search APIs.
- [x] Provide basic loading, error, and empty states.
- [ ] `P1` Disable search when the query is empty. — **Nicha**
- [ ] Add loading skeletons and API retry behavior. — **Nicha**
- [ ] Preserve the query and search mode during navigation. — **Nicha**
- [ ] Add pagination or Load More. — **Nicha**
- [ ] Add debounce if automatic searching is introduced. — **Nicha**

## US 4.2 - Search Result Cards

- [x] Display basic code, name, description, and match score.
- [ ] `P1` Replace placeholder credits and schedules with real data. — **Nicha**
- [ ] Display faculty. — **Nicha**
- [ ] Truncate long descriptions cleanly. — **Nicha**
- [ ] Show match scores only for semantic search. — **Nicha**
- [ ] Highlight keyword matches. — **Nicha**
- [ ] Show an Already Added state. — **Nicha**

## US 4.3 - Filters

- [x] Provide the Filter Panel UI.
- [ ] `P1` Move filter values into shared controlled state. — **Nicha**
- [ ] `P1` Connect Apply Filters to the API. — **Nicha**
- [ ] Connect faculty, credit, and day filters. — **Nicha**
- [ ] Add a time-range filter. — **Nicha**
- [ ] Connect the language filter if it remains in scope. — **Nicha**
- [ ] Display active-filter and result counts. — **Nicha**
- [ ] Synchronize query and filters with the URL. — **Nicha**
- [ ] Reset filters and refresh results correctly. — **Nicha**
- [ ] Remove Year Level or define a clear data rule for it. — **Both**

---

# Epic 5: Course Details

## US 5.1 - View Course and Sections

> As a student, I want complete course details so that I can choose an appropriate section.

- [ ] `P1` Create the `/courses/:subjectCode` route. — **Nicha**
- [ ] `P1` Connect the Course Detail API. — **Nicha**
- [ ] Display the name, code, faculty, credits, description, and prerequisites. — **Nicha**
- [ ] `P1` Display all available sections. — **Nicha**
- [ ] Display each section's day, time, and location. — **Nicha**
- [ ] `P1` Allow the user to select a section. — **Nicha**
- [ ] Add the selected section to the timetable. — **Nicha**
- [ ] Preserve search and filter state when navigating back. — **Nicha**

---

# Epic 6: Timetable Planner

## US 6.1 - Add and Remove Sections

> As a student, I want to manage selected sections so that I can build my personal timetable.

- [x] Provide a weekly grid and Selected Courses panel.
- [ ] `P1` Create `TimetableContext` or another state store. — **Nicha**
- [ ] `P1` Define the Timetable Item model using the shared data contract. — **Nicha**
- [ ] `P1` Connect Add to Timetable. — **Nicha**
- [ ] `P1` Render course blocks according to day and time. — **Nicha**
- [ ] Assign stable colors to courses. — **Nicha**
- [ ] Display selected courses and support removal. — **Nicha**
- [ ] Add confirmation before clearing the timetable. — **Nicha**
- [ ] Prevent duplicate sections. — **Nicha**
- [ ] `P1` Save the timetable in Local Storage. — **Nicha**
- [ ] Restore the timetable after page refresh. — **Nicha**

## US 6.2 - Conflict Warning

- [ ] `P1` Call the conflict rule/API before adding a section. — **Both**
- [ ] `P1` Display a conflict dialog. — **Nicha**
- [ ] Identify which courses conflict. — **Nicha**
- [ ] Highlight conflicting blocks. — **Nicha**
- [ ] Decide whether conflicts are blocked or require confirmation. — **Both**
- [ ] Display a Conflict-free status. — **Nicha**

## US 6.3 - Credit Tracking

- [x] Provide the Credit Widget UI.
- [ ] `P1` Calculate the number of courses from timetable state. — **Nicha**
- [ ] `P1` Calculate total credits. — **Nicha**
- [ ] Update totals after adding or removing a section. — **Nicha**
- [ ] Display minimum and maximum credit limits. — **Nicha**
- [ ] Display Normal, Warning, and Exceeded states. — **Nicha**

---

# Epic 7: Authentication and Persistence

> Complete this epic after the Discovery and Timetable MVP if time is limited.

## US 7.1 - Real User Account

- [x] Provide mock Login/Register UI and protected routes.
- [ ] `P2` Design the User model and database. — **Phavida**
- [ ] Create a Register API with password hashing. — **Phavida**
- [ ] Create a Login API with JWT. — **Phavida**
- [ ] Connect Login and Register forms. — **Nicha**
- [ ] Add an Axios authentication interceptor. — **Nicha**
- [ ] Handle expired tokens and unauthorized responses. — **Both**
- [ ] Connect real logout behavior. — **Both**
- [ ] Store timetables per user. — **Both**

---

# Epic 8: AI Evaluation

## US 8.1 - Evaluate Search Quality

> As a researcher, I want measurable search quality so that the project can demonstrate improvement over keyword search.

- [ ] `P1` Create a set of natural-language queries. — **Both**
- [ ] `P1` Label query-course relevance. — **Both**
- [ ] Split the evaluation dataset. — **Phavida**
- [ ] Calculate Precision@K, Recall@K, and MRR. — **Phavida**
- [ ] Compare keyword search with SBERT. — **Phavida**
- [ ] Analyze failure cases. — **Both**
- [ ] Fine-tune SBERT if the baseline is insufficient. — **Phavida, Optional**
- [ ] Prepare result tables and charts for the report. — **Both**

---

# Epic 9: Testing and Quality Assurance

## US 9.1 - Backend Tests

- [ ] `P1` Configure Pytest. — **Phavida**
- [ ] Test data preprocessing. — **Phavida**
- [ ] Test empty queries and invalid Top-N values. — **Phavida**
- [ ] Test semantic-search response schemas. — **Phavida**
- [ ] Test keyword search by name and code. — **Phavida**
- [ ] Test filters and Course Not Found behavior. — **Phavida**
- [ ] Test conflict-detection boundary cases. — **Phavida**
- [ ] Test credit rules. — **Phavida**

## US 9.2 - Frontend Tests

- [ ] `P1` Configure Vitest and React Testing Library. — **Nicha**
- [ ] Test SearchBar and search modes. — **Nicha**
- [ ] Test filter state and reset behavior. — **Nicha**
- [ ] Test CourseCard and Course Detail. — **Nicha**
- [ ] Test adding and removing timetable items. — **Nicha**
- [ ] Test credit calculation and the conflict dialog. — **Nicha**
- [ ] Mock APIs using MSW. — **Nicha**

## US 9.3 - Integration and User Testing

- [ ] Test the complete search flow end to end. — **Both**
- [ ] Test the complete timetable flow end to end. — **Both**
- [ ] Perform responsive and accessibility testing. — **Nicha**
- [ ] Test search API performance. — **Phavida**
- [ ] Conduct user acceptance testing with students. — **Both**
- [ ] Record issues and test results. — **Both**

---

# Epic 10: CI/CD, Security, and Deployment

## US 10.1 - Continuous Integration

- [x] Frontend CI installs dependencies and builds the project.
- [x] Backend CI runs Ruff.
- [ ] `P1` Add Frontend linting and tests to CI. — **Nicha**
- [ ] Add Backend tests to CI. — **Phavida**
- [ ] Require successful CI before merging pull requests. — **Both**

## US 10.2 - Production Readiness

- [ ] Restrict CORS to the production Frontend URL. — **Phavida**
- [ ] Confirm that `.env` is not committed and provide `.env.example`. — **Both**
- [ ] Create a Backend Dockerfile. — **Phavida**
- [ ] Create a Frontend Dockerfile if required. — **Nicha**
- [ ] Configure production environment variables. — **Both**
- [ ] Deploy the Backend and verify `/health`. — **Phavida**
- [ ] Deploy the Frontend. — **Nicha**
- [ ] Add error logging and monitoring. — **Phavida**
- [ ] Perform production smoke tests. — **Both**

## US 10.3 - Documentation

- [ ] Update both README files to match the implemented system. — **Both**
- [ ] Add an architecture diagram. — **Both**
- [ ] Add API documentation and examples. — **Phavida**
- [ ] Add local setup and deployment guides. — **Both**
- [ ] Create a user manual. — **Nicha**
- [ ] Prepare a demo scenario. — **Both**

---

# Recommended Sprint Plan

## Sprint 1 - Data Contract and Frontend Foundation

### Phavida

- Deduplicate and validate the dataset.
- Obtain and join credits, faculty, section, and schedule data.
- Define Course and Section schemas.
- Fix embedding-cache validation.

### Nicha

- Refactor the Frontend structure.
- Separate the API service layer.
- Resolve ESLint errors.
- Build Course Detail with mock data.
- Prepare the timetable state model.

**Sprint Goal:** The Frontend and Backend use the same data contract, and basic CI checks pass.

## Sprint 2 - Course Discovery MVP

### Phavida

- Implement the Filter API.
- Add course-code keyword search.
- Complete Course Detail and Section APIs.
- Add Backend unit tests.

### Nicha

- Connect filters and Course Detail.
- Display and select sections.
- Preserve search and filter state.

**Sprint Goal:** The user can search, filter, view details, and select a section.

## Sprint 3 - Timetable MVP

### Phavida

- Implement conflict detection and credit rules.
- Add conflict-detection unit tests.

### Nicha

- Add and remove sections.
- Render course blocks.
- Add Local Storage persistence.
- Calculate credits and display conflict warnings.

**Sprint Goal:** The user can build a conflict-free timetable and view total credits.

## Sprint 4 - Evaluation and Release

### Phavida

- Calculate Precision@K, Recall@K, and MRR.
- Deploy the Backend.
- Configure production security and logging.

### Nicha

- Add Frontend tests.
- Complete responsive and accessibility work.
- Deploy the Frontend.

### Both

- Perform end-to-end and user acceptance testing.
- Fix bugs and complete documentation and the demo.

---

# Tasks to Start First

1. `P0` Confirm and prepare a dataset containing credits, faculty, sections, days, and times.
2. `P0` Define the Course, Section, and Time Slot JSON contracts.
3. `P0` Refactor the Frontend and separate the API service layer.
4. `P0` Resolve Frontend lint errors and make CI pass.
5. `P0` Validate embedding caches using a dataset version or hash.
6. `P1` Build Course Detail and section selection.
7. `P1` Connect filters.
8. `P1` Implement timetable state, add/remove behavior, and Local Storage.
9. `P1` Implement conflict detection and credit calculation.
10. `P1` Create the evaluation dataset and automated tests.

## Definition of Done

A task is complete when:

- It meets its acceptance criteria.
- Relevant loading, error, and empty states are handled.
- Tests cover important logic.
- Linting and builds pass.
- The work has been reviewed through a pull request.
- Documentation or the API contract has been updated.
- The change has been merged into `main` with passing CI.
