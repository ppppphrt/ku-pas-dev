# KU-PAS frontend

See ../README.md for local startup without Node.js using the supplied dist/.
To develop the React app, use Node.js 24 and pnpm 11:

```bash
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
pnpm lint
pnpm test
pnpm build
```

The API defaults to http://127.0.0.1:8000. Copy `.env.example` to `.env` to change
it, then rebuild. Production settings have a separate example. Auth tokens are
kept in sessionStorage; guest timetable references are kept in Local Storage.
The server validates course credits and all meeting intervals before adding.
Search queries and filters are encoded in the URL and retained across detail
navigation. Snapshot changes require review instead of silently reusing IDs.

## Interface language

Use **Language / ภาษา** in the top navigation to select **English** or **ภาษาไทย**.
The choice is saved in Local Storage (`ku-language`) and applies to navigation,
search/filter controls, details, timetable, account forms, feedback and GE chat.
Changing language keeps the current route, drafts, filter values and timetable.
Course names/descriptions use the selected source-language field and fall back
to the other field if missing. Course codes and API/filter identifiers stay the
same. The initial language is English if no valid preference is saved.

### New UI branch

`new-ui` uses a study-space theme inspired by the supplied education reference: a soft cyan canvas, rounded white surfaces, orange actions, and an original local SVG illustration. Discovery has a two-column course grid on wide screens and collapsible filters on mobile. On smaller screens, GE Chat puts the conversation before its preference controls. Language selection, canonical filter values, course selection, and saved timetables retain their existing behavior. All changes in this branch are contained in `frontend/`.
