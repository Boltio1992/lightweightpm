# Evidence appendix — what the legacy workbook actually contains

Companion to `01-capability-map.md` and `03-target-model-and-workflows.md`.
Everything here was measured directly from the legacy workbook, not inferred from
the sanitized brief. Where the brief and the data disagree, the data wins and the
disagreement is recorded.

Method: read-only extraction with openpyxl over all 13 worksheets
(`_source/` holds the sanitized brief; the extractor scripts and the raw
vocabulary report are kept outside the repo and are not committed, because they
contain the real value lists).

---

## 1 · Scale of the legacy register

Eight sheets hold records; five are pivot/summary sheets with no header row.

| Register sheet | Rows | Role in the target design |
|---|---|---|
| Data Tracking | 153 | delivery items (projects + change requests) |
| Ticket Issue | 345 | operational / support items |
| BAU | 91 | operational follow-up with an analysis-to-deployment pipeline |
| Report Implement | 41 | delivery items, reporting type |
| New CR (monthly sheet) | 38 | periodic intake of change requests |
| Temenos Ticket | 26 | vendor ticket tracking |
| Study | 25 | pre-delivery assessments |
| CBS transaction | 5 | unrelated metrics (out of scope) |
| **Total** | **≈724** | migration volume is small: this is a design problem, not a data-volume problem |

Consequence for the plan: the migration is cheap in bytes and expensive in
semantics. Effort belongs in mapping and validation, not in bulk loading.

---

## 2 · Status is not one vocabulary — it is four

Measured distinct values, per register:

| Register | Distinct values found |
|---|---|
| Data Tracking | `Done`, `NOT_YET_START`, `PROGRESS`, `UAT`, `Hold`, `Rejected` |
| New CR (monthly) | `Done`, `Not Yet Start`, `UAT`, `Progress` |
| Study | `STUDY`, `NOT_YET_START` |
| Report Implement | `NOT_YET_START`, `Done`, `UAT`, `PROGRESS`, `Rejected` |
| Ticket Issue | `Closed`, `In Progress`, `New`, `Pending Confirmation`, `Pending` |
| Temenos Ticket | `Customer Replied`, `Pending client confirmation`, `Temenos Investigating`, `Reopen` |

Two conclusions, both of which the brief predicted and the data confirms:

1. **A single global status enum cannot work.** Tickets use a support vocabulary;
   studies use a study vocabulary; delivery items share a delivery vocabulary.
   Status sets must therefore be **configuration, scoped to a work-item type** —
   which is exactly what the brief's constraint "do not hard-code statuses"
   requires, now with evidence behind it.
2. **Casing and separator drift is real**: `NOT_YET_START` / `Not Yet Start` /
   `Not yet start`; `PROGRESS` / `Progress`. Import must normalise
   case-insensitively and collapse separators, or the same state will report as
   two.

Note that `Done` and `Closed` mean the same thing in different registers, and
`UAT` appears both as a lifecycle stage (delivery) and as an `Issue Type`
(tickets). The mapping must resolve these **per type**, never globally.

---

## 3 · Work-item type taxonomy

`CR`, `Project-Implement`, `Automation`, `Report-Implement`, `Operation`,
`Project-Study` — six values across the registers, and one register (`Study`)
uses `Project-Study` where the brief's synthetic sample says "Internal Study".

This directly supports the brief's "common base work item + type-specific
records" model: the six types differ in which columns they even have (Study has
no progress, no release dates; Ticket has environment and priority instead).

---

## 4 · Planning class

`Plan/New` holds exactly two values: `InPlan` and `New`. This is the brief's
"portfolio source / intake class" and it is a clean two-value classification —
good news: it can be modelled as a controlled enum immediately.

Data-quality note: the `Done in Month` column also contains the value `InPlan`
(18 rows), i.e. the wrong value in the wrong column. The import must validate
column semantics, not just types.

---

## 5 · The "mixed progress formats" claim is only partly true

Measured across every percent-like column:

| Sheet | Column | Filled | Blank | Formats observed |
|---|---|---|---|---|
| Data Tracking | `%Complete -Previous` | 79 | 80 | 78 × decimal fraction (0–1); **1 × `100`** |
| Data Tracking | `% Complete - Current` | 98 | 61 | 97 × decimal fraction (0–1); **1 × `100`** |
| New CR | both | 15 | 23 | all decimal fraction |
| Report Implement | both | 14 / 15 | 34 / 33 | all decimal fraction |
| Study | both | 0 | 43 | **column entirely empty** |

Corrections to the brief's characterisation:

- It is **not** "text, decimal, integer, blank or status words". The dominant
  format is a **decimal fraction (0–1)**, consistently.
- The real defect is a **scale inconsistency**: two cells store `100` where every
  neighbouring cell stores `1.0` — a latent 100× error. Validation must reject
  out-of-range values and the import must convert fractions to the canonical
  0–100 integer scale.
- **Previous/Current is a pair.** Progress deltas over time are a first-class
  requirement, and the high blank rate (60–100%) means "no previous measurement"
  must be modelled as an explicit unknown — never as 0.
- **Study has no progress at all**, which independently confirms the brief's rule
  that study completion and delivery progress are different things.

---

## 6 · Other measured data-quality defects

| Defect | Evidence | Design response |
|---|---|---|
| Case-duplicated enum values | `Priority` in Ticket Issue holds `Urgent` (152) **and** `urgent` (12); `High` (120) and `high` (4) | Case-insensitive matching on import; report collisions instead of silently merging |
| Invalid year | `Impl. Year` holds `2024`, `2025`, `2023`, plus `1905-07-17 00:00:00` (a spreadsheet epoch artefact) and `0` | Range-validate dates/years; quarantine rather than coerce |
| Value in the wrong column | `Project Priority` holds `2025` (a year) in the New CR register | Per-type column semantics validation |
| Misspelled column names | `Evironment`, `IT Operatoin` | Map by normalised header signature; keep the raw header for audit |
| Free-text drift in enums | `Issue Type` has 8 values including one-off entries (`T24`, `Reset Password`) alongside `Request` and `Incident` | Controlled vocabulary plus an explicit "Other, with detail" escape hatch |
| Blank means different things | Blank progress = not measured; blank percent in Study = not applicable | Explicit `Not Applicable` / `Unknown` / `Unassigned`, as the brief requires |

---

## 7 · Master-data shape (values deliberately not reproduced)

The registers reference identities that must become **controlled master data**,
not free text. Measured distinct counts only:

| Concept | Distinct values seen | Implication |
|---|---|---|
| Department / owner unit | 7–16 per register, 20 for depart/branch | Small enough to master properly; current free text will not group |
| Handling team | 2–4 per register | Already almost a controlled list |
| Assigned technical resource | 4–23 | Person reference, not text |
| Application / system | present in delivery registers | Application inventory entity |
| Requester | up to 102 | User reference |

Per the brief, none of these values may be hard-coded; they are configuration and
master data, and the import must map to them by key rather than by string.

---

## 8 · What this changes about the brief

The brief is accurate and its constraints hold up. Three refinements:

1. **Status configuration must be per work-item type.** The brief says statuses
   are configurable; the data shows four parallel vocabularies, so configuration
   needs a *scope* (which type it belongs to), and a mapping table that can point
   several legacy spellings at one canonical state.
2. **Progress needs a previous/current pair with an explicit "not measured"
   state**, and canonical 0–100 storage with range validation. The brief's
   "validated numeric percentage" is right but understates the pair.
3. **Import validation is the highest-value early feature.** Almost every defect
   above is caught by validation at import time, and nothing here is caught by
   the UI. Phase order should reflect that.

---

## 9 · Method note

Extraction was read-only and value-safe: taxonomy columns were enumerated,
identity and free-text columns were reported as counts only and their values were
withheld — so this appendix can sit in the repo without carrying personal,
organisational or system names. The scripts live outside the repository.

Reproduce with (scripts are outside the repo, on purpose):

```
python vocab_report.py    "<legacy workbook>.xlsx"  vocab-report.md
python progress_shapes.py "<legacy workbook>.xlsx"
```
