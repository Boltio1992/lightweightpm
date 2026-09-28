// Tiny fetch wrapper used by all client components.
export async function api<T = any>(
  url: string,
  options: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const { json, ...rest } = options;
  const res = await fetch(url, {
    ...rest,
    headers: {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    body: json ? JSON.stringify(json) : rest.body,
  });

  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
  }
  if (!res.ok) throw new Error((data as any).error || "Request failed.");
  return data as T;
}

/**
 * Write routes report `droppedColumns` when they had to omit a field because the
 * database (or PostgREST's schema cache) does not have that column yet. Turn
 * that into something a person can act on instead of silently losing the value.
 */
const DROPPED_COLUMN_LABELS: Record<string, string> = {
  icon: "Icon",
  default_view: "Default view",
  owner_id: "Owner",
  archived_at: "Archive date",
  percent_complete: "Percent complete",
  tags: "Tags",
  duration_days: "Duration",
};

export function droppedColumnsMessage(cols?: string[] | null): string | null {
  if (!cols || cols.length === 0) return null;
  const names = cols.map((c) => DROPPED_COLUMN_LABELS[c] ?? c).join(", ");
  return `${names} could not be saved — this database has no ${cols.join(", ")} column yet. Run supabase/migrations/20260928_project_custom_columns.sql (and reload the PostgREST schema cache) to enable it.`;
}

/**
 * Lightweight cross-component invalidation signal.
 *
 * The global "new task" modal lives in the app shell, so it cannot call a
 * page's refetch directly. Instead of `window.location.reload()` (a full
 * document reload), pages subscribe to this event and refresh just their data.
 */
export const TASKS_CHANGED_EVENT = "lightpm:tasks-changed";

export function emitTasksChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TASKS_CHANGED_EVENT));
  }
}

export function onTasksChanged(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(TASKS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(TASKS_CHANGED_EVENT, handler);
}

export function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export type DeadlineTask = { status: string; due_date?: string | null };

function dueDateEnd(task: DeadlineTask) {
  if (!task.due_date) return null;

  const date = new Date(`${task.due_date}T00:00:00`);
  date.setHours(23, 59, 59, 999);
  return date;
}

export function isOverdue(task: DeadlineTask) {
  if (task.status === "done") return false;
  const deadline = dueDateEnd(task);
  return !!deadline && deadline.getTime() < Date.now();
}

export function isDueSoon(task: DeadlineTask, withinDays = 3) {
  if (task.status === "done") return false;
  const deadline = dueDateEnd(task);
  if (!deadline || isOverdue(task)) return false;
  return deadline.getTime() - Date.now() < withinDays * 24 * 60 * 60 * 1000;
}

// Calculate end date from start date and duration in days
export function calculateDueDate(startDate: string | null | undefined, durationDays: number | null | undefined): string | null {
  if (!startDate || !durationDays || durationDays <= 0) return null;
  
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);
  
  // Return in YYYY-MM-DD format
  const year = end.getFullYear();
  const month = String(end.getMonth() + 1).padStart(2, "0");
  const day = String(end.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
