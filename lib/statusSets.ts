/**
 * The single source of truth for task/work status vocabularies.
 *
 * Task statuses used to be listed in five places with drifting values (the copy
 * inside the store used a different colour for In Progress). They now come from
 * here, and nothing else in the app should define a status list.
 *
 * Where the real configuration lives: a project's own statuses are rows in
 * `project_statuses`, editable in Project Settings. `KanbanBoard`,
 * `TaskInspector`, `TaskModal` and the importer all already prefer those. These
 * constants are only:
 *
 *   - DEFAULT_STATUS_SET - the fallback for work with no project to source from
 *     (project-less tasks), and the order the board and Gantt fall back to.
 *   - DELIVERY_STATUS_SET / TICKET_STATUS_SET - the vocabularies measured from
 *     the legacy registers (docs/redesign/04-evidence-appendix.md §2), ready to
 *     be attached to a project.
 *
 * LOAD-BEARING: the keys in DEFAULT_STATUS_SET are relied on elsewhere - the
 * import and task-create paths default to `todo`, and the dashboard counts
 * `status === "blocked"`. Renaming a key means updating those call sites too;
 * relabelling (changing `label`) is free.
 */

export type StatusDef = {
  key: string;
  label: string;
  color: string;
  is_done: boolean;
};

/** Fallback vocabulary, used when a project has no statuses of its own. */
export const DEFAULT_STATUS_SET: StatusDef[] = [
  { key: "todo", label: "To Do", color: "#94A3B8", is_done: false },
  { key: "in_progress", label: "In Progress", color: "#12A594", is_done: false },
  { key: "review", label: "Review", color: "#F59E0B", is_done: false },
  { key: "blocked", label: "Blocked", color: "#EF4444", is_done: false },
  { key: "done", label: "Done", color: "#10B981", is_done: true },
];

/**
 * The delivery vocabulary seen in the legacy registers, normalised:
 * Done / NOT_YET_START / PROGRESS / UAT / Hold / Rejected
 *   -> Done / Not Started / In Progress / UAT / On Hold / Rejected
 */
export const DELIVERY_STATUS_SET: StatusDef[] = [
  { key: "not_started", label: "Not Started", color: "#94A3B8", is_done: false },
  { key: "in_progress", label: "In Progress", color: "#12A594", is_done: false },
  { key: "uat", label: "UAT", color: "#F59E0B", is_done: false },
  { key: "hold", label: "On Hold", color: "#EF4444", is_done: false },
  { key: "done", label: "Done", color: "#10B981", is_done: true },
  { key: "rejected", label: "Rejected", color: "#64748B", is_done: true },
];

/**
 * The ticket vocabulary seen in the same registers:
 * New / In Progress / Pending / Pending Confirmation / Closed
 */
export const TICKET_STATUS_SET: StatusDef[] = [
  { key: "new", label: "New", color: "#94A3B8", is_done: false },
  { key: "in_progress", label: "In Progress", color: "#12A594", is_done: false },
  { key: "pending", label: "Pending", color: "#F59E0B", is_done: false },
  { key: "pending_confirmation", label: "Pending Confirmation", color: "#6366F1", is_done: false },
  { key: "closed", label: "Closed", color: "#10B981", is_done: true },
];

export function statusKeys(set: StatusDef[] = DEFAULT_STATUS_SET): string[] {
  return set.map((s) => s.key);
}

export function statusDefFor(
  key: string,
  set: StatusDef[] = DEFAULT_STATUS_SET
): StatusDef | undefined {
  return set.find((s) => s.key === key);
}

/** The key a new task gets when nothing else decides it. */
export function defaultStatusKey(set: StatusDef[] = DEFAULT_STATUS_SET): string {
  return set[0]?.key ?? "todo";
}

/**
 * Rows shaped for `project_statuses`, so a project can be seeded with any of the
 * vocabularies above. `sort_order` follows array order.
 */
export function asStatusRows(set: StatusDef[] = DEFAULT_STATUS_SET) {
  return set.map((s, index) => ({
    name: s.label,
    key: s.key,
    color: s.color,
    sort_order: index,
    is_done: s.is_done,
  }));
}
