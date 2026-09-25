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
