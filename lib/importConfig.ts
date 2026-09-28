// Shared constants for the Excel import flow.
// Used by BOTH the template generator and the import parser so they never drift.

/** Rows whose first cell starts with this prefix are documentation, not data. */
export const SAMPLE_PREFIX = "SAMPLE - ";

export const PROJECT_SHEET = "Projects";
export const TASK_SHEET = "Tasks";
export const REFERENCE_SHEET = "Reference";

export const PROJECT_HEADERS = [
  "Name*",
  "Description",
  "Status",
  "Start Date",
  "End Date",
  "Icon",
  "Accent Color",
  "Default View",
];

export const TASK_HEADERS = [
  "Title*",
  "Project",
  "Parent Task",
  "Description",
  "Status",
  "Priority",
  "Assignee",
  "Start Date",
  "Due Date",
  "Duration Days",
  "Percent Complete",
  "Tags",
];

export const SAMPLE_PROJECT_ROW = [
  "SAMPLE - Website Redesign",
  "Revamp the marketing site",
  "active",
  "2026-10-01",
  "2026-12-15",
  "rocket",
  "#3B82F6",
  "kanban",
];

export const SAMPLE_TASK_ROWS = [
  [
    "SAMPLE - Design homepage mockup",
    "Website Redesign",
    "",
    "Hero section + navigation",
    "in_progress",
    "high",
    "",
    "2026-10-02",
    "2026-10-10",
    "8",
    "40",
    "design, ui",
  ],
  [
    "SAMPLE - Set up analytics",
    "Website Redesign",
    "",
    "Privacy-friendly analytics",
    "todo",
    "medium",
    "",
    "",
    "",
    "",
    "",
    "ops",
  ],
];

export const PROJECT_STATUSES = ["active", "on_hold", "done", "archived"];
export const PROJECT_VIEWS = ["kanban", "list", "timeline", "members"];
export const PROJECT_ICONS = [
  "folder",
  "rocket",
  "chart",
  "sparkles",
  "briefcase",
  "calendar",
  "target",
  "zap",
  "heart",
  "bookmark",
];
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"];
export const TASK_STATUS_KEYS = ["todo", "in_progress", "review", "blocked", "done"];

export const REFERENCE_ROWS: string[][] = [
  ["How to use this template", ""],
  ["1", "Fill in the Projects sheet (optional) and the Tasks sheet. Delete the SAMPLE rows first — any row starting with 'SAMPLE -' is ignored."],
  ["2", "Save the file as .xlsx and upload it back in LightPM (Projects page → Import)."],
  ["3", "Projects referenced in the Tasks sheet must exist in LightPM or be listed in the Projects sheet of this file."],
  ["", ""],
  ["Column reference", ""],
  ["Projects: Name*", "Required. Existing projects with the same name (case-insensitive) are reused, not duplicated."],
  ["Projects: Status", PROJECT_STATUSES.join(", ") + " (default: active)"],
  ["Projects: Start/End Date", "YYYY-MM-DD, e.g. 2026-10-01"],
  ["Projects: Icon", PROJECT_ICONS.join(", ") + " (default: folder)"],
  ["Projects: Accent Color", "Hex color like #3B82F6 (default: #12A594)"],
  ["Projects: Default View", PROJECT_VIEWS.join(", ") + " (default: kanban)"],
  ["Tasks: Title*", "Required."],
  ["Tasks: Project", "Project name. Leave empty for a standalone task (no project)."],
  ["Tasks: Parent Task", "Title of another task in the same project — either an existing LightPM task or another row in this file."],
  ["Tasks: Status", TASK_STATUS_KEYS.join(", ") + " — labels like 'In Progress' also work, as do the project's custom statuses. Unknown values fall back to todo."],
  ["Tasks: Priority", TASK_PRIORITIES.join(", ") + " (default: medium)"],
  ["Tasks: Assignee", "Username or display name of an existing LightPM user. Unknown values are left unassigned."],
  ["Tasks: Start/Due Date", "YYYY-MM-DD. If Due Date is empty but Start Date + Duration Days are set, it is calculated automatically."],
  ["Tasks: Duration Days", "Whole number ≥ 0."],
  ["Tasks: Percent Complete", "Whole number 0–100 (default: 0, or 100 when status is done)."],
  ["Tasks: Tags", "Comma-separated, e.g. design, ui"],
];
