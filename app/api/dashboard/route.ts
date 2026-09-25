import { NextResponse } from "next/server";
import { isDueSoon, isOverdue } from "@/lib/api";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const revalidate = 30;

type ProjectRow = { id: string; name: string; status: string };
type TaskRow = {
  id: string;
  project_id: string | null;
  status: string;
  due_date: string | null;
  project?: { id: string; name: string } | null;
  assignee?: { id: string; name: string; username: string } | null;
};
type Breakdown = Record<string, { name: string; total: number; done: number; overdue: number }>;

function bump(breakdown: Breakdown, key: string, name: string, task: TaskRow) {
  breakdown[key] ??= { name, total: 0, done: 0, overdue: 0 };
  breakdown[key].total += 1;
  if (task.status === "done") breakdown[key].done += 1;
  if (isOverdue(task)) breakdown[key].overdue += 1;
}

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();

  // Try primary task query with foreign key hints
  let { data: tasks, error: tErr } = await db
    .from("tasks")
    .select(
      "id, project_id, status, due_date, project:projects!tasks_project_id_fkey(id,name), assignee:users!tasks_assignee_id_fkey(id,name,username)"
    )
    .order("created_at", { ascending: false });

  // Fallback 1: try without foreign key constraint names
  if (tErr) {
    const fallback = await db
      .from("tasks")
      .select(
        "id, project_id, status, due_date, project:projects(id,name), assignee:users(id,name,username)"
      )
      .order("created_at", { ascending: false });

    if (!fallback.error && fallback.data) {
      tasks = fallback.data;
      tErr = null;
    } else {
      // Fallback 2: raw select * from tasks
      const rawRes = await db.from("tasks").select("*").order("created_at", { ascending: false });
      if (!rawRes.error && rawRes.data) {
        tasks = rawRes.data;
        tErr = null;
      }
    }
  }

  const { data: projects, error: pErr } = await db
    .from("projects")
    .select("id, name, status")
    .order("created_at", { ascending: false });

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const allTasks = (tasks ?? []) as unknown as TaskRow[];
  const allProjects = (projects ?? []) as ProjectRow[];
  const byStatus: Record<string, number> = { todo: 0, in_progress: 0, blocked: 0, done: 0 };
  const perProject: Breakdown = {};
  const perAssignee: Breakdown = {};
  let overdue = 0;
  let dueSoon = 0;
  let unscheduled = 0;

  for (const task of allTasks) {
    byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;

    if (isOverdue(task)) overdue += 1;
    if (isDueSoon(task)) dueSoon += 1;
    if (!task.due_date && task.status !== "done") unscheduled += 1;

    if (task.project) {
      bump(perProject, task.project.id, task.project.name, task);
    }

    if (task.assignee) {
      bump(perAssignee, task.assignee.id, task.assignee.name || task.assignee.username, task);
    }
  }

  const summary = {
    totalProjects: allProjects.length,
    totalTasks: allTasks.length,
    doneTasks: byStatus.done ?? 0,
    overdue,
    dueSoon,
    unscheduled,
    byStatus,
  };

  const recentProjects = (projects ?? [])
    .slice(0, 6)
    .map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      stats: perProject[project.id] ?? { name: project.name, total: 0, done: 0, overdue: 0 },
    }));

  return NextResponse.json({ summary, projects: recentProjects, perProject, perAssignee });
}
