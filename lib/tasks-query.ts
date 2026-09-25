import { supabaseAdmin } from "@/lib/supabaseServer";
import type { Task, UserPublic } from "@/types";

/**
 * Task reads used to go through a 3-step fallback chain (FK-hinted join ->
 * plain join -> raw select + manual stitching). Whenever PostgREST rejected the
 * FK hint, every single request paid for 3 sequential queries plus 2 extra
 * lookups. This module replaces that with one deterministic path:
 *
 *   1. select the task rows (plain columns, no embedded joins)
 *   2. fetch the referenced users and projects in parallel
 *
 * Two round-trips maximum, and it cannot fail because of FK naming.
 */

const TASK_COLUMNS =
  "id, project_id, parent_task_id, title, description, status, priority, assignee_id, start_date, due_date, duration_days, percent_complete, sort_order, tags, created_by, created_at, updated_at";

const USER_COLUMNS = "id, username, name, title, role, created_at";

export type TaskFilter = {
  projectId?: string | null;
  standalone?: boolean;
};

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => !!v))];
}

function withDefaults(task: Record<string, unknown>): Task {
  const status = (task.status as string) ?? "todo";
  return {
    ...(task as unknown as Task),
    tags: Array.isArray(task.tags) ? (task.tags as string[]) : [],
    duration_days: (task.duration_days as number | null) ?? null,
    percent_complete:
      (task.percent_complete as number | null | undefined) ?? (status === "done" ? 100 : 0),
  };
}

export async function fetchTasks(filter: TaskFilter = {}): Promise<Task[]> {
  const db = supabaseAdmin();

  let query = db.from("tasks").select(TASK_COLUMNS).order("sort_order", { ascending: true });
  if (filter.projectId) {
    query = query.eq("project_id", filter.projectId);
  } else if (filter.standalone) {
    query = query.is("project_id", null);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];

  const assigneeIds = uniqueIds(rows.map((r) => r.assignee_id as string | null));
  const projectIds = uniqueIds(rows.map((r) => r.project_id as string | null));

  const [usersRes, projectsRes] = await Promise.all([
    assigneeIds.length
      ? db.from("users").select(USER_COLUMNS).in("id", assigneeIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    projectIds.length
      ? db.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const usersById = new Map<string, UserPublic>();
  for (const u of (usersRes.data ?? []) as UserPublic[]) usersById.set(u.id, u);

  const projectsById = new Map<string, { id: string; name: string }>();
  for (const p of (projectsRes.data ?? []) as Array<{ id: string; name: string }>) {
    projectsById.set(p.id, { id: p.id, name: p.name });
  }

  return rows.map((row) => {
    const assigneeId = row.assignee_id as string | null;
    const projectId = row.project_id as string | null;
    const task = withDefaults(row);
    task.assignee = assigneeId ? usersById.get(assigneeId) ?? null : null;
    task.project = projectId ? projectsById.get(projectId) ?? null : null;
    return task;
  });
}

/** Fetch a single already-persisted task, with relations attached. */
export async function fetchTaskById(id: string): Promise<Task | null> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("tasks").select(TASK_COLUMNS).eq("id", id).limit(1);

  if (error) throw new Error(error.message);

  const row = ((data ?? []) as Array<Record<string, unknown>>)[0];
  if (!row) return null;

  const task = withDefaults(row);

  const [userRes, projectRes] = await Promise.all([
    task.assignee_id
      ? db.from("users").select(USER_COLUMNS).eq("id", task.assignee_id).limit(1)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    task.project_id
      ? db.from("projects").select("id, name").eq("id", task.project_id).limit(1)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const user = ((userRes.data ?? []) as UserPublic[])[0] ?? null;
  const project = ((projectRes.data ?? []) as Array<{ id: string; name: string }>)[0] ?? null;

  task.assignee = user;
  task.project = project ?? null;
  return task;
}
