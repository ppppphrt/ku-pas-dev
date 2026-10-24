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
