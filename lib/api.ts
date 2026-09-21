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

// A task is "overdue" when its SLA date (or due date as fallback) has passed
// and the task is not done. This is the single source of truth for SLA logic
// on the client; the server mirrors it in /api/reports.
export function isOverdue(task: { status: string; sla_date?: string | null; due_date?: string | null }) {
  const deadline = task.sla_date || task.due_date;
  if (!deadline || task.status === "done") return false;
  return new Date(deadline) < new Date();
}
