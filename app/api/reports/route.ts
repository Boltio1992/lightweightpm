import { NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const revalidate = 30;

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();

  const [{ data: tasks, error: tErr }, { data: projects, error: pErr }] = await Promise.all([
    db
      .from("tasks")
      .select(
        "id, project_id, parent_task_id, status, priority, assignee_id, due_date, sla_date, project:projects!tasks_project_id_fkey(id,name), assignee:users!tasks_assignee_id_fkey(id,name,username)"
      ),
    db.from("projects").select("id, name, status"),
  ]);

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const now = new Date();
  const all = tasks ?? [];

  const byStatus: Record<string, number> = { todo: 0, in_progress: 0, blocked: 0, done: 0 };
  let overdue = 0;
  let dueSoon = 0;
  let projectTaskCount = 0;
  let standaloneTaskCount = 0;
  let subtaskCount = 0;

  const perProject: Record<string, { name: string; total: number; done: number; overdue: number }> = {};
  const perAssignee: Record<string, { name: string; total: number; done: number; overdue: number }> = {};

  for (const task of all) {
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

    if (task.project) {
      const proj = task.project as unknown as { id: string; name: string };
      perProject[proj.id] ??= { name: proj.name, total: 0, done: 0, overdue: 0 };
      perProject[proj.id].total += 1;
      if (task.status === "done") perProject[proj.id].done += 1;
      if (isOverdue) perProject[proj.id].overdue += 1;
    }

    if (task.assignee) {
      const assignee = task.assignee as unknown as { id: string; name: string; username: string };
      perAssignee[assignee.id] ??= { name: assignee.name || assignee.username, total: 0, done: 0, overdue: 0 };
      perAssignee[assignee.id].total += 1;
      if (task.status === "done") perAssignee[assignee.id].done += 1;
      if (isOverdue) perAssignee[assignee.id].overdue += 1;
    }
  }

  const totalTasks = all.length;
  const doneTasks = byStatus.done ?? 0;
  const slaCompliance = totalTasks === 0 ? 100 : Math.round(((totalTasks - overdue) / totalTasks) * 100);

  return NextResponse.json({
    summary: {
      totalProjects: (projects ?? []).length,
      totalTasks,
      projectTaskCount,
      standaloneTaskCount,
      subtaskCount,
      doneTasks,
      overdue,
      dueSoon,
      slaCompliance,
      byStatus,
    },
    perProject,
    perAssignee,
  });
}
















































































































n
n
n
n
n
n



