# 06 — LightPM UX design (deep)

Building on `05-light-plan.md`. This is the deep pass: flows, screens, states and
the exact build map. The product stays light; the *thinking* is what is detailed
here.

---

## 1 · Principles

1. **One list.** All tasks in one table; projects are the grouping, not a second place.
2. **Config over code.** Types, plan classes, request types, statuses and priorities
   are data the user can edit — never hard-coded.
3. **The core of a record is ID + title + progress.** Everything else is optional
   and can be filled later. A row must never be blocked by missing detail.
4. **Reference, don't copy.** Ticket / Change Request / Change Release live in
   their own systems. LightPM holds a link, and today you type the link's
   ID + title + progress; later the same link resolves by a direct query.
5. **No new entity types.** Projects and tasks only.

## 2 · Final data shape (from `05` plus today's answers)

**New columns**

| Table | Column | Notes |
|---|---|---|
| `projects` | `reference_no` | human reference, optional |
| `projects` | `type` | configurable list |
| `projects` | `plan_class` | configurable: `In Plan`, `New Request` |
| `projects` | `request_type` | configurable; shown only when `plan_class = New Request` |
| `tasks` | `reference_no` | optional |

**New tables**

| Table | Purpose | Key columns |
|---|---|---|
| `links` | a project/task's references to external records | `owner_kind` (`project`\|`task`), `owner_id`, `kind` (`ticket`\|`change_request`\|`change_release`), `reference`, `title`, `progress_percent`, `updated_at` |
| `task_members` | people named on a project-less task | `task_id`, `user_id`, `role`, `added_at` |

`links.progress_percent` and `links.title` exist because the demo has no live
source: you type them. In the real system those two become values pulled by a
query, and the table shape does not change — only how they are filled.

## 3 · Information architecture

Four screens, no new top-level concepts:

| Screen | Route | Contents |
|---|---|---|
| Dashboard | `/dashboard` | unchanged; gains a `type` and `plan_class` rollup |
| Tasks | `/tasks` | **the unified table** (§4) |
| Projects | `/projects` | unchanged; gains `type`/`plan_class` filters and a `reference_no` column |
| Project detail | `/projects/[id]` | Tasks / Kanban / Timeline / Members — Tasks tab is the same table, pre-filtered |
| Admin | new `/admin` | status sets, types, plan classes, request types, priorities — all config (§9) |

No "standalone tasks" page. No "requests" page. No "studies" page. Studies are
projects with `type = Study`; adhoc follow-ups are tasks without a project.

## 4 · The unified task table (the heart)

This is the "report" the user described: all tasks in one table, filterable.

**Default view** — every task, newest-first, regardless of project.

**Columns** (left → right, all optional except title):

1. **Reference** (`reference_no`) — small, monospace; blank if none.
2. **Title** — main column; shows a project chip beneath when under a project.
3. **Project** — the project name or an explicit `—` (with a subtle "no project"
   affordance, not the word "standalone").
4. **Status** — dot + label; **inline editable** (tap → menu of the project's
   status set, or the global set for project-less tasks).
5. **Progress** — a thin bar + number; **inline editable** (click → type 0–100).
6. **Priority** — flag, from the config list.
7. **Assignees / members** — initials of `assignee` + `task_members`.
8. **Due date** — with `Today` / `in 3d` / `3d late` treatment (already exists).
9. **Links** — a count badge (e.g. `2`) opening the link popover (§8).
10. **Age** — days since last update, colouring when stale.

**Filters** (a single row above the table, all combinable):

- **Project**: `All` · `No project` · each project. (This replaces today's
  standalone/all toggle — see §4 of `05`.)
- **Status**, **Priority**, **Type**, **Plan class** — multi-select chips.
- **Assigned to me** — quick toggle.
- **Search** — title/reference/description substring.
- The active filter set is remembered per user (localStorage), so reopening the
  app returns to your working view.

**Sorting** — click a header: reference, title, status, progress, priority, due
date, age. Default: due date ascending with no-due-date last.

**Grouping** — optional, toggle: by Project · by Status · by Type. Collapses to a
flat list by default.

**Bulk actions** — multi-select checkboxes reveal a bar: set status, set priority,
assign, set progress, move to project, link a reference. Applies with one click
and a toast; each item can be individually rejected by validation (e.g. an
invalid status for that project) with the reason shown.

**Row interactions** — click a row opens the existing TaskInspector side panel
(keep it; it already holds edit, subtasks, comments, activity). The table itself
only needs the two inline edits above, so the inspector stays the "detail" place
rather than duplicating everything inline.

**States**

- *Empty*: "No tasks yet" with one primary action (Create task) and, if a filter
  is active, a "Clear filters" link that names the active filter — so a user
  never thinks data was lost.
- *Loading*: skeleton rows matching the column count (already present in
  `LoadingSkeletons.tsx`).
- *Error*: inline banner with retry; the table is not blanked.

## 5 · Project detail

Keep the four tabs. Two changes:

- **Tasks tab** = the unified table scoped to this project (same component, a
  `projectId` prop). Nothing diverges between the two views.
- **Members tab** = existing `project_members`; add a **"Linked references"**
  panel here too (same link list as a task's, §8), because a project links to
  many CRs/tickets and that list is a first-class thing to review.

## 6 · Create flows

**Create project** (from Projects page or dashboard): fields are `name`
(required), `reference_no`, `type`, `plan_class`, and `request_type` *only when*
plan_class is `New Request`, `start_date`, `end_date`. Default `type` is unset
with a hint. Progress starts at 0 and is not asked for here.

**Create task** (from the unified table, or a project): the **only required
field is `title`**. `reference_no`, `project`, `assignee`/members, `status`,
`priority`, `due_date`, `progress` are all optional and defaulted. This enforces
principle 3 — you can log an item in one field and flesh it out later.

**Quick-add**: a bare input row pinned above the table ("What needs tracking? ↵")
creates a task with just the title — the fastest path for BAU and adhoc items.

## 7 · Members

Projects: `project_members` (unchanged).

Tasks: `task_members` (new) mirrors it — add people by search, assign a role
(default member), remove. A task can have members **and** still be unassigned
(no `assignee_id`); members answer "who's handling this", assignee answers "who
owns it right now". The distinction is shown as two small groups in the
inspector, not merged.

## 8 · Reference links (Ticket / CR / CRL)

A "Links" section on every project and task (inspector on tasks, a panel on
projects).

- **Add**: choose `kind` (Ticket / Change Request / Change Release), type the
  `reference` (e.g. `181772`, `CREQ-26-08-0087`), then `title` and `progress`
  (both optional in the demo because you type them; required once live sync
  exists and the query supplies them).
- **Display**: one row per link — kind badge, reference (monospace), title,
  progress bar. Clicking a reference copies it (there is nowhere to navigate to
  yet; in the real system this becomes a link to the source record).
- **Cardinality**: many per item (`links` table); no per-kind limit.
- **Future**: the `kind` + `reference` pair is the query key. When the real
  systems are queryable, a sync job refreshes `title`/`progress_percent` in
  place. The UI already reads only those fields, so the swap from "typed by a
  person" to "fetched by a job" changes nothing visible.

## 9 · Status configuration and the one code change

Statuses must stop being hard-coded. Concrete plan:

- `types/index.ts` `TASK_STATUSES`, `lib/importConfig.ts` `TASK_STATUS_KEYS` and
  `components/GanttTimeline.tsx` `STATUS_ORDER` are the hard-coded spots
  (verified). Replace them with a lookup against the owning project's
  `project_statuses`, falling back to a default set for project-less tasks.
- Seed two sets (§6 of `05`): **Delivery** (Not Started · In Progress · UAT ·
  On Hold · Done · Rejected) and **Ticket** (New · In Progress · Pending ·
  Pending Confirmation · Closed). These are data, editable in Admin.
- Admin screen exposes: status sets (add/rename/recolour/reorder/delete, exactly
  like Project Settings already does), plus lists for `type`, `plan_class`,
  `request_type`, `priority`. All plain config tables.

This is the single change that makes "each register has its own vocabulary"
true without any new entity.

## 10 · Saved views and defaults

- Remember the last project filter, sort and grouping per user (localStorage).
- Offer "New Request" and "In Plan" as quick view buttons on the dashboard that
  deep-link into the table with the filter pre-set.

## 11 · Mobile

- The table collapses to cards at narrow widths (the codebase already has this
  pattern for projects). Each card shows title, project, status dot, progress
  bar, due date, assignee initials — the same information, reflowed.
- Filters move into a bottom sheet.
- Quick-add stays pinned; the inspector opens full-screen (already does).
- Bulk selection is hidden on mobile (tap = open); bulk actions are desktop-only.

## 12 · Accessibility & keyboard

- The table is a real `<table>` with `th scope`, or a grid with roles; focus is
  visible (the design already uses `:focus-visible`).
- All inline edits are reachable by keyboard (Enter to edit, Esc to cancel).
- Status and progress are announced with their labels, not just colour.
- The progress bar is accompanied by the numeric text (it already is).

## 13 · Performance

700+ rows is trivial for a server-rendered or single-fetch list. Requirements:

- Fetch once, filter/sort/group client-side (no per-keystroke network calls).
- Debounce search; index nothing for this size.
- The SSE live-update already in place refreshes the table in place (keep it);
  it must not reload the page, only re-fetch the task list.

## 14 · Onboarding / first run

On a fresh database, the seed already provides demo projects/tasks. Add a
one-time hint on the Tasks screen: "This is every task, one list. Use the
Project filter to see only project work." — nothing more; the product must not
need a tutorial.

## 15 · Build map (for implementation, later)

| Phase | Change | Where |
|---|---|---|
| 1 | six columns + `links` + `task_members` | one migration (SQLite + Postgres); `types/index.ts` |
| 2 | status-from-config | `types/index.ts`, `lib/importConfig.ts`, `components/GanttTimeline.tsx`, `components/KanbanBoard.tsx` |
| 3 | unified table | `app/(app)/tasks/page.tsx` (default scope, project filter, project column, wording) |
| 4 | links UI + members UI | `components/TaskInspector.tsx` (task), project detail (panel) |
| 5 | Admin config | new `app/(app)/admin/page.tsx` + API routes |
| 6 | rollups on dashboard | `lib/dashboard.ts`, `components/DashboardView.tsx` |

## 16 · Assumptions to confirm later (not blocking)

1. `type` and `plan_class` are scoped to **projects only**; tasks use `tags` to
   say what kind of follow-up they are (BAU / adhoc / incident). If tasks need a
   real `type` too, it is one more column, same pattern.
2. `links.progress_percent` and `links.title` are typed by the user **for now**;
   the live-query swap later is out of scope for the demo.
3. The Admin screen is new surface; if you would rather configure these lists in
   code for now, phase 5 drops and the lists are seeded constants.
