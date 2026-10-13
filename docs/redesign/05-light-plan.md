# LightPM + legacy workflow — light plan

Direction: **keep LightPM as it is; absorb the legacy way of tracking into it.**
Projects and tasks only — no new entity types.

> Supersedes `01`–`03` and `mockup.html` for direction (they designed a new
> system from the analysis pack; that was the wrong target). `04-evidence-appendix.md`
> stays valid as measured fact.

---

## 1 · Core insight

The legacy workbook is **project and task tracking**. Most of it maps onto what
LightPM already has; the register a row came from becomes a `type` value, not a
table.

| Legacy sheet | Rows | Becomes |
|---|---|---|
| Data Tracking · New CR · Study · Report Implement | 257 | **Projects** |
| BAU, and their own follow-up lists | 91+ | **Tasks** |
| Ticket · Change Request · Change Release | — | **external — referenced, not stored** (§3) |
| CBS transaction | 5 | out of scope |

## 2 · Settled decisions

| # | Decision |
|---|---|
| 1 | **Ticket / Change Request / Change Release stay in their own systems.** LightPM stores a *reference* to them, never the records. Nothing is imported for them and no new entity appears. |
| 2 | **Every project and every project-less task carries a link** to a Ticket / CR / CRL reference. |
| 3 | **`handle_by` is not a field — it is members.** LightPM already has `project_members` with roles; a task currently has only a single `assignee_id`. |
| 4 | **Labelling: `In Plan` or `New Request`**, and a New Request also carries a *request type* (e.g. `Adhoc meeting`). Both are configurable lists. |
| 5 | **One task table.** All tasks appear in a single list; the ones inside a project are filtered out on demand. The current split is presentation only — see §5. |
| 6 | **Progress: one number** (`percent_complete`, already 0–100 and validated). The workbook's Previous/Current pair existed because it was a *monthly snapshot*; keeping it would re-introduce the manual roll-forward you are trying to leave behind. |

## 3 · What LightPM already covers (do not rebuild)

Per-project status columns that are stored as data (`project_statuses`) · tasks
with sub-tasks, assignee, priority, duration, tags, comments and activity ·
board, list, timeline, dashboard with ageing and overdue · Excel import with
per-row validation · users, membership, roles.

So the legacy "workflow" is mostly **vocabulary plus a few columns** — not
machinery.

## 4 · Fields to add

Six small columns and one link. Everything else maps onto fields that exist.

| New | On | Why |
|---|---|---|
| `reference_no` | projects | every register keys off a human reference (`PRO-25-08-0012`) |
| `reference_no` | tasks | their own follow-up items are referenced too |
| `type` | projects | tells the registers apart (`CR`, `Project`, `Study`, `Report`, `Automation`) |
| `plan_class` | projects | `In Plan` / `New Request` |
| `request_type` | projects | `Adhoc meeting`, … only meaningful for a New Request |
| link to Ticket / CR / CRL | projects **and** tasks | decision 2 above |

Reuses what exists:

| Legacy column | Maps to |
|---|---|
| Name / Request Title | `projects.name` / `tasks.title` |
| Description | `description` |
| Estemate Start · Finish · Request Date · Release Date | `start_date`, `end_date`, `due_date` |
| %Complete | `percent_complete` |
| Status · technical Status | the project's status set (§6) |
| Priority · Complexity | `priority`, plus `tags` for complexity |
| Service Type · Environment · Issue Type · Category · Apply For | `tags` (free-form, already supported) |
| Department Owner · Owner · Technical Resource · Assigner | `owner_id` / `assignee_id` / `project_members` |
| Technical Pickup · Done in Month · Impl. Year | not needed |

Rule of thumb: if a value is only used for grouping and filtering, a tag is
enough — it costs nothing and adds no schema.

## 5 · The one task table

This is a **view change, not a schema change** — `tasks.project_id` is already
nullable and the API already returns everything. The split exists only because
`app/(app)/tasks/page.tsx` defaults to `useState<Scope>("standalone")` and labels
itself *"Standalone tasks live here"*.

| Change | |
|---|---|
| Default scope | all tasks, not "standalone" |
| Toggle → filter | *All projects · No project · each project* |
| Add column | Project, so both kinds sit in one table |
| Wording | remove "standalone" from the UI; label project-less items by their type/tag, not by the absence of a project |
| Keep | the project detail's Tasks tab — the same data, pre-filtered |

## 6 · Status vocabularies become configuration

The workbook uses four vocabularies. LightPM already stores status sets as data
per project, so this is **seeding, not schema**:

| Set | Values | For |
|---|---|---|
| Delivery | Not Started · In Progress · UAT · On Hold · Done · Rejected | CR, Project, Study, Report |
| Ticket | New · In Progress · Pending · Pending Confirmation · Closed | ticket-like work, if any is tracked in LightPM |

One genuine code change: task statuses are **hard-coded** in
`types/index.ts` (`TASK_STATUSES`), `lib/importConfig.ts` (`TASK_STATUS_KEYS`)
and `components/GanttTimeline.tsx` (`STATUS_ORDER`). They must read the project's
status set instead. That single edit is what unlocks per-type workflow.

## 7 · Deliberately not built

Request entity · studies as separate entities · decision records · approval
engine · links/dependencies graph · audit event store · alert engine with business
calendars · RBAC and record confidentiality · master-data tables · the six status
dimensions · progress history.

Trade-off stated plainly: with one status and one progress number you cannot
report *"approved but not started"* separately from *"started but blocked"*. The
registers do not report that today either, so nothing is lost now.

## 8 · Phases

| Phase | Work | Size |
|---|---|---|
| 1 | The six columns + the reference link (one migration, SQLite + Postgres). | S |
| 2 | Task statuses read the project's status set; seed the two sets. | S |
| 3 | One task table: default scope, project filter, project column, wording. | S |
| 4 | Import: reference-based upsert + preview; map the registers. | M |
| 5 | Optional later: previous/current progress history; approvals. | — |

## 9 · Open questions

1. **Reference link: one per kind, or many?** Can a project point at several
   tickets, or one Ticket + one CR + one CRL at most? *One each → three nullable
   columns. Many → one small `links` table.*
2. **Task members: one person or several?** If several, tasks need a member list
   mirroring `project_members`; if one, the existing `assignee_id` is enough.
3. **`request_type` values** — the full list for *New Request* (so far:
   `Adhoc meeting`).
4. **Is the workbook the import source, and how often re-imported?** Decides how
   much idempotency the importer needs.
