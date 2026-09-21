import { NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();

  const [{ data: tasks, error: tErr }, { data: projects, error: pErr }] = await Promise.all([
    db
      .from("tasks")
      .select(
        "id, project_id, parent_task_id, status, priority, assignee_id, due_date, sla_date, project:projects(id,name), assignee:users!tasks_assignee_id_fkey(id,name,username)"
      ),
    db.from("projects").select("id, name, status"),
  ]);

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const now = new Date();
  const all = tasks ?? [];

  const byStatus: Record<string, number> = { todo: 0, in_progress: 0, blocked: 0, done: 0 };
  let overdue = 0;
  let dueSoon = 0; // due within 3 days, not done
  let projectTaskCount = 0;
  let standaloneTaskCount = 0;
  let subtaskCount = 0;

  const perProject: Record<string, { name: string; total: number; done: number; overdue: number }> = {};
  const perAssignee: Record<string, { name: string; total: number; done: number; overdue: number }> = {};

  for (const t of all) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;

    if (t.parent_task_id) subtaskCount += 1;
    if (t.project_id) projectTaskCount += 1;
    else standaloneTaskCount += 1;

    const deadline = t.sla_date || t.due_date;
    const isOverdue = !!deadline && t.status !== "done" && new Date(deadline) < now;
    const isDueSoon =
      !!deadline &&
      t.status !== "done" &&
      !isOverdue &&
      new Date(deadline).getTime() - now.getTime() < 3 * 24 * 60 * 60 * 1000;

    if (isOverdue) overdue += 1;
    if (isDueSoon) dueSoon += 1;

    if (t.project) {
      const proj = t.project as unknown as { id: string; name: string };
      perProject[proj.id] ??= { name: proj.name, total: 0, done: 0, overdue: 0 };
      perProject[proj.id].total += 1;
      if (t.status === "done") perProject[proj.id].done += 1;
      if (isOverdue) perProject[proj.id].overdue += 1;
    }

    if (t.assignee) {
      const a = t.assignee as unknown as { id: string; name: string; username: string };
      perAssignee[a.id] ??= { name: a.name || a.username, total: 0, done: 0, overdue: 0 };
      perAssignee[a.id].total += 1;
      if (t.status === "done") perAssignee[a.id].done += 1;
      if (isOverdue) perAssignee[a.id].overdue += 1;
    }
  }

  const totalTasks = all.length;
  const doneTasks = byStatus.done ?? 0;
  const slaCompliance =
    totalTasks === 0 ? 100 : Math.round(((totalTasks - overdue) / totalTasks) * 100);

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
