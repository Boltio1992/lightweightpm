import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const revalidate = 30;

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();
  const { data: projects, error: projectsError } = await db
    .from("projects")
    .select("id, name, description, status, start_date, end_date, percent_complete")
    .order("created_at", { ascending: false });

  if (projectsError) return NextResponse.json({ error: projectsError.message }, { status: 500 });

  const { data: tasks, error: tasksError } = await db
    .from("tasks")
    .select("id, project_id, status, percent_complete, sla_date, due_date")
    .not("project_id", "is", null);

  if (tasksError) return NextResponse.json({ error: tasksError.message }, { status: 500 });

  const now = new Date();
  const stats: Record<string, { total: number; done: number; overdue: number; progressTotal: number }> = {};

  for (const task of tasks ?? []) {
    const pid = task.project_id as string;
    stats[pid] ??= { total: 0, done: 0, overdue: 0, progressTotal: 0 };
    stats[pid].total += 1;
    stats[pid].done += task.status === "done" ? 1 : 0;
    stats[pid].progressTotal += Number(task.percent_complete ?? (task.status === "done" ? 100 : 0));

    const deadline = task.sla_date || task.due_date;
    if (deadline && task.status !== "done" && new Date(deadline) < now) stats[pid].overdue += 1;
  }

  const withStats = (projects ?? []).map((project) => {
    const projectStats = stats[project.id] ?? { total: 0, done: 0, overdue: 0, progressTotal: 0 };
    return {
      ...project,
      stats: {
        total: projectStats.total,
        done: projectStats.done,
        overdue: projectStats.overdue,
      },
      calculated_percent_complete: projectStats.total ? Math.round(projectStats.progressTotal / projectStats.total) : 0,
    };
  });

  return NextResponse.json({ projects: withStats });
}

export async function POST(req: NextRequest) {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
