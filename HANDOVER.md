# HANDOVER — LightPM workflow integration

Written to be read cold: it assumes no knowledge of the previous session.
**Pause point: phases 1–6 are implemented and verified (104 checks green). The
§7 defect is FIXED, and classification is now editable after creation (§6).
Everything is committed and pushed to `origin/local-hardening` (§8). The two
decisions named in the last handover (Delivery vocabulary, workbook import)
are resolved — see §6.3–6.4 and §9; one older question (§9.2) is still open.**

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

**Last run: all 104 checks pass (dashboard 19, config 29, status sets 9,
links/members 21, unified list 8, SSE 5, smoke 20 — the two suites that prove the
§7 fix carry new checks), audit clean, `next build` exit 0.** Run them against a
*reset* store too (`scripts\reset-local-store.js --yes`) — several bugs only appeared on a
fresh database.

**Never run `next build` while `next dev` is running.** They share `.next`; the build
wipes the dev server's chunks and every request after that answers 500 with
`MODULE_NOT_FOUND ./9276.js` / `./chunks/vendor-chunks/next.js` (cost one debugging
cycle). Stop the dev server first, then build. Recovery if it happens anyway: stop dev,
`rm -rf .next`, restart.

Type/build check:
```powershell
$env:PATH = "C:\Users\DELL\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.20.0-win-x64;$env:PATH"
& $node "$proj\node_modules\next\dist\bin\next" build
```

---

## 6. Next tasks, in order

1. ~~Fix the open defect in §7~~ — **DONE** (see §7 for what it actually was).
2. ~~Let the classification be edited after creation~~ — **DONE.** `PATCH
   /api/projects/[id]` accepts `reference_no` / `type` / `plan_class` /
   `request_type` (blank means "not set"), Project Settings > General renders
   all four (request type only for New Request, matching the create form), and
   the server enforces the invariant the form implies: `request_type` only
   survives while `plan_class` is `new_request`.
3. ~~**Decide the Delivery vocabulary question**~~ — **RESOLVED 2026-10-13:
   keep the default** (To Do · In Progress · Review · Blocked · Done). New
   projects do not switch to Delivery; the set stays as per-project data and
   the two canonical-key call sites (Blocked tile, `todo` default) are
   unchanged.
4. ~~**Import**~~ — **RESOLVED 2026-10-13: out of scope.** The real system will
   query the source systems directly, so reference-based import upsert
   (`05-light-plan.md` §8 phase 4) is cut. Only the user's decisions in §9
   remain open (§9.2, `handle_by` shape).
5. **Commit** — the working tree was empty at handover; keep it that way. The
   branch tracks `origin/local-hardening`, so `git push` is a plain push.

---

## 7. Query-builder defect — FIXED (was the open item)

`lib/dashboard.ts` called two query methods that **the local store did not
implement**:

```
lib/dashboard.ts:  .gte("created_at", windowStart.toISOString())
lib/dashboard.ts:  .like("details", "%to done")
```

The store's builder (`createMockClient` in `lib/supabaseServer.ts`) implemented
`select, insert, update, delete, eq, is, not, in, or, order, limit, single, maybeSingle,
then` — but **not `gte`, `like` or `neq`**. So the call threw, the surrounding `try/catch`
swallowed it, and the 14-day completion trend **silently fell back to an estimate**
(`lib/dashboard.ts` says so in its own comment). Against the old Supabase backend these
worked, so this was a fidelity regression specific to local-first mode.

`app/api/dev/clear/route.ts` also called `.neq(...)`; it failed the same way but harmlessly
(the real clearing happens via `clearMockStore`) while logging a misleading error.

**Fixed:** `gte`, `lte`, `gt`, `lt`, `like` and `neq` now live in the builder next to the
existing `eq`/`is`/`in` filters. Timestamps are compared as instants (format variance
must not drop rows); `like` translates the SQL `%`/`_` pattern into an anchored RegExp,
case-sensitive like PostgREST's `like`.

**The second half of the defect — why the trend could never have worked anyway.** Three
`task_activity` inserts (task create in `app/api/tasks/route.ts`, status/assignee/priority
changes in `app/api/tasks/[id]/route.ts`, Excel import in `app/api/import/route.ts`) were
written as `void db.from("task_activity").insert(...)`. A PostgREST builder is lazy and
only executes when adopted, so those rows were **silently dropped on both the local store
and Supabase** — the activity log held nothing but seed data. They now wrap the builder in
`Promise.resolve(...).catch(...)`: still fire-and-forget, but the insert actually runs.

**Proof:** the dashboard trend no longer reports `trendSource: "updated"` when activity
rows exist — `verify-dashboard-rollups.js` marks a task done and asserts
`trendSource === "activity"` (it fails with `trendSource=updated` without the fix).

---

## 8. Invariants and gotchas

- **Committed and pushed.** As of this handover the tree is clean and
  `local-hardening` tracks `origin/local-hardening` (the branch is 9 commits
  ahead of `origin/main`). The snapshot of the six verified phases is commit
  `51273c5`; keep committing before anything risky.
- **A PostgREST builder is lazy — `void db.from(...).insert(...)` never runs.**
  Adoption is what executes it (`await`, `.then`, or `Promise.resolve(builder)`).
  This bit the activity log three times; audit any new fire-and-forget write.
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

1. ~~Should new projects seed the **Delivery** vocabulary (Not Started · In
   Progress · UAT · On Hold · Done · Rejected)?~~ **RESOLVED 2026-10-13: no.**
   New projects keep the default vocabulary; Delivery stays as per-project data
   in `lib/statusSets.ts`, shown read-only on `/admin`. No call-site changes
   needed.
2. Should `handle_by` remain "members" (already implemented as `task_members` + project
   members), or become a single field? *(still open — not in the current brief)*
3. ~~Is the workbook import needed at all, given the real system will query source systems
   directly (§6.4)?~~ **RESOLVED 2026-10-13: out of scope.** The reference-based
   import upsert (plan §8 phase 4) is cut; the basic Excel import stays as-is.
4. Reference links can currently hold **any number** of ticket/CR/CRL rows per item. The
   user already chose "many"; revisit only if reporting needs it deduplicated.
