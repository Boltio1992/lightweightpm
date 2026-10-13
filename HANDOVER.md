# HANDOVER — LightPM workflow integration

Written to be read cold: it assumes no knowledge of the previous session.
**Pause point: phases 1–6 are implemented and verified (100 checks green). One known
defect is open and listed in §7. Nothing is committed yet (§8).**

---

## 1. Where everything is

| What | Absolute path |
|---|---|
| **The project (only clone)** | `C:\Users\DELL\WorkBuddy AI\lightweightpm` |
| Plan being implemented | `docs\redesign\05-light-plan.md` (the plan) + `docs\redesign\06-ux-design.md` (UX detail) |
| Evidence the plan rests on | `docs\redesign\04-evidence-appendix.md` |
| Superseded design docs | `docs\redesign\00-README.md` has a banner; `01`–`03` + `mockup.html` are **not** the direction |
| Run/operate guide | `LOCAL-DEV.md` |
| Verification scripts | `scripts\local\` (7 of them, §5) |
| The local database | `data\lightpm.db` (+ `-wal`, `-shm`), gitignored |

---

## 2. Environment facts (these will bite if ignored)

- **`node` and `npm` are NOT on PATH.** Use the full path:
  `C:\Users\DELL\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.20.0-win-x64\`
  (Node v24.20.0 — has built-in `node:sqlite`, which the store needs.)
- **PowerShell script execution is disabled.** So:
  - run `.ps1` as `powershell.exe -NoProfile -ExecutionPolicy Bypass -File <path>`
  - `npm run dev` fails in PowerShell (`npm.ps1` blocked). Use **`dev.cmd`**, or `cmd /c npm run dev`.
- **Git** is at `C:\Program Files\Git\cmd\git.exe` (not on PATH).
- **The app runs on port 3000.** Start with `dev.cmd` from the project root; to stop, kill the
  process listening on 3000:
  `Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`
- **Login:** `admin` / `password123` (also `jane`, `marcus`).
- **Reset the store to clean demo data:** `node scripts\reset-local-store.js --yes`.
- If `data\lightpm.json` ever appears, the store silently fell back to its JSON backend — read §8.

---

## 3. What is being built and why

LightPM is a Next.js 14 + TypeScript project/task tracker. It originally ran on
Supabase + Vercel; it now runs **local-first on a SQLite file** with no cloud
dependency (`LOCAL-DEV.md` explains how that works).

The current objective: **absorb a legacy Excel-based portfolio tracking workflow into
LightPM, kept light and minimal.** The user's framing, which governs scope:

> the legacy PM is similar to task or project tracking which we use LightPM to create
> task or project

So the legacy registers map onto the **existing** projects and tasks — *not* onto new
entity types. Two decisions the user made explicitly:

- **Ticket / Change Request / Change Release stay in their own systems.** LightPM stores
  only a *reference* to them (`kind` + `reference`). For the demo the title and progress
  are typed by hand; in the real system a direct query will refresh them in place.
- **Every project and every project-less task can carry such a reference.**

`docs/redesign/05-light-plan.md` §2 lists all six settled decisions.

---

## 4. Status — all six phases done and verified

| Phase | What | Key files |
|---|---|---|
| 1 | 5 columns (`projects.reference_no/type/plan_class/request_type`, `tasks.reference_no`) + `links` and `task_members` tables | `lib/localDb.ts` (DDL + `ensureColumns`), `supabase/schema.sql`, `supabase/schema.sqlite.sql`, `supabase/migrations/20261013_workflow_fields.sql` |
| 2 | One status vocabulary instead of six hard-coded copies | `lib/statusSets.ts` (new), `types/index.ts`, `lib/importConfig.ts`, `components/Badges.tsx`, `components/GanttTimeline.tsx`, `components/KanbanBoard.tsx`, `app/api/projects/[id]/statuses/route.ts` |
| 3 | **One task table**: Project filter replaces the "No project / All" toggle, Project column, no "standalone" wording | `app/(app)/tasks/page.tsx`, `components/TaskList.tsx`, `app/globals.css` (`.row-grid.with-project`), `app/(app)/projects/[id]/page.tsx` |
| 4 | Reference links + task members UI | `app/api/links/**`, `app/api/tasks/[id]/members/**`, `lib/links.ts`, `components/ReferenceLinks.tsx`, `components/TaskMembers.tsx`, wired into `components/TaskInspector.tsx` and the project detail References tab |
| 5 | Admin screen + configurable lists + project classification | `config_options` table, `lib/configLists.ts`, `lib/configStore.ts`, `app/api/config/**`, `app/(app)/admin/page.tsx`, `components/Sidebar.tsx`, `app/(app)/projects/page.tsx`, `app/api/projects/route.ts` |
| 6 | Dashboard rollups by type and plan class | `lib/dashboard.ts`, `components/DashboardView.tsx` |

Also fixed along the way:
- `lib/supabaseServer.ts` — `_format` had no `task_members` case, so `user:users(...)`
  embedding returned nothing (members showed no people).
- `scripts/audit-schema.js` — its select parser cut embedded resources at `(` but kept the
  resource *name*, recording `user:users(...)` as a phantom column.

---

## 5. How to verify (run these after any change)

Start the server first, then:

```powershell
$node = "C:\Users\DELL\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.20.0-win-x64\node.exe"
$proj = "C:\Users\DELL\WorkBuddy AI\lightweightpm"
& $node "$proj\scripts\local\verify-dashboard-rollups.js"   # 15 checks
& $node "$proj\scripts\local\verify-config.js"              # 22
& $node "$proj\scripts\local\verify-status-sets.js"         #  9
& $node "$proj\scripts\local\verify-links-members.js"       # 21
& $node "$proj\scripts\local\verify-unified-list.js"        #  8
& $node "$proj\scripts\local\verify-sse.js"                 #  5
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$proj\scripts\local\smoke-test.ps1"   # 20
& $node "$proj\scripts\audit-schema.js"                     # expect "No drift"
```

**Last run: all 100 checks pass, audit clean, `next build` exit 0.** Run them against a
*reset* store too (`scripts\reset-local-store.js --yes`) — several bugs only appeared on a
fresh database.

Type/build check:
```powershell
$env:PATH = "C:\Users\DELL\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.20.0-win-x64;$env:PATH"
& $node "$proj\node_modules\next\dist\bin\next" build
```

---

## 6. Next tasks, in order

1. **Fix the open defect in §7** (small, and it makes a dashboard number truthful).
2. **Let the classification be edited after creation.** It can be set in the create form
   (`app/(app)/projects/page.tsx` + `POST /api/projects`) but `ProjectSettingsModal.tsx` and
   `PATCH /api/projects/[id]` do not expose `reference_no` / `type` / `plan_class` /
   `request_type`, so a typo cannot be corrected.
3. **Decide the Delivery vocabulary question** (§7 of `05-light-plan.md`, and §9 of
   `06-ux-design.md`). The three vocabularies already exist as data in `lib/statusSets.ts`
   and are shown read-only on `/admin`. Switching *new* projects to `DELIVERY_STATUS_SET`
   also requires updating two things that reference canonical keys: the dashboard's
   **Blocked** tile counts `status === "blocked"` (the delivery set has no `blocked`), and
   `todo` is the default in the task-create and import paths (the delivery set calls that
   state `not_started`). Do them together or tasks will land in no Kanban column.
4. **Import** — the user has said the real system will **query the source systems directly**
   rather than import, and the demo is entered by hand. So reference-based import upsert
   (`05-light-plan.md` §5 phase 4) is probably **out of scope**; confirm before building it.
5. **Commit.** See §8.

---

## 7. Known open defect (do this first)

`lib/dashboard.ts` calls two query methods that **the local store does not implement**:

```
lib/dashboard.ts:  .gte("created_at", windowStart.toISOString())
lib/dashboard.ts:  .like("details", "%to done")
```

The store's builder (`createMockClient` in `lib/supabaseServer.ts`) implements
`select, insert, update, delete, eq, is, not, in, or, order, limit, single, maybeSingle,
then` — but **not `gte`, `like` or `neq`**. So the call throws, the surrounding `try/catch`
swallows it, and the 14-day completion trend **silently falls back to an estimate**
(`lib/dashboard.ts` says so in its own comment). Against the old Supabase backend these
worked, so this is a fidelity regression specific to local-first mode.

`app/api/dev/clear/route.ts` also calls `.neq(...)`; it fails the same way but harmlessly
(the real clearing happens via `clearMockStore`) while logging a misleading error.

**Fix:** implement `gte`, `lte`, `gt`, `lt`, `like` and `neq` in the builder — six small
methods next to the existing `eq`/`is`/`in` filters. Then prove it: the dashboard trend
should no longer report `trendSource: "updated"` when activity rows exist.

---

## 8. Invariants and gotchas

- **Nothing is committed.** `git status` in the project shows ~15 modified and ~15 new paths
  since the last commit. The branch is `local-hardening`, which is itself **6 commits ahead
  of `origin/main` and unpushed**. Commit before doing anything risky.
- **The store mirrors the whole database on every write** (`saveStore` in `lib/localDb.ts`):
  every table is rewritten inside one transaction. Trivial at this size; not a query engine.
- **The SQLite mirror is deliberately permissive** — no `NOT NULL`, `UNIQUE` or foreign keys.
  The app layer is the source of truth and does its own cascade deletes. Consequence:
  duplicate `task_members` rows are possible at the data layer (the UI prevents them by
  filtering the picker), and a route's `error.code === "23505"` branch only fires on Postgres.
- **New *columns* vs new *tables*.** `create table if not exists` cannot add a column to an
  existing table, so `lib/localDb.ts` has `ADDED_COLUMNS` + `ensureColumns()`, which runs on
  every open. Add new columns there **and** to the DDL, `supabase/schema.sql`,
  `supabase/schema.sqlite.sql` and a migration.
- **Never let the store silently switch backends.** A failure to open SQLite must stay
  transient and must not fall through to the JSON store, or the app serves a *different
  dataset*. That is why `sqliteUnavailableButExpected()` exists and why `data\lightpm.json`
  showing up is a red flag.
- **Next validates route-file exports.** Only HTTP methods and route config may be exported
  from `app/api/**/route.ts` — helpers go in `lib/`. (Cost me a build failure: exporting
  `validProgress` from a route.)
- **Any embedded select needs a matching case in the store's `_format`.** PostgREST embeds
  `alias:table(...)` natively; the local store special-cases each table, so a new embedding
  returns nothing until it is added (`links` needs no embedding; `task_members` was fixed).
- **Writes announce themselves through one choke point:** `persistStore()` in
  `lib/supabaseServer.ts` calls `publishChange(table)`, which drives the SSE live updates
  (`lib/events.ts` → `app/api/events/route.ts` → `components/LiveUpdates.tsx`).
- **Status vocabularies:** a project's statuses are rows in `project_statuses` (edited in
  Project Settings); the three *fallback* vocabularies are code constants in
  `lib/statusSets.ts`. `lib/configLists.ts` holds the three Admin lists.
- **Classification lists are seeded lazily** by `lib/configStore.ts` (called from both the
  config route and the dashboard) — that ordering bug is already fixed; keep the helper as
  the single seeding path.
- **The `.row-grid` template** in `app/globals.css` must stay in step with the header and the
  row cells: caret, checkbox, title, project(optional), status+priority, duration, progress,
  deadline, assignee, actions. `.with-project` adds the project column at `xl` only.

---

## 9. Open decisions for the human

1. Should new projects seed the **Delivery** vocabulary (Not Started · In Progress · UAT ·
   On Hold · Done · Rejected)? See §6.3 for the two call sites that must change with it.
2. Should `handle_by` remain "members" (already implemented as `task_members` + project
   members), or become a single field?
3. Is the workbook import needed at all, given the real system will query source systems
   directly (§6.4)?
4. Reference links can currently hold **any number** of ticket/CR/CRL rows per item. The
   user already chose "many"; revisit only if reporting needs it deduplicated.
