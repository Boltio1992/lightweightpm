# 03 — Normalized target data model and workflow specification

Scope: design only. Extends the existing LightPM tables (`users`, `projects`,
`project_statuses`, `project_members`, `tasks`, `task_comments`,
`task_activity`). Implementable unchanged in SQLite (`node:sqlite`) and Postgres.
Types below are Postgres; the SQLite mirror is mechanical — `uuid`→`text`,
`timestamptz`/`date`→`text` (ISO-8601), `boolean`→`integer` 0/1, `jsonb`→`text`
holding JSON — as `schema.sqlite.sql` documents today. Evidence:
`04-evidence-appendix.md` (per-sheet status vocabularies); the vocabulary report
is held outside the repo because it carries real value lists. Below, "FK" means a
`uuid` reference to the named table, nullable unless stated, and "uq" means a
unique constraint.

## 1 · Target entities

Extend first: `work_items` is the base record and `projects`/`tasks` become typed
records hanging off it. Only genuinely new concepts get new tables.

| Entity | Purpose | Key relationships | Status |
|---|---|---|---|
| `work_items` | One row per request, study, delivery item or operational item | PK `id`; FK `work_item_type_id`; referenced by `projects`, `tasks`, `assessments` | New |
| `requests` | Intake demand before approval; the prior plan's `requests` slice | `work_item_id` 1:1; `requester_user_id`, `org_unit_id` | New (replaces the flat prior table) |
| `projects` | Delivery item (project, CR, report, automation) + Kanban board | `work_item_id`; keeps `project_statuses` | Existing (extended) |
| `tasks` | Execution activity, incl. operational next actions | `project_id` (nullable, unchanged); `work_item_id` | Existing (extended) |
| `users` | Actor identity for login, ownership, audit | `org_unit_id`; self-FK `manager_user_id` | Existing (extended) |
| `project_statuses` | Per-project Kanban columns = task-status dimension | `project_id` (unchanged); + `task_status_value_id` | Existing (extended) |
| `project_members` | Project-scoped RBAC | unchanged | Existing (unchanged) |
| `task_comments` | Narrative update / communication | unchanged | Existing (unchanged) |
| `task_activity` | Task event log; superseded for audit by `audit_events` | unchanged | Existing (unchanged) |
| `work_item_types` | Config registry: code, label, ref prefix, default status sets | referenced by `work_items`, `status_sets`, `transition_rules` | New |
| `org_units` | Business Unit A, Control Unit D … | `parent_id` self-FK, `path` | New |
| `teams` | Team Core, Team Apps … | `org_unit_id` → `org_units` | New |
| `team_members` | User ↔ team | `team_id`, `user_id` | New |
| `applications` | System Alpha, Integration Hub … service inventory | referenced by `work_items` | New |
| `application_services` | Technical service under an application | `application_id` → `applications` | New |
| `status_sets` | One configurable vocabulary = one status dimension for one type | `work_item_type_id`, `dimension` | New |
| `status_values` | Members of a set; `is_terminal`, `semantic_key`, `color` | `status_set_id` → `status_sets` | New |
| `work_item_type_status_sets` | Which set supplies which dimension per type | `work_item_type_id` + `dimension` → `status_set_id` | New |
| `transition_rules` | Allowed state changes, guards, permissions per type | `status_set_id`, `from_status_id`, `to_status_id` | New |
| `required_field_rules` | Fields required per type/stage/transition | `status_set_id`, `to_status_id` | New |
| `assessments` | Study/BRD phase, recommendation, decision, quarter | `work_item_id` → `work_items` | New |
| `links` | Typed link: study→delivery, CR→release, dependency, external | `from_work_item_id`, `to_work_item_id`, `link_type` | New |
| `milestones` | Planned checkpoints of a delivery item | `work_item_id` | New |
| `work_item_risks` | Risk/issue with owner, severity, due date | `work_item_id`; `owner_user_id` | New |
| `progress_snapshots` | Dated measurements (previous/current pair) | `work_item_id`; `source` | New |
| `decisions` | Approve / reject / defer / withdraw / return / delegate | `work_item_id`; `decision_status_id` | New |
| `assignments` | Role-based ownership by user or team | `work_item_id`; `user_id`/`team_id`; `role_code` | New |
| `work_item_activity` | Narrative update stream for any work item | `work_item_id` | New |
| `audit_events` | Append-only field changes, transitions, decisions, assignments, config | `entity_table`, `entity_id`; `actor_user_id` | New |
| `alert_rules` | MON-001…MON-008 thresholds as data | `work_item_type_id`, `scope_org_unit_id` | New |
| `alert_events` | Raised alerts, recipient, level, acknowledgement | `alert_rule_id`, `work_item_id` | New |
| `business_calendars`, `calendar_holidays` | Working-day basis for "3 working days" rules | `calendar_id` | New |

`work_items` deliberately carries **no single `status` column**.

## 2 · Field-level model

`work_items` (base, shared by all four types):

| Column | Type | Null | Validation | Notes |
|---|---|---|---|---|
| `id` | uuid | no | PK | app-generated, per app convention |
| `reference_no` | text | no | uq; `^[A-Z]{2,4}-\d{4}-\d{4}$` | REQ-2026-0001; type prefix + year + sequence; never the row number |
| `work_item_type_id` | uuid | no | FK `work_item_types` | drives status sets, forms, workflow |
| `title` | text | no | 3–200 chars | A-01 blocks empty title |
| `description` | text | no | default `''` | rich text deferred |
| `data_classification` | text | no | `SYNTHETIC`\|`INTERNAL` | pack §12 marker |
| `application_id` | uuid | yes | FK `applications` | NULL ⇒ "Unknown", not "not applicable" |
| `org_unit_id` | uuid | yes | FK `org_units` | requesting unit |
| `team_id` | uuid | yes | FK `teams` | handling team (legacy `Handle By`) |
| `requested_at` | timestamptz | yes | ≤ now | intake time, timezone-aware (§7 fix) |
| `planned_start_date` | date | yes | ≤ `target_end_date` | cross-checked (§7 fix) |
| `target_end_date` | date | yes | ≥ `planned_start_date` | |
| `actual_end_date` | date | yes | required when stage is terminal | §10.4 rule |
| `period_key` | text | yes | `^\d{4}-Q[1-4]$` | derived from `target_end_date` unless overridden |
| `progress_percent` | integer | yes | 0–100 | canonical scale; import converts legacy 0–1 fractions |
| `progress_is_override` | boolean | no | default false | |
| `progress_override_reason` | text | yes | required when override true | resolves the inert `projects.percent_complete` seam |
| `lifecycle_stage_id` | uuid | no | FK `status_values` (`lifecycle`) | dimension 1 of 6 |
| `decision_status_id` | uuid | no | FK `status_values` (`decision`), default `Pending` | 2 of 6 |
| `delivery_health_id` | uuid | no | FK `status_values` (`health`), default `Not Assessed` | 3 of 6 |
| `priority_id` | uuid | yes | FK `status_values` (`priority`) | 4 of 6; not the hard-coded `low/medium/high/urgent` |
| `confidential` | boolean | no | default false | A-08 |
| `archived_at` | timestamptz | yes | | |
| `created_by`, `created_at`, `updated_at` | uuid, timestamptz, timestamptz | no | | matches existing convention |

`requests`: `work_item_id` FK uq; `requester_user_id` FK `users`;
`requester_position` text yes; `requester_org_unit_id` FK; `requester_branch`
text yes; `intake_class` text no `InPlan|New`; `business_objective` text yes but
**required by the Submit transition** (A-01); `apply_for` text yes (controlled
list, dimension `scope`); `source_system`, `source_ref` text yes (legacy
provenance, uq together); `related_work_item_id` FK (release→parent CR).

`work_item_types`: `code` no uq; `label` no; `ref_prefix` no
(`REQ`,`STD`,`PRJ`,`OPS`); `is_operational` boolean no; `active` boolean no.

`org_units`: `code` uq; `name`; `parent_id` FK self; `path` text no (`A/B/C`,
denormalised for reporting); `active`. `teams`: `code` uq; `name`; `org_unit_id`
FK; `active`. `team_members`: `team_id`, `user_id`, `role_code`, uq together.
`applications`: `code` uq; `name`; `owner_team_id` FK; `active`.
`application_services`: `application_id` FK; `code`; `name`; `service_type` text
yes (Service Type vocabulary, matched case-insensitively); uq
`(application_id, code)`.

`status_sets`: `work_item_type_id` FK (NULL = shared); `scope_type` text no
`TYPE|GLOBAL|PROJECT`; `scope_key` text no (sentinel `GLOBAL`, never NULL, so
`uq (scope_type, scope_key, dimension)` holds in both engines); `dimension` text
no `lifecycle|decision|health|priority|scope|task|study|brd|milestone|severity`;
`name`; `active`.
`status_values`: `status_set_id` FK; `code` (normalised: uppercase, separators
collapsed — absorbs `NOT_YET_START`/`Not Yet Start`); `label`; `semantic_key`
text yes (`DONE`, `UAT`, `STUDY`; lets `Done`≈`Closed` per register); `color`
default `#9AA1AC`; `sort_order`; `is_terminal` boolean; `is_exception` boolean;
`active`; uq `(status_set_id, code)`.
`work_item_type_status_sets`: `work_item_type_id`, `dimension`, `status_set_id`
FK; uq together.
`transition_rules`: `work_item_type_id`; `status_set_id` FK; `from_status_id` FK
yes (NULL = any); `to_status_id` FK; `transition_code`; `requires_reason`
boolean; `requires_fields` text (JSON array); `allowed_roles` text (JSON array);
`active`; uq `(work_item_type_id, from_status_id, to_status_id)`.
`required_field_rules`: `work_item_type_id`, `status_set_id`, `to_status_id`
yes, `field_path`, `enforced_at` `MESSAGE|TRANSITION|CLOSE`, `message`.

`assessments`: `work_item_id` FK; `study_state_id` FK (dimension `study`);
`brd_state_id` FK (`brd`); `owner_user_id` FK; `target_period` text yes;
`recommendation` text yes; `decision_id` FK; `recommended_type_id` FK (what it
should convert into); `start_date`, `end_date` date yes.
`links`: `from_work_item_id` FK; `to_work_item_id` FK yes; `to_external_ref`
text yes (vendor/interface dependency); `link_type` text no
`CONVERTS_TO|PARENT_OF|DEPENDS_ON|DUPLICATE_OF|RELATES_TO`; `note` text yes;
`created_by`, `created_at`.
`milestones`: `work_item_id` FK; `name`; `due_date` date yes; `actual_date` date
yes; `state_id` FK (dimension `milestone`); `sort_order`.
`work_item_risks`: `work_item_id` FK; `title`; `severity_id` FK (`severity`);
`response` text yes; `owner_user_id` FK; `due_date` yes; `state_id` FK
(`severity` state set); `escalated_at` timestamptz yes.
`progress_snapshots`: `work_item_id` FK; `measured_on` date; `percent` integer
0–100; `source` text no `CALCULATED|MANUAL|IMPORTED`; `recorded_by` FK; uq
`(work_item_id, measured_on, source)`.
`decisions`: `work_item_id` FK; `decision_status_id` FK (`decision`);
`decided_by` FK; `delegated_from` FK; `decided_at` timestamptz; `rationale` text
yes (required unless `Approved`); `from_lifecycle_stage_id`,
`to_lifecycle_stage_id` FK.
`assignments`: `work_item_id` FK; `user_id` FK yes; `team_id` FK yes (exactly
one non-null); `role_code`; `assigned_by` FK; `assigned_at`; `ended_at` yes; uq
`(work_item_id, user_id, team_id, role_code, ended_at)`.
`work_item_activity`: `work_item_id` FK; `author_user_id` FK yes; `kind` no
`UPDATE|COMMENT|MEETING|HANDOVER`; `body`; `created_at`.
`audit_events`: `entity_table` text no; `entity_id` uuid no; `event` text no
`FIELD_CHANGE|STATUS_TRANSITION|DECISION|ASSIGNMENT|CONFIG_CHANGE|CREATE|DELETE`;
`field` text yes; `old_value`, `new_value` text yes; `from_status_id`,
`to_status_id` FK yes; `reason` text yes; `actor_user_id` FK; `occurred_at`;
`source` no `UI|IMPORT|JOB|API`.
`alert_rules`: `code` uq (`MON-001`); `work_item_type_id` FK yes;
`condition_json` jsonb; `threshold_value` integer yes; `threshold_unit` no
`HOURS|WORKING_DAYS|CALENDAR_DAYS`; `escalation_level`; `recipient_role_code`;
`active`. `alert_events`: `alert_rule_id` FK; `work_item_id` FK; `raised_at`;
`recipient_user_id` FK yes; `level`; `message`; `acknowledged_at`,
`acknowledged_by` yes.
`business_calendars`: `code` uq, `name`, `working_day_mask`, `active`;
`calendar_holidays`: `calendar_id` FK, `holiday_date`, `label`, uq together.
Without these the working-day alerts have no basis.

Extensions (only added columns; nothing dropped) — `users`: `org_unit_id`,
`manager_user_id`, `external_ref`, `is_active`; `title` retained.
`projects`: `work_item_id` FK uq, `work_item_type_id`, `priority_id`, `ref` text
uq. **`projects.status` stays** (Kanban lane). `tasks`: `work_item_id` FK,
`task_status_value_id` FK, `follow_up_date` date yes, `outcome` text yes;
`percent_complete` retained. `project_statuses`: `task_status_value_id` FK.
`work_items` is reached from `projects`/`tasks` by the FK above — no junction
table is needed in either engine.

## 3 · The six status dimensions in storage

| Dimension | Stored in | Vocabulary source | Relation to existing fields |
|---|---|---|---|
| Lifecycle stage | `work_items.lifecycle_stage_id` | `status_values` `dimension='lifecycle'` | Replaces `projects.status` as the *reporting* stage; `projects.status` keeps driving the Kanban board only |
| Decision status | `work_items.decision_status_id` + `decisions` | `dimension='decision'` | New; nothing in the current schema represents it |
| Delivery health | `work_items.delivery_health_id` | `dimension='health'` | Was computed on read in `lib/dashboard.ts`; now stored, independent of progress |
| Progress | `work_items.progress_percent` + `progress_snapshots` | numeric 0–100 | Supersedes the inert `projects.percent_complete` and the prior plan's separate `technical_percent` |
| Priority | `work_items.priority_id` | `dimension='priority'` | Supersedes the hard-coded `tasks.priority` set; `tasks.priority` stays a task-local hint |
| Task status | `tasks.task_status_value_id` | `dimension='task'`, optionally seeded from `project_statuses` | Extends, not replaces, `tasks.status` |

Rules: each dimension has its own FK, its own status set and its own history. A
lifecycle transition writes `audit_events` and may set fields — it never writes
`decision_status_id`, `delivery_health_id` or `progress_percent`. Progress is
either calculated from tasks/milestones or set manually with
`progress_is_override` plus a reason. Config-driven sets: `status_sets` is the
global registry, `work_item_type_status_sets` binds one set per dimension per
type. `project_statuses` remains the per-project Kanban list, linked to the task
dimension by `task_status_value_id`, so today's per-project status editing keeps
working while the *reportable* vocabularies are global.

## 4 · Configuration vs transactional split

| Master/config (low volume, referenced by key) | Transactional (references config by FK, never stores a label) |
|---|---|
| `org_units`, `teams`, `team_members`, `applications`, `application_services`, `work_item_types`, `status_sets`, `status_values`, `work_item_type_status_sets`, `transition_rules`, `required_field_rules`, `alert_rules`, `business_calendars`, `calendar_holidays`, `project_statuses` | `work_items`, `requests`, `projects`, `tasks`, `assessments`, `links`, `milestones`, `work_item_risks`, `progress_snapshots`, `decisions`, `assignments`, `work_item_activity`, `audit_events`, `alert_events`, `task_comments`, `task_activity` |

Transactional rows store `status_values.id`, never a status label, and never a
department, team or priority as text. Config rows are soft-deactivated
(`active=false`), never deleted, so history keeps resolving. Config edits write
`audit_events` with `event='CONFIG_CHANGE'`, which the app does not do today.

## 5 · Workflow specification per work-item type

States are rows in the type's `status_values`; transitions are rows in
`transition_rules`. "Any stage" means the rule is seeded per stage.

| Type | Lifecycle states | Key transitions | Guards / required fields | Who may act |
|---|---|---|---|---|
| **Request** (`REQ-`) | Draft → Submitted → Under Review → Under Study → Prioritization → Approved-for-delivery; Rejected, Deferred, Returned-for-Information, Withdrawn | Submit; Triage; Request-info; Approve; Reject; Defer; Withdraw; Convert | Submit blocked without `title`, `business_objective`, `org_unit_id`, `application_id`, `intake_class` (A-01). Reject/defer/withdraw require `decisions.rationale`. Re-submit requires the fields named by `required_field_rules`. Convert requires an approved decision and creates a delivery item plus `links(CONVERTS_TO)` (A-02) | Requester: submit, withdraw. Portfolio coordinator: triage, request-info, convert. Approver role from `transition_rules.allowed_roles`: approve, reject, defer |
| **Study / Assessment** (`STD-`) | Plan Study → Study in Progress → BRD in Progress → BRD Complete → Recommendation Issued → Converted; Abandoned, On Hold | Start study; Complete BRD; Issue recommendation; Convert; Abandon; Hold; Resume | Recommendation requires `assessments.recommendation`, `owner_user_id`, `target_period`. Convert requires `recommended_type_id`, creates `links(CONVERTS_TO)` and keeps the study record. Hold/abandon require a reason | Study owner: study/BRD advance. Coordinator: convert. Coordinator + approver: abandon |
| **Delivery Item** (`PRJ-`) | Planned → In Delivery → UAT → Ready for Release → Released → Closed; On Hold, Cancelled, Rejected | Start delivery; Enter UAT; UAT sign-off; Ready-for-release; Release; Close; Hold; Resume; Cancel | Enter UAT blocked unless a UAT owner assignment and planned UAT dates exist (A-03, MON-006). Close blocked while any linked task is open unless `decisions` records an exception approval (A-05, MON-007); close requires `actual_end_date`. Release requires consistent target/actual dates | Delivery owner: delivery, UAT entry. UAT owner: sign-off. Project admin: close, exception. Coordinator: cancel, prioritisation |
| **Operational Item** (`OPS-`) | New → In Progress → Pending External → Done; Cancelled | Accept; Progress; Wait-external; Complete; Cancel; Link-to-project | Progress requires a support owner assignment and `follow_up_date`; the overdue-follow-up view reads `follow_up_date` and `outcome` (A-06). Completion requires `outcome`. Link later creates `links(RELATES_TO)` to a project or request | Support owner: progress, complete. Handling-team lead: reassign, escalate. Coordinator: cancel, link |

Cross-cutting: every transition emits `audit_events` and may raise
`alert_events`; guards run server-side from `required_field_rules` and
`transition_rules`, so no rule lives in TypeScript.

## 6 · Audit / history model

| Recorded | Where | Content |
|---|---|---|
| Field changes | `audit_events` (`FIELD_CHANGE`) | `entity_table`, `entity_id`, `field`, `old_value`, `new_value`, actor, timestamp, `source`. Generic, so it covers work items, projects, tasks, assessments and config — today `task_activity` catches 3 of 12 patchable task fields and nothing for projects |
| Status transitions | `audit_events` (`STATUS_TRANSITION`) | `from_status_id`, `to_status_id`, `reason`, actor, and the dimension via the status set. Structured, not prose substring matching as in `like("details","%to done")` |
| Decisions | `decisions` + `audit_events` (`DECISION`) | decision status, rationale, `decided_by`, `delegated_from`, previous/next lifecycle stage (A-07) |
| Assignments | `assignments` (current state) + `audit_events` (`ASSIGNMENT`) | who, to whom, role, when, `ended_at` |
| Config changes | `audit_events` (`CONFIG_CHANGE`) | table, record, before/after |

**Status History vs Update/Activity** — different tables, different guarantees.
Status history is `audit_events`: append-only, machine-readable, one row per
fact, never edited or deleted, kept for the record's life plus the retention
period. Update/Activity is `work_item_activity` plus `task_comments`: authored
narrative, editable and deletable by its author, excluded from audit. A
transition may also create an activity row for readability, but the audit row is
written independently and is authoritative. The UI shows both as one filterable
timeline.

## 7 · Indexing and retention

Indexes — `work_items(reference_no)` uq, `(work_item_type_id,
lifecycle_stage_id)`, `(lifecycle_stage_id, priority_id)`, `(org_unit_id,
lifecycle_stage_id)`, `(team_id)`, `(application_id)`, `(decision_status_id)`,
`(delivery_health_id)`, `(target_end_date)`, `(updated_at)`;
`requests(work_item_id)` uq, `(source_system, source_ref)` uq;
`links(from_work_item_id)`, `(to_work_item_id)`, `(link_type)`;
`assessments(work_item_id)`; `milestones(work_item_id, due_date)`;
`work_item_risks(work_item_id, state_id)`;
`progress_snapshots(work_item_id, measured_on)`;
`decisions(work_item_id, decided_at)`; `assignments(work_item_id, ended_at)`;
`work_item_activity(work_item_id, created_at)`;
`audit_events(entity_table, entity_id, occurred_at)`, `(occurred_at)`;
`alert_events(work_item_id, acknowledged_at)`, `(alert_rule_id, raised_at)`;
`status_values(status_set_id, sort_order)`; plus the existing
`project_statuses(project_id)`, `tasks(project_id)`, `tasks(assignee_id)`,
`tasks(status)`. Stale-record detection (MON-005) reads `work_items.updated_at`,
so *every* write must touch it or the alert lies.

Retention — `audit_events` and `decisions`: no delete (7 years or the
organisation's policy, pending decision 6). `alert_events`: 24 months, then purge
acknowledged rows. `progress_snapshots`: keep all (small, and the
previous/current pair is a reporting requirement). `work_item_activity` and
`task_comments`: retained with the record and cascade-deleted with it — which is
exactly why audit rows carry `entity_id` with no cascade FK, so a delete still
leaves the trace.

## 8 · Decisions requiring business-owner confirmation

1. Which status vocabulary is authoritative per type: the register `Status`
   column, the legacy `technical Status` column, or a new agreed list — and does
   `Done`/`Closed` collapse into one state?
2. Are requests always separate from delivery items, or may a small change be
   created directly as a delivery item with no request record?
3. Do studies and delivery items share one reference lineage (`STD-001` →
   `PRJ-001`) or keep independent references joined by a link?
4. Who approves each decision type, may approval be delegated, and is a
   two-level chain required for any type?
5. Is progress authoritative from tasks/milestones, from periodic manual
   reporting, or both with a governed override — and who may override?
6. Audit and retention period, confidentiality rules, and whether confidential
   items are hidden from search entirely or shown without detail.
7. Working-day basis: which calendar and holiday list, and does "3 working days"
   (MON-001) mean working days or calendar days in practice?
8. Which alert thresholds, recipients and escalation levels are real — and is
   escalation by level, by role, or by named person?
9. Master-data ownership for `org_units`, `teams`, `applications` and service
   types, and whether a directory feed exists or maintenance is manual.
10. Migration scope and reconciliation: are all eight legacy registers in scope,
    who signs off the value mapping, and what is the rollback point if a
    re-import is rejected?

Resolved tradeoff, stated once: **one `work_items` base table with typed
extensions, rather than the prior plan's single flat `requests` table.** The flat
table is cheaper for the first import slice, but it cannot separate a study from
the project it produces, or carry four status dimensions without nullable
columns that mean different things per type — the exact defect this redesign
exists to remove.
