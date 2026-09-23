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

export function isOverdue(task: DeadlineTask) {
  if (!task.due_date || task.status === "done") return false;
  return new Date(task.due_date) < new Date();
}

export function isDueSoon(task: DeadlineTask, withinDays = 3) {
  if (!task.due_date || task.status === "done" || isOverdue(task)) return false;
  return new Date(task.due_date).getTime() - Date.now() < withinDays * 24 * 60 * 60 * 1000;
}
