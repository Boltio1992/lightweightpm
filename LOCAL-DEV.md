# Running LightPM locally (no Supabase, no Vercel)

This project now runs entirely on your own machine. No cloud account, no API
keys, no schema dashboard, no deploy step.

- **Database:** a single SQLite file, `data/lightpm.db`
- **Live updates:** Server-Sent Events, so open windows stay in sync
- **Data administration:** the file is plain SQLite — open it with any tool, or
  ask for a query to be run against it

---

## Start it

```cmd
dev.cmd
```

or, if Node is on your PATH:

```cmd
npm run dev
```

Then open <http://localhost:3000> and sign in with the demo accounts:

| Username | Password      | Role   |
|----------|---------------|--------|
| `admin`  | `password123` | admin  |
| `jane`   | `password123` | member |
| `marcus` | `password123` | member |

On first start the demo data (Apollo Design System, Mobile App v2, tasks,
members, comments) is seeded automatically. After that your data is loaded from
disk and the seed is never re-applied.

---

## Where your data lives

| Path | What it is |
|---|---|
| `data/lightpm.db` | the database (plus `-wal`/`-shm` while running) |
| `.env.local` | local config; Supabase values are placeholders on purpose |
| `.env.supabase.local.bak` | your old hosted credentials, kept in case you go back |

`data/` and the credential backup are gitignored — they will never be committed.

**Back up:** stop the server, copy `data/lightpm.db`. That is the whole system.

**Inspect it:**

```cmd
npm run db:inspect
```

or with any SQLite tool, or just ask — e.g. *"list the tasks that are overdue"*.

**Reset to a clean demo:**

```cmd
npm run db:reset
```

This deletes the store; the next start re-seeds the demo data.

---

## Share it with someone

```cmd
share.cmd
```

This opens a temporary public URL through a Cloudflare quick tunnel and prints
it. Anyone with the URL reaches your machine, so **the login still applies** —
share the URL, not the passwords, with people you trust. Ctrl+C closes it. The
URL is different each run, and nothing is exposed while it is not running.

Alternatives if you prefer: run it on your own LAN (`npm run dev` already binds
`0.0.0.0`, so `http://<your-ip>:3000` works for a friend on the same network),
or send them the folder and have them run `dev.cmd` themselves.

---

## Checking it still works

```cmd
powershell -ExecutionPolicy Bypass -File scripts\local\smoke-test.ps1
node scripts\local\verify-sse.js
```

`smoke-test.ps1` exercises 20 real API behaviours (auth, project and task
creation, status seeding, resource embedding, search, dashboard). `verify-sse.js`
opens the live stream, performs a write, and asserts the change is pushed.

Persistence across a restart is checked in two steps: run the smoke test, restart
the server, then run `scripts\local\verify-restart.ps1`.

---

## How it works

The app always talked to the database through one function, `supabaseAdmin()` in
`lib/supabaseServer.ts`, which returned either the hosted Supabase client or an
in-memory implementation of the same query-builder surface. That second
implementation is what AI Studio ran on — and it threw everything away on
restart.

What changed:

| File | Role |
|---|---|
| `lib/localDb.ts` | durable store: SQLite when available, JSON file otherwise |
| `lib/supabaseServer.ts` | loads the store at boot, persists it after every write |
| `lib/events.ts` | in-process change bus |
| `app/api/events/route.ts` | SSE endpoint feeding the browser |
| `components/LiveUpdates.tsx` | subscribes and refreshes the UI |
| `supabase/schema.sqlite.sql` | the local schema, for reference |

Only `lib/supabaseServer.ts` knows how to reach a database. The 23 modules and
~64 query call sites were not touched, so the query semantics are still the ones
that were already proven.

### Deliberate limitations

- **Writes mirror the whole store.** Every write rewrites all tables in one
  transaction. Trivial at this size (a few ms) and impossible to get partially
  wrong, but it is a mirror, not a query engine.
- **The mirror is permissive** — no `NOT NULL`, `UNIQUE` or foreign keys. The
  app layer is the source of truth and performs its own cascade deletes. Adding
  stricter constraints could only reject writes the app accepts, turning a
  working demo into a 500. One consequence: duplicate `project_members` rows are
  possible, exactly as they were before this change.
- **Live updates are per process.** Correct for one Node process. If LightPM is
  ever run as several processes behind a load balancer, `lib/events.ts` needs a
  real pub/sub (Redis, or Postgres `LISTEN`/`NOTIFY`).
- **Notifications are in memory only.** They are not part of the Postgres
  schema, so they are not mirrored.
- **Do not run two servers against one store.** Stop one before starting the other.

---

## Going back to Supabase, or forward to your own server

Your old credentials are still in `.env.supabase.local.bak`. Put the real
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` back into `.env.local` and remove
`LIGHTPM_DB_PATH`; `supabaseAdmin()` switches back to the hosted client and the
local file is simply ignored.

For the physical server, the code is coupled to the PostgREST query shape rather
than to Supabase itself — and it uses no Supabase Auth, Storage or RPC. So either:

1. run Postgres + PostgREST there (near-zero code change), or
2. write a Postgres implementation of the same small interface — `lib/localDb.ts`
   is the template, and it is the only file that would change.

> **Note on the old Supabase project:** its service-role key was pasted into a
> chat on 2026-09-29 and per `SUPABASE-KEY-ROTATION.md` was still valid on
> 2026-10-06. You said this demo does not matter, so it was left alone — but if
> that project is ever reused for anything real, rotate the key first.
