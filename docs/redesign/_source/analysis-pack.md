Sanitized Legacy Portfolio Tracking Workbook
Analysis Pack for Coding AI
Version 1.0 | 13 October 2026

| CONFIDENTIALITY NOTICE This document contains no real employee names, IDs, email addresses, project titles, organization names, system names, vendors, branches, dates, comments, or production records. Every example and portfolio figure is synthetic and is provided only to explain the structure and behavior of a legacy tracking workbook. |


Intended use: analyze the legacy management approach, identify reusable capabilities, and propose a normalized design for integration into an existing project management platform.

# 1. Purpose and Instructions to the Coding AI
This pack describes how a legacy spreadsheet is used to register, classify, monitor, and report projects, change requests, internal studies, reporting requests, security initiatives, and operational follow-up tasks. It deliberately does not reproduce the confidential workbook or recommend copying its structure exactly.

| PRIMARY ANALYSIS INSTRUCTION Treat the workbook as evidence of business needs, not as the target data model. Identify which capabilities can be mapped to the existing PM system, which require configuration, and which require new development. Do not design a spreadsheet clone. |


## 1.1 Expected outputs from analysis
- Capability mapping between the existing PM system and this legacy monitoring approach.
- Gap analysis covering intake, classification, governance, monitoring, dashboards, alerts, data quality, and auditability.
- Normalized target data model that separates requests, delivery items, tasks, studies, approvals, risks, milestones, and operational follow-ups.
- Recommended workflows and state transitions by work-item type.
- Screen and dashboard recommendations using only synthetic examples.
- Implementation plan separating configuration, extension, integration, migration, and out-of-scope work.
- Questions that require business-owner confirmation before coding.
## 1.2 Non-negotiable constraints
- Do not infer or recreate production data from examples.
- Do not hard-code departments, teams, statuses, priorities, scoring weights, or approval chains.
- Do not use one status field to represent lifecycle, approval decision, delivery health, and progress.
- Do not combine all records into one flat object merely because the spreadsheet uses rows.
- Keep configuration data separate from transactional records.
- Provide role-based access control, field-level visibility where needed, and a complete audit trail.
# 2. Legacy Workbook Conceptual Structure
The source workbook conceptually contains four worksheets. Names below describe their functions, not production labels.

| Area | Primary purpose | Typical content | Target-system interpretation |
| Portfolio Summary | Management snapshot | Counts by status, plan class, type, team, and department | Dashboard and analytics layer |
| Master Register | Central list of requests and delivery items | Requester, scope, application, multiple statuses, progress, type, owner, notes | Request and delivery-item records |
| Internal Study Pipeline | Pre-delivery analysis and initiative planning | Study status, BRD status, quarter, owner, schedule, comment | Assessment/study module and conversion workflow |
| Operational Follow-up | Ad hoc and support tracking | Next action, support owner, target timing, narrative, status | Operational work item or linked task |


## 2.1 Synthetic portfolio snapshot
The following values are fabricated to demonstrate expected dashboard behavior. They are not derived values and should not be used as migration totals.

| Lifecycle summary | Synthetic count | Illustrative share |
| Completed | 28 | 35.0% |
| Not Started | 30 | 37.5% |
| In Progress | 9 | 11.3% |
| UAT | 8 | 10.0% |
| On Hold | 3 | 3.8% |
| Rejected | 2 | 2.5% |
| Total | 80 | 100.0% |



| Classification | Synthetic count |
| Planned portfolio | 34 |
| New / unplanned demand | 46 |
| Total | 80 |


# 3. Legacy Data Dictionary
These fields represent the concepts found in the workbook. “Target treatment” indicates how they should be interpreted during redesign.

| Legacy field | Business meaning | Recommended target treatment |
| No. | Row sequence | Display only; never use as stable ID |
| Reference No. | Human-readable request reference | System-generated unique reference |
| Request Title | Short description | Required searchable title |
| Request Date | Date received | Store with timezone and created timestamp |
| Requester | Submitting person | User reference; synthetic in development |
| Requester ID | Employee identifier | Sensitive; avoid in AI test data |
| Requester Position | Job title | Prefer directory lookup |
| Requester Department | Submitting unit | Controlled organization master data |
| Requester Branch | Location/unit | Optional controlled master data |
| Application Name | Affected solution | Application/service inventory reference |
| Apply For | Scope of impact | Controlled scope enum plus details |
| Workflow Action/Status | Legacy approval routing value | Do not treat as delivery status |
| Technical Status | Technical execution condition | Map to delivery health or engineering stage |
| Technical Percent | Technical completion | Numeric 0-100 with validation |
| PM Status | Portfolio reporting state | Replace with lifecycle stage |
| Plan/New | Planning classification | Portfolio source or intake class |
| Type | Work category | Configurable work-item type |
| Handle By | Responsible team | Team reference, not free text |
| Description | Detailed need | Rich text with attachments |
| Recommendation | Triage or PM recommendation | Decision record or assessment notes |


# 4. Sanitized Synthetic Master Register
All records below are invented. Dates, names, systems, teams, titles, references, and statuses have no connection to production data.

## 4.1 Master register sample

| Reference | Synthetic title | Request date | Requester | Department | Application | Type | Plan class | PM status | Progress | Team |
| REQ-2026-0001 | Enhance monthly service report | 2026-01-08 | Sample User 01 | Business Unit A | System Alpha | Report Request | New | Not Started | 0% | Team Data |
| REQ-2026-0002 | Add validation to customer form | 2026-01-11 | Sample User 02 | Business Unit B | System Beta | Change Request | Planned | In Progress | 45% | Team Core |
| REQ-2026-0003 | Create internal approval portal | 2026-01-15 | Sample User 03 | Corporate Unit C | System Gamma | Internal Automation | New | UAT | 80% | Team Apps |
| REQ-2026-0004 | Strengthen access review control | 2026-01-18 | Sample User 04 | Control Unit D | System Delta | Security | Planned | On Hold | 25% | Team Security |
| REQ-2026-0005 | Integrate external notification API | 2026-01-23 | Sample User 05 | Digital Unit E | Integration Hub | Project | New | Completed | 100% | Team Integration |
| REQ-2026-0006 | Standardize operational dashboard | 2026-02-02 | Sample User 06 | Operations Unit F | Analytics Portal | Report Request | Planned | Rejected | 0% | Team Data |


Note: this layout intentionally demonstrates the legacy flat register. The target design should normalize people, teams, applications, stages, assignments, decisions, and progress updates into linked records.

# 5. Sanitized Synthetic Internal Study Pipeline
The study pipeline tracks ideas before or during formal delivery. In the future system, study and implementation should be separate but connected phases.

| Study ID | Synthetic initiative | Study state | Implementation | Service type | Owner | Quarter | Start | End | Comment |
| STD-001 | Employee request workflow | BRD Complete | 65% | Internal Automation | Sample Owner A | 2026-Q1 | 2026-01-12 | 2026-04-30 | UAT planning in progress |
| STD-002 | Customer onboarding simplification | Study in Progress | Not Started | Business | Sample Owner B | 2026-Q2 | 2026-03-01 | 2026-05-15 | Awaiting process map |
| STD-003 | Asset control enhancement | BRD Complete | On Hold | Internal Automation | Sample Owner C | 2026-Q2 | 2026-02-10 | 2026-06-30 | Dependency unresolved |
| STD-004 | Operational incident portal | Plan Study | Not Applicable | Internal Automation | Sample Owner D | 2026-Q3 | 2026-07-01 | 2026-08-31 | Assessment not assigned |


## 5.1 Behaviors to preserve
- Track an initiative before implementation is approved.
- Record study owner, target quarter, start/end dates, recommendation, and decision.
- Allow conversion from study to project, change request, report request, or operational item without retyping data.
- Retain links between the original study, approval decision, and resulting delivery record.
- Separate study completion from implementation progress.
# 6. Sanitized Synthetic Operational Follow-up List
Operational follow-ups are smaller or more fluid than projects. They may later become tasks, incidents, change requests, or projects.

| Item | Synthetic topic | Support owner | Target timeline | Next action / description | Status |
| OPS-001 | External interface response issue | Sample Support A | End of Month | Review logs with external provider and record action plan | In Progress |
| OPS-002 | Temporary access reversal review | Sample Support B | Within 10 working days | Confirm reversal affects only selected application | Not Started |
| OPS-003 | Form limit enhancement | Sample Support C | Next release | Support workshop, testing, and release readiness | In Progress |
| OPS-004 | Ticket category update | Sample Support D | Completed | Update service categories and validate search behavior | Done |
| OPS-005 | Urgent voting workflow support | Sample Support E | Ad hoc | Prepare requirements, facilitate test, and record outcome | In Progress |


## 6.1 Target handling
- Operational items may exist independently or be linked to a request/project.
- Each item needs an owner, next action, due/follow-up date, status, and activity history.
- Escalation should occur when the follow-up date passes or when no update is recorded.
- Narrative updates should not replace structured fields for ownership, date, priority, dependency, and outcome.
# 7. Structural and Data-quality Problems to Analyze

| Observed pattern | Why it is risky | Target design response |
| Multiple overlapping status columns | A record can appear completed in one field and not started in another | Separate lifecycle stage, decision, delivery health, task status, and progress |
| Mixed progress formats | Values may be text, decimal, integer, blank, or status words | Use validated numeric percentage or calculated milestone/task progress |
| Flat rows for different work types | Requests, studies, projects, reports, security initiatives, and tasks need different behavior | Use a common base work item plus type-specific records/fields |
| Free-text teams and departments | Spelling and abbreviation differences break reporting | Use mastered organization, team, and application references |
| Missing fields imply meaning | Blank values are interpreted manually | Use explicit states such as Not Applicable, Unknown, Unassigned, or Pending |
| Narrative comments hold key actions | Actions and dependencies cannot be filtered or alerted | Create structured actions, dependencies, decisions, risks, and due dates |
| Manual dashboard totals | Reports can become stale or inconsistent | Generate dashboards directly from governed records |
| Row number used as visual identity | Sorting and insertion change the number | Use immutable system ID plus human-readable reference |
| Study and implementation combined | Study completion is confused with delivery completion | Model study/assessment and delivery as related phases |
| Dates and quarters can conflict | Invalid dates and schedule inconsistencies reduce trust | Validate dates and derive quarter from target dates when appropriate |


# 8. Recommended Normalized Target Model
The coding AI should assess how this model can fit into the existing PM platform instead of assuming every entity needs a new standalone module.

| Entity | Purpose | Key relationships |
| Request | Captures submitted demand before approval | Requester, department, affected service, assessment, decisions |
| Assessment / Study | Evaluates need, feasibility, impact, effort, risk, and recommendation | Belongs to request; can create delivery item |
| Delivery Item | Approved project, change, report, security initiative, or automation | Linked to request/study; contains milestones, risks, tasks |
| Operational Item | Tracks ad hoc support or follow-up work | May link to request, incident, project, or task |
| Task / Subtask | Assignable execution activity | Belongs to delivery or operational item |
| Milestone | Major planned checkpoint | Belongs to delivery item; contributes to health/progress |
| Decision | Approval, rejection, deferral, return, or cancellation | Linked to request or stage transition; includes actor and rationale |
| Status History | Immutable lifecycle events | Tracks previous/new state, actor, time, and reason |
| Update / Activity | Progress note or communication | Linked to any work item; includes author and timestamp |
| Risk / Issue | Threat or active problem | Owner, severity, response, due date, escalation |
| Dependency | Internal/external prerequisite | Links two items or records an external dependency |
| Assignment | Role-based ownership | Links user/team to work item with responsibility type |
| Application / Service | Master data for affected systems | Used across requests, tasks, impacts, and reports |
| Organization Unit / Team | Master data for requesters and delivery groups | Supports access, routing, ownership, and dashboards |


# 9. Recommended Status Dimensions

| Dimension | Question answered | Illustrative values |
| Lifecycle Stage | Where is the item in the end-to-end process? | Draft, Submitted, Under Review, Under Study, Prioritization, Planned, In Delivery, UAT, Ready for Release, Released, Closed, On Hold, Rejected, Cancelled |
| Decision Status | What decision has been made? | Pending, Approved, Rejected, Deferred, Withdrawn, Returned for Information |
| Delivery Health | Is delivery healthy? | Not Assessed, On Track, At Risk, Off Track, Blocked |
| Progress | How much approved work is complete? | 0-100%; preferably calculated |
| Priority | How important is the work? | Critical, High, Medium, Low; configurable |
| Task Status | What is the execution state of a task? | To Do, In Progress, Blocked, Done, Cancelled |



| DESIGN RULE A lifecycle transition may update reporting, trigger validation, create an approval, send a notification, or require fields. It must not silently overwrite decision history or technical progress. |


# 10. Monitoring and Dashboard Requirements
## 10.1 Portfolio overview
- Active work by lifecycle stage, type, priority, department, application, and delivery team.
- New demand, approved backlog, in-delivery work, UAT, overdue, blocked, and recently completed items.
- Average request age, assessment lead time, delivery lead time, and time in current stage.
## 10.2 Backlog and aging
- Age bands: 0-30, 31-60, 61-90, 91-180, and over 180 days.
- High-priority items not yet assessed or scheduled.
- Items without owner, handling team, planned date, or recent update.
## 10.3 Delivery and capacity
- On Track, At Risk, Off Track, and Blocked items.
- Milestones due soon or overdue; UAT and release readiness.
- Active work by owner/team, unassigned work, work by effort, and capacity versus demand.
## 10.4 Data quality
- Completed item without actual completion date.
- Closed delivery item with open tasks.
- UAT stage without UAT owner or planned dates.
- Progress outside 0-100 or inconsistent with lifecycle stage.
- Stale record with no update within a configurable period.
# 11. Alerts and Automation Rules

| Rule ID | Synthetic rule | Expected action |
| MON-001 | High-priority request remains Under Review for more than 3 working days | Notify portfolio coordinator and escalate according to configuration |
| MON-002 | Planned start date passes while stage remains Planned | Flag overdue start and notify delivery owner |
| MON-003 | Target end date passes before closure | Mark schedule exception and notify owner/manager |
| MON-004 | Blocked state lasts more than configured threshold | Escalate with dependency and blocker details |
| MON-005 | No update for 14 days on an active item | Create stale-record alert |
| MON-006 | Lifecycle changes to UAT without UAT owner or dates | Block transition and display required fields |
| MON-007 | Delivery marked complete with open tasks | Block closure or require exception approval |
| MON-008 | Study target date passes without recommendation | Notify study owner and portfolio coordinator |


# 12. Privacy-safe Development Dataset Rules
- Use only names such as Sample User 01, Sample Owner A, and Test Approver 03.
- Use only generic units such as Business Unit A, Control Unit B, Team Core, Team Apps, and Team Data.
- Use only generic applications such as System Alpha, System Beta, Analytics Portal, and Integration Hub.
- Generate references such as REQ-2026-0001, STD-001, PRJ-001, and OPS-001.
- Use invented dates and descriptions that do not mirror real project wording.
- Do not include real employee identifiers, emails, phone numbers, branch names, vendor names, URLs, account data, infrastructure details, or screenshots.
- Keep a machine-readable marker on every development dataset: dataClassification = SYNTHETIC.
- Prevent synthetic seed data from being deployed to production unless explicitly approved.
## 12.1 JSON example
{ "dataClassification": "SYNTHETIC", "requestId": "REQ-2026-0002", "title": "Add validation to customer form", "requester": "Sample User 02", "requestingDepartment": "Business Unit B", "workItemType": "Change Request", "application": "System Beta", "lifecycleStage": "In Delivery", "decisionStatus": "Approved", "deliveryHealth": "At Risk", "progressPercent": 45, "priority": "High", "handlingTeam": "Team Core" }
# 13. Analysis Questions for the Existing PM System
- Can the current system represent Request separately from Project and Task?
- Can work-item types have different forms, required fields, workflows, and permissions?
- Can a study/assessment be converted into a delivery item while retaining history and links?
- Can lifecycle stage, decision status, health, and progress be stored independently?
- Can departments, teams, applications, and locations be managed as controlled master data?
- Can dashboards calculate aging, time in stage, overdue status, stale updates, and backlog by team?
- Can alerts use working days, configurable thresholds, reminders, and escalation levels?
- Can approvals support approve, reject, defer, return for information, and delegated action?
- Can the system calculate progress from tasks or milestones and allow governed manual override?
- Can an operational item exist without becoming a project, while still being linked later?
- Does the platform provide audit history for field changes, status transitions, decisions, assignments, and configuration?
- Can access be restricted by role, department, assignment, and record confidentiality?
- Can import logic validate, stage, map, reject, and reconcile legacy records before production migration?
- Which requirements can be configured, which require extension, and which should remain out of scope?
# 14. Requested Deliverables from the Coding AI

| Deliverable | Required content |
| 1. Capability Map | Existing capability, reusable as-is, configuration needed, customization needed, unavailable |
| 2. Gap Analysis | Gap, business impact, recommended solution, complexity, dependency, risk |
| 3. Target Data Model | Entities, fields, validation, relationships, indexes, history, retention |
| 4. Workflow Specification | State diagrams, actions, guards, required fields, permissions, triggers |
| 5. UI Specification | List, detail, intake, assessment, dashboard, operational follow-up, admin configuration |
| 6. Security Model | Roles, permissions, record scope, sensitive fields, audit events |
| 7. Integration Design | Identity/directory, application master, notifications, reporting, import/export |
| 8. Migration Strategy | Profiling, mapping, cleansing, staging, validation, reconciliation, rollback |
| 9. Synthetic Test Pack | Seed data and scenarios covering happy paths, exceptions, returns, holds, blockers, and closure |
| 10. Phased Plan | MVP, later phases, assumptions, dependencies, risks, and out-of-scope functions |



| FINAL INSTRUCTION Do not start coding solely from this document. First return the capability map, gap analysis, proposed target model, workflow assumptions, and clarification questions. Coding should begin only after those design decisions are reviewed. |


# Appendix A. Synthetic Acceptance Scenarios

| ID / scenario | Acceptance statement |
| A-01 Intake completeness | Given a requester submits a change request without a business objective, when Submit is selected, then the system blocks submission and identifies the missing field. |
| A-02 Triage conversion | Given an approved study recommends a project, when the coordinator converts it, then the project inherits approved fields and preserves a link to the study and decision. |
| A-03 UAT guard | Given a delivery item has no UAT owner, when a user moves it to UAT, then the transition is blocked until the owner and planned dates are entered. |
| A-04 Stale update | Given an active high-priority item has no update for 14 days, when the monitoring job runs, then an alert is created for the delivery owner. |
| A-05 Closure control | Given a project has two open tasks, when the manager attempts closure, then closure is blocked or routed for documented exception approval. |
| A-06 Operational escalation | Given an operational item passes its follow-up date, when no outcome is recorded, then it appears in the overdue follow-up view and notifies its owner. |
| A-07 Audit history | Given an approver defers a request, when the record is viewed, then the decision, reason, actor, timestamp, and previous stage are visible in history. |
| A-08 Access restriction | Given a viewer lacks confidential-record access, when they search the portfolio, then restricted items and sensitive fields are not returned. |


# Appendix B. Explicit Exclusions
- No production workbook rows, real portfolio totals, or real dashboard figures are reproduced.
- No real personal data, employee data, organizational names, work titles, locations, or branch information is included.
- No real application, platform, third-party, or infrastructure detail is included.
- No recommendation in this pack should be interpreted as a final approved workflow or policy.
- No migration should occur until data owners approve mapping, cleansing, retention, and access rules.
# Appendix C. Copy-ready Analysis Prompt
Use the following prompt together with this document and the separate documentation for the existing PM system:

| Analyze the attached sanitized legacy-workbook pack together with the existing PM-system documentation. Do not reproduce the spreadsheet as the target design and do not begin coding. First provide: (1) a capability map, (2) a gap analysis, (3) a normalized target data model, (4) workflow and status recommendations, (5) role and permission gaps, (6) dashboard and monitoring requirements, (7) configuration versus customization decisions, (8) migration considerations, and (9) clarification questions. Use only synthetic data in every example. Clearly label assumptions and identify any requirement that cannot be confirmed from the supplied documentation. |

Recommended next step: provide the current PM-system document, screenshots, workflow descriptions, and role matrix. Keep all examples sanitized or synthetic.