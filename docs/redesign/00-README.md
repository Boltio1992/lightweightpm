# Redesign pack — analysis, plan and mockup

> ## ⚠️ DIRECTION CHANGED — read `05-light-plan.md` first
>
> Documents `01`–`03` and `mockup.html` answered the analysis pack **literally**:
> they designed a new normalized system (14 entities, decisions, approvals,
> alerts, RBAC) modelled on the legacy workbook. **That is the wrong target.**
>
> The actual goal is **LightPM plus the legacy workflow, kept light and minimal** —
> the legacy registers are just project and task tracking, so they map onto
> LightPM's existing `projects` and `tasks` rather than onto new entities.
>
> **`05-light-plan.md` is the current direction.** It reduces the work to five new
> columns, two seeded status sets, and one contained status-configuration change.
>
> Everything below is retained only as **evidence and reference** — in particular
> `04-evidence-appendix.md`, which is measured fact about the legacy workbook, and
> `01-capability-map.md`, which is an accurate account of what LightPM has today.

Prepared from the sanitized analysis pack (`_source/analysis-pack.md`) against
the current LightPM application. **No application code was changed.**
Everything here is a document or a standalone mockup, for your review and
confirmation before implementation starts.

---

## What is here

| File | What it is |
|---|---|
| [`01-capability-map.md`](01-capability-map.md) | 46 requirements mapped to current LightPM capability, each verdict backed by `file:line`. Verdicts: **19 Unavailable · 19 Needs extension · 5 Reusable as-is · 3 Needs new development**, plus a reconciliation with the earlier `docs/combine-report-plan.md`. |
| [`02-gap-analysis.md`](02-gap-analysis.md) | 30 priced gaps (impact, solution, S/M/L complexity, dependency, risk), the top 10 by consequence, and a sequencing table. |
| [`03-target-model-and-workflows.md`](03-target-model-and-workflows.md) | The normalized target model: entities, field-level definitions, how the six status dimensions are stored independently, configuration vs transactional split, four workflow specs, audit model, indexing/retention, and the decisions needing your sign-off. |
| [`mockup.html`](mockup.html) | A standalone interactive mockup — **double-click to open it**. No network requests, no build step. Seven screens, synthetic data only. |
| [`04-evidence-appendix.md`](04-evidence-appendix.md) | What the legacy workbook actually contains, measured: vocabularies, defect counts, and three corrections to the brief's assumptions. |

Open the mockup by opening `mockup.html` in a browser. It carries a permanent
"SYNTHETIC" banner and contains no real data of any kind.

---

## Coverage of the brief's ten requested deliverables

| # | Brief's deliverable | Status |
|---|---|---|
| 1 | Capability map | ✅ `01` |
| 2 | Gap analysis | ✅ `02` |
| 3 | Target data model | ✅ `03` §1–4 |
| 4 | Workflow specification | ✅ `03` §5 |
| 5 | UI specification | ✅ `mockup.html` (visual) |
| 6 | Security model | ⚠️ gaps identified in `02`, no dedicated design |
| 7 | Integration design | ⚠️ not yet written |
| 8 | Migration strategy | ⚠️ not yet written |
| 9 | Synthetic test pack | ⚠️ the mockup carries synthetic data; no test pack |
| 10 | Phased plan | ⚠️ `02` sequences the gaps; no costed phase plan |

Items 6–10 are deliberately not invented yet — say the word and I will produce
them as documents, still without touching application code.

---

## Headline findings (all verified against the code, not assumed)

1. **The current app has no Request concept.** Every record is either a project
   or a task. No intake, requester, department, application, decision, approval
   or alert concept exists anywhere in the model.
2. **Access control is much weaker than it looks.** `isProjectMember` is called
   in exactly one place (task creation) and `isProjectAdmin` in exactly one
   (project mutation). `PATCH` and `DELETE /api/tasks/[id]` check only
   `requireUser()` — and `project_id` is itself patchable — so **any logged-in
   user can edit or delete any task**, and the `viewer` membership role gates
   nothing at all. The brief's requirement for role-based access, record scope
   and confidentiality is therefore a from-scratch build, not a tweak.
3. **Progress is already contradictory.** `projects.percent_complete` is stored,
   range-validated and **never read**: the projects API computes the mean of task
   percentages, the dashboard computes done/total, and the earlier plan would
   have added a third. Three answers to one question, today.
4. **Audit history is shallower than it appears.** `task_activity` captures
   **3 of 12** patchable task fields, has no project or configuration coverage,
   stores from/to inside a prose string, and is produced only by the task PATCH
   path. The dashboard counts completions by substring-matching that prose
   (`lib/dashboard.ts:186`, `%to done`). Deleting a task cascades its history away.
5. **The importer validates well but cannot migrate.** It rejects bad rows with
   per-row reasons — genuinely good — but commits on upload, always inserts, so
   re-import duplicates everything; there is no dry run, mapping or rollback.
6. **The brief's "mixed progress formats" claim is wrong in a useful way.** The
   real workbook uses decimal fractions (0–1) consistently; the actual defect is
   a scale inconsistency (2 cells hold `100` where the rest hold `1.0` — a latent
   100× error), plus 60–100% blank rates meaning "not measured".
7. **The brief's "no single status field" rule is vindicated by evidence.** The
   workbook carries **four separate status vocabularies** (delivery, ticket,
   study, vendor) with casing drift (`NOT_YET_START` / `Not Yet Start`), and
   `Priority` contains both `Urgent` (152) and `urgent` (12) as distinct values.

---

## One defect I should flag before anything else

While cross-checking the capability map I found a bug **in the local-first build
I delivered earlier** — inherited from the original in-memory mock, but now the
primary code path:

The mock client implements `select, insert, update, delete, eq, is, not, in, or,
order, limit, single, maybeSingle`. The app also calls **`.gte()`**, **`.like()`**
and **`.neq()`**, which **do not exist**:

- `lib/dashboard.ts:185-186` calls `.gte(...).like(...)` for the 14-day
  completion trend → throws → is swallowed by the surrounding `try/catch` → the
  chart **silently falls back to an estimate**. The dashboard looks fine and is
  not measuring what it claims.
- `app/api/dev/clear` calls `.neq(...)` → throws inside its own `try/catch` →
  harmless (the real clearing happens via `clearMockStore`) but logs a
  misleading "Error clearing external DB" every call.

Against real Supabase these worked, so this is a **fidelity regression specific
to local-first mode**. The fix is small — implement `gte`, `lte`, `gt`, `lt`,
`like` and `neq` in the builder — and I have not applied it because you gated
coding. Recommend making it the first change once you confirm.

---

## What I need from you before any implementation

These are the decisions I cannot make for you. The first three block the data
model; the rest shape behaviour.

1. **Access control scope.** Is `viewer` intended to be read-only? Should a
   record be visible to everyone, or scoped by department / handling team /
   explicit confidentiality flag? (Today: everything is visible to everyone.)
2. **Status vocabulary ownership.** Do we keep the four separate vocabularies
   (delivery / ticket / study / vendor) as per-type configuration, or harmonise
   them into one? Who maintains them, and may a new status be added without a
   code change? (The design assumes: per-type configuration, editable in the app.)
3. **Progress.** Confirm canonical storage as an integer 0–100. Keep the
   previous/current pair as progress history? Who may override a calculated
   percentage, and must the override carry a reason and an approver?
4. **Model shape.** The design replaces the earlier flat `requests` table with a
   `work_items` base plus typed extensions, so a study can be converted into the
   delivery item it produces while keeping the link. Confirm that direction.
5. **Approvals.** Which stages need a decision, who may decide, and do
   `defer` / `return for information` / `delegate` apply to every work-item type
   or only some?
6. **Alerts.** Which business calendar (which holidays), what thresholds, who
   receives an escalation, and by what channel — in-app only, or also email?
   (In-app only is what the current stack can do without new infrastructure.)
7. **Audit and retention.** Must `audit_events` be immutable and never cascade
   on delete? How long is history retained? (The design says: append-only, no
   cascade — confirm.)
8. **Migration.** Is the legacy workbook the migration source, and who signs off
   the field mapping and the cleansing rules? Approximately 700 rows across 8
   registers — cheap to load, and where the real effort sits is mapping.

Two further items the capability map could not resolve from the code at all:
the platform-level role semantics (is `role='admin'` on `users` meant to mean
something?), and whether the seeded demo rows are intended as fixtures.

---

## Recommended next step

1. Read `mockup.html` and `03-target-model-and-workflows.md` — one visual, one
   structural; together they carry the whole proposal.
2. Answer the eight decisions above (even rough answers unblock the rest).
3. Tell me whether to produce the five missing deliverables (security model,
   integration design, migration strategy, synthetic test pack, phased plan).
4. On your confirmation, implementation starts — and the first change would be
   the query-method fix above, because the redesign's whole value depends on
   status and progress numbers being trustworthy.
