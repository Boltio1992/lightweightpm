# Combine Report — study & build plan

Source studied: `combine sample.xlsx` (4 sheets)
- `Combine Report` — the target layout (18 columns, empty).
- `Ticket IT service category` — 17 cols, 2 sample rows.
- `Change Release` — 17 cols, 5 sample rows.
- `Change Request` — 14 cols, 2 sample rows.

---

## 1 · What each source actually contains

| Sheet | ID column | Title column | Requester | Dept / Branch | Work % | Status columns | Handler | Description |
|---|---|---|---|---|---|---|---|---|
| **Ticket** | `Ticket ID` (181772) | `Title` | `Requestor` (no ID, no position) | `Department`, `Branch` | **none** | `Status` (Closed…) + `Priority` | `Assigner` (multi-line list) | `Description` ✔ |
| **Change Request** | `Ref No` (CREQ-26-08-0087) | `Request Title` | `Requester` + `Requester Id` + `Position` | `Requester Department/Branch` | `technical Percent` | `Status` (approval: approve/transfer) **and** `technical Status` (Not yet start) | **none** | **no description column** |
| **Change Release** | `Ref No` (CREL-26-08-0062) + `Request Ref No` (parent CREQ) | `Release Title` **and** `Request Title` | `Requester` + `Id` + `Position` | `Requester Department/Branch` | `technical Percent` | `Status` (approval: `[HOD] Final Approved`) **and** `technical Status` | **none** | **no description column** |

Two things the samples make obvious:

1. **CR / CREL carry two different statuses.** `Status` is the *approval* state (`[HOD] Final Approved`, `transfer`, `approve`); `technical Status` is the *work* state (`Not yet start`). Only the second one maps to PM-Status (Kanban).
2. **A Change Release row already contains its parent Change Request** (its own `CREL` ref, plus `Request Ref No` = `CREQ`, plus both titles and both dates). So a release can either be one combined row, or two rows (release + request) — that is a real decision, see §5.

---

## 2 · Field-by-field mapping into `Combine Report`

| # | Combine column | Ticket | Change Request | Change Release | Rule |
|---|---|---|---|---|---|
| 1 | **No** | — | — | — | Generated after sorting (default: Request Date desc, then Source, then Ref No). Never taken from source (their `No` values collide across sheets). |
| 2 | **Ref No** | `Ticket ID` | `Ref No` | `Ref No` (CREL) | Keep verbatim, add `Source` column so the 3 ID schemes stay distinguishable. |
| 3 | **Request Title** | `Title` | `Request Title` | `Release Title` (parent request title kept in `Related Request Title`) | See decision Q3. |
| 4 | **Request Date** | `Request Date` (`01/Sep/2026, 01:10 PM` — needs parsing) | `Request Date` (ISO `2026-08-31`) | `Request Date` (ISO) | Normalise to `yyyy-mm-dd`. Release date goes to a separate column (below). |
| 5 | **Requester** | `Requestor` | `Requester` | `Requester` | Trim, title-case is left as-is (names are already upper-case). |
| 6 | **Requester ID** | **NA** | `Requester Id` | `Requester Id` | Ticket export has no staff ID → `NA`. |
| 7 | **Request Department** | `Department` | `Requester Department` | `Requester Department` | Verbatim. |
| 8 | **Request Branch** | `Branch` | `Requester Branch` | `Requester Branch` | Verbatim. |
| 8b | **Requester Position** | **NA** | `Requester Position` | `Requester Position` | Ticket export has no position → `NA`. |
| 9 | **Application Name** | **NA** → use ticket category | `Application Name` | `Application Name` | Ticket uses `Category` (3 levels) instead — see §3. |
| 10 | **Apply For** | **NA** | `Apply For` | `Apply For` | Ticket has no equivalent. |
| 11 | **Technical Percentage** | **derived** | `technical Percent` | `technical Percent` | Ticket: no % column → rule: `Closed`/`Resolved` → 100, otherwise `0`. Empty CR/CREL cells → `0`. |
| 12 | **PM-Status** | map from `Status` | map from `technical Status` | map from `technical Status` | See §4. Approval status kept in its own column. |
| 13 | **Handle By** | `Assigner` (split the `- name` lines, join with `, `) | **NA** | **NA** | CR/CREL exports have no handler column → `NA`, then filled in by hand in the app. |
| 14 | **Plan/New** *(In Plan)* | manual | manual | manual | Not derivable from any export. Default `NA`, editable inline, bulk-settable. |
| 15 | **Type** | suggested auto-rule | suggested auto-rule | suggested auto-rule | Not in the exports. Auto-suggest + manual override — see §4. |
| 16 | **Description** | `Description` | fallback: `Request Title` | fallback: `Request Title` | CR/CREL sample has **no description column** — needs confirming (Q4). |
| 17 | **Recommend** | manual | manual | manual | PM comment, typed in the app. |

### Extra columns I recommend adding

These cost nothing and make the report filterable the way you described:

| Column | Why |
|---|---|
| `Source` (Ticket / Change Request / Change Release) | Three ID schemes live in one `Ref No` column — you need to slice by source. |
| `Related Ref No` (+ `Related Request Title`) | For a release row, the parent CREQ. Otherwise the link is lost. |
| `Approval Status` | `[HOD] Final Approved`, `transfer`, `approve` — real information you would otherwise overwrite. |
| `Release / Close Date` | Ticket `Close Date`, CREL `Release Date`. Lets you measure turnaround. |
| `Ticket Category L1 / L2 / L3` | `IT Services` / `Reporting` / `Mobile Reporting`. |
| `Priority`, `Issue Type`, `Environment` | Ticket-only, but they drive triage. |

---

## 3 · Ticket category vs Application Name (your Q9)

Sample value: `IT Services/Reporting/Mobile Reporting` → category / sub-category / item.

**Recommendation: keep them separate.**
- `Application Name` = CR / CREL only; `NA` for tickets. Keep its meaning clean so application filters stay accurate.
- New `Ticket Category L1 / L2 / L3` = tickets only; `NA` elsewhere.
- If you want one column for a quick glance, add a derived **`Service Area`** = `Application Name` for CR/CREL, `L1 › L2` for tickets. It is display-only; the real columns stay filterable.

Collapsing a 3-level path into `Application Name` would break any group-by on application, because ticket rows would never group with the CR rows for the same system.

---

## 4 · Normalisation rules

**PM-Status** (must be one of: Completed, Hold, Not Started, Progress, Reject, UAT)
- From `technical Status` / ticket `Status`: `Not yet start` → **Not Started**; `in progress` / `on going` → **Progress**; `UAT` → **UAT**; `completed` / `done` / `closed` → **Completed**; `hold` / `pending` → **Hold**; `reject` / `cancel` → **Reject**.
- Unmapped values land in `Not Started` and are flagged in the import preview so we can extend the table.
- ⚠️ I only see 4 distinct values in the sample. **Please send the full distinct list** of `Status` and `technical Status` from the real exports so the mapping table is complete on day one.

**Type** (CR, In-house, Project Implement, Report Implement) — suggested, always overridable:
- `Ref No` starts with `CREQ`/`CREL` → **CR**
- Ticket `Category` contains `Reporting`/`Report`, or title mentions Jasper/report → **Report Implement**
- Title/request mentions implement / rollout / migration / new app / go-live → **Project Implement**
- otherwise → **In-house**

**In Plan / New / Adhoc** — manual. Default `NA`. Plan: a select in the grid plus multi-row bulk set, because you will classify these in batches.

**De-duplication** — upsert on `(source, ref_no)`. If a CREQ appears both as its own row and as a release's parent, keep both but mark the request row `Related Ref No = CREL…` so the pair is visible and never double-counted in % totals.

---

## 5 · Decisions — confirmed

1. **Data model:** own "Combine Report" module (own table) **+ optional task link** that syncs PM-Status / % into the Kanban.
2. **Change Release:** **one row per release** — `Ref No` = CREL, parent CREQ in `Related Ref No`.
3. **Release row title:** **`Release Title`**; parent request title in `Related Request Title`.
4. **Ticket category:** **separate `Ticket Category L1 / L2 / L3`** columns; `Application Name` is CR/CREL only, with a derived `Service Area` for display.

Still open (needs the real exports):
- Do the real CR / CREL exports have a `Description` column? The sample does not — currently falling back to the request title.
- Full distinct values for `Status` and `technical Status` so the PM-Status mapping table is complete.

---

## 6 · Proposed build (LightPM)

**Phase 0 — lock the dictionary (needs you)**
Full distinct values for `Status`, `technical Status`, `Apply For`, `Application Name`, and every `Category` path. Then the mapping tables are final.

**Phase 1 — data model** (`supabase/migrations/2026xxxx_combine_report.sql`)
New table `requests` (one row per source record) with: `source`, `ref_no`, `related_ref_no`, `title`, `related_title`, `request_date`, `release_or_close_date`, `requester`, `requester_id`, `requester_position`, `department`, `branch`, `application_name`, `apply_for`, `ticket_category_l1/l2/l3`, `technical_percent`, `pm_status`, `approval_status`, `handle_by`, `in_plan`, `type`, `description`, `recommend`, `priority`, `issue_type`, `environment`, `raw jsonb`, `linked_task_id uuid null references tasks(id)`, `created_at`/`updated_at`. Unique index on `(source, ref_no)` for upsert. RLS + `NOTIFY pgrst, 'reload schema'` at the end, like the existing migrations.

**Phase 2 — import**
Extend the existing Excel import (`components/ImportModal.tsx`, `lib/importConfig.ts`, `xlsx` is already a dependency): upload the 3-sheet workbook (or 3 files), auto-detect each sheet **by header signature** (not by sheet name), run the normalisation rules, and show a **preview grid** with per-row warnings (unmapped status, missing %, duplicate ref) before committing. Re-import = upsert, never duplicate.

**Phase 3 — the report screen** (`app/(app)/requests/page.tsx`)
Filterable, sortable table: date range, source, branch, department, application, PM status, In Plan, Type, Handle By. Saved views. Inline editing for the manual columns (`Handle By`, `In Plan`, `Type`, `Recommend`) with autosave. **Export to .xlsx** in exactly the `Combine Report` column order. On phones the rows become cards (same pattern as the projects list).

**Phase 4 — link to work**
"Create task" / "Link task" from a row → a task in a chosen project (or a standalone one), carrying title, description, percent and status. Two-way sync for `PM-Status` ↔ task status and `Technical %` ↔ `percent_complete`; manual columns stay on the request row. PM-Status values can be seeded as project statuses so the Kanban columns match.

**Phase 5 — polish**
Bulk edit, import history (what changed on the last re-import), and a "Needs attention" style view driven by `In Plan` + `PM-Status` instead of task dates.

**Order:** 0 → 1 → 2 → 3 (this is the usable report) → 4 → 5.

---

## 7 · Current bugs — status

| Bug | Status |
|---|---|
| Task creation: cannot type in Title / Description | **Fixed.** Root cause: the form-reset effect in `components/TaskModal.tsx` depended on `projectStatuses`, which defaults to a fresh `[]` on every render, so it re-ran after every keystroke and cleared the field. Now keyed on primitives (`taskId`, `statusKey`). |
| Mobile UI | **Work done, needs your eyes.** Touch targets, full-screen/bottom-sheet modals, phone card layouts for the dense tables, Gantt label column, command palette as a phone sheet, safe-area handling. Everything is behind `sm:`/`lg:` or `(pointer: coarse)` so desktop is untouched. |

Both are in the working tree, uncommitted, and `tsc --noEmit` + `next build` pass.
