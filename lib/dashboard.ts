import { NextResponse } from "next/server";
import { isDueSoon, isOverdue } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseServer";

export type DashboardSummary = {
  totalProjects: number;
  totalTasks: number;
  doneTasks: number;
  overdue: number;
  dueSoon: number;
  unscheduled: number;
  byStatus: Record<string, number>;
};

export type DashboardProjectRow = {
  id: string;
  name: string;
  status: string;
  stats: { total: number; done: number; overdue: number };
};

export type DashboardBreakdown = Record<string, { name: string; total: number; done: number; overdue: number }>;

type DashboardTaskRow = {
  id: string;
  project_id: string | null;
  status: string;
  due_date: string | null;
  project?: { id: string; name: string } | null;
  assignee?: { id: string; name: string; username: string } | null;
};

type DashboardProjectRowRecord = { id: string; name: string; status: string };

export async function getDashboardData() {
  const db = supabaseAdmin();

  // Plain selects + explicit lookups: embedded FK-hinted joins are brittle and
  // were silently falling back to slower paths.
  const [tasksRes, projectsRes] = await Promise.all([
    db.from("tasks").select("id, project_id, status, due_date, assignee_id"),
    db.from("projects").select("id, name, status").order("created_at", { ascending: false }),
  ]);

  if (tasksRes.error) throw new Error(tasksRes.error.message);
  if (projectsRes.error) throw new Error(projectsRes.error.message);

  const taskRows = (tasksRes.data ?? []) as Array<{
    id: string;
    project_id: string | null;
    status: string;
    due_date: string | null;
    assignee_id: string | null;
  }>;

  const allProjects = (projectsRes.data ?? []) as DashboardProjectRowRecord[];

  const projectNames = new Map(allProjects.map((p) => [p.id, p.name] as const));

  const assigneeIds = [...new Set(taskRows.map((t) => t.assignee_id).filter((v): v is string => !!v))];
  const usersRes = assigneeIds.length
    ? await db.from("users").select("id, name, username").in("id", assigneeIds)
    : { data: [] as Array<{ id: string; name: string; username: string }> };

  if (usersRes && "error" in usersRes && usersRes.error) {
    throw new Error((usersRes.error as { message: string }).message);
  }

  const usersById = new Map(
    ((usersRes?.data ?? []) as Array<{ id: string; name: string; username: string }>).map(
      (u) => [u.id, u] as const
    )
  );

  const allTasks: DashboardTaskRow[] = taskRows.map((task) => ({
    id: task.id,
    project_id: task.project_id,
    status: task.status,
    due_date: task.due_date,
    project: task.project_id
      ? { id: task.project_id, name: projectNames.get(task.project_id) ?? "Untitled" }
      : null,
    assignee: task.assignee_id ? usersById.get(task.assignee_id) ?? null : null,
  }));

  const byStatus: Record<string, number> = { todo: 0, in_progress: 0, blocked: 0, done: 0 };
  const perProject: DashboardBreakdown = {};
  const perAssignee: DashboardBreakdown = {};
  let overdue = 0;
  let dueSoon = 0;
  let unscheduled = 0;

  for (const task of allTasks) {
    byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;

    if (isOverdue(task)) overdue += 1;
    if (isDueSoon(task)) dueSoon += 1;
    if (!task.due_date && task.status !== "done") unscheduled += 1;

    if (task.project) {
      perProject[task.project.id] ??= { name: task.project.name, total: 0, done: 0, overdue: 0 };
      perProject[task.project.id].total += 1;
      if (task.status === "done") perProject[task.project.id].done += 1;
      if (isOverdue(task)) perProject[task.project.id].overdue += 1;
    }

    if (task.assignee) {
      const assigneeKey = task.assignee.id;
      perAssignee[assigneeKey] ??= {
        name: task.assignee.name || task.assignee.username,
        total: 0,
        done: 0,
        overdue: 0,
      };
      perAssignee[assigneeKey].total += 1;
      if (task.status === "done") perAssignee[assigneeKey].done += 1;
      if (isOverdue(task)) perAssignee[assigneeKey].overdue += 1;
    }
  }

  const summary: DashboardSummary = {
    totalProjects: allProjects.length,
    totalTasks: allTasks.length,
    doneTasks: byStatus.done ?? 0,
    overdue,
    dueSoon,
    unscheduled,
    byStatus,
  };

  const recentProjects: DashboardProjectRow[] = allProjects.slice(0, 6).map((project) => ({
    id: project.id,
    name: project.name,
    status: project.status,
    stats: perProject[project.id] ?? { name: project.name, total: 0, done: 0, overdue: 0 },
  }));

  return { summary, projects: recentProjects, perProject, perAssignee };
}
