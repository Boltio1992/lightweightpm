import { NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const revalidate = 30;

function buildSummary(tasks: Array<{ id: string; project_id: string | null; parent_task_id: string | null; status: string; due_date?: string | null; sla_date?: string | null }>, projects: Array<{ id: string; name: string; status: string }>) {
  const byStatus: Record<string, number> = { todo: 0, in_progress: 0, blocked: 0, done: 0 };
  let overdue = 0;
  let dueSoon = 0;
  let projectTaskCount = 0;
  let standaloneTaskCount = 0;
  let subtaskCount = 0;
  const now = new Date();

  for (const task of tasks) {
    byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;

    if (task.parent_task_id) subtaskCount += 1;
    if (task.project_id) projectTaskCount += 1;
    else standaloneTaskCount += 1;

    const deadline = task.sla_date || task.due_date;
    const isOverdue = !!deadline && task.status !== "done" && new Date(deadline) < now;
    const isDueSoon =
      !!deadline &&
      task.status !== "done" &&
      !isOverdue &&
      new Date(deadline).getTime() - now.getTime() < 3 * 24 * 60 * 60 * 1000;

    if (isOverdue) overdue += 1;
    if (isDueSoon) dueSoon += 1;
  }

  const projectStats: Record<string, { total: number; done: number; overdue: number }> = {};
  for (const task of tasks) {
    if (!task.project_id) continue;
    projectStats[task.project_id] ??= { total: 0, done: 0, overdue: 0 };
    projectStats[task.project_id].total += 1;
    if (task.status === "done") projectStats[task.project_id].done += 1;

    const deadline = task.sla_date || task.due_date;
    if (deadline && task.status !== "done" && new Date(deadline) < now) {
      projectStats[task.project_id].overdue += 1;
    }
  }

  const totalTasks = tasks.length;
  const summary = {
    totalProjects: projects.length,
    totalTasks,
    projectTaskCount,
    standaloneTaskCount,
    subtaskCount,
    doneTasks: byStatus.done ?? 0,
    overdue,
    dueSoon,
    slaCompliance: totalTasks === 0 ? 100 : Math.round(((totalTasks - overdue) / totalTasks) * 100),
    byStatus,
  };

  return { summary, projectStats };
}

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();
  const [{ data: tasks, error: tErr }, { data: projects, error: pErr }] = await Promise.all([
    db
      .from("tasks")
      .select("id, project_id, parent_task_id, status, due_date, sla_date")
      .order("created_at", { ascending: false }),
    db.from("projects").select("id, name, status").order("created_at", { ascending: false }),
  ]);

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const { summary, projectStats } = buildSummary(tasks ?? [], projects ?? []);
  const recentProjects = (projects ?? [])
    .slice(0, 6)
    .map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      stats: projectStats[project.id] ?? { total: 0, done: 0, overdue: 0 },
    }));

  return NextResponse.json({ summary, projects: recentProjects });
}
