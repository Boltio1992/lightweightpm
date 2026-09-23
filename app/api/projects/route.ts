import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

const PROJECT_SELECT =
  "id, name, description, status, start_date, end_date, percent_complete, accent_color, icon, owner_id, default_view, archived_at, created_by, created_at, updated_at";

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();
  const { data: projects, error: projectsError } = await db
    .from("projects")
    .select(PROJECT_SELECT)
    .order("created_at", { ascending: false });

  if (projectsError) return NextResponse.json({ error: projectsError.message }, { status: 500 });

  const { data: tasks, error: tasksError } = await db
    .from("tasks")
    .select("id, project_id, status, percent_complete, due_date")
    .not("project_id", "is", null);

  if (tasksError) return NextResponse.json({ error: tasksError.message }, { status: 500 });

  const stats: Record<string, { total: number; done: number; overdue: number; progressTotal: number }> = {};

  for (const task of tasks ?? []) {
    const pid = task.project_id as string;
    stats[pid] ??= { total: 0, done: 0, overdue: 0, progressTotal: 0 };
    stats[pid].total += 1;
    stats[pid].done += task.status === "done" ? 1 : 0;
    stats[pid].progressTotal += Number(task.percent_complete ?? (task.status === "done" ? 100 : 0));

    if (task.status !== "done" && task.due_date && new Date(`${task.due_date}T00:00:00`).getTime() < Date.now()) {
      stats[pid].overdue += 1;
    }
  }

  const withStats = (projects ?? []).map((project) => {
    const projectStats = stats[project.id] ?? { total: 0, done: 0, overdue: 0, progressTotal: 0 };
    return {
      ...project,
      accent_color: project.accent_color ?? "#12A594",
      icon: project.icon ?? "folder",
      default_view: project.default_view ?? "kanban",
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
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").toString().trim();
  if (!name) {
    return NextResponse.json({ error: "Project name is required." }, { status: 400 });
  }

  const insert = {
    name,
    description: (body?.description ?? "").toString(),
    status: body?.status ?? "active",
    start_date: body?.start_date ?? null,
    end_date: body?.end_date ?? null,
    percent_complete: Number(body?.percent_complete ?? 0),
    accent_color: body?.accent_color ?? "#12A594",
    icon: body?.icon ?? "folder",
    owner_id: body?.owner_id ?? auth.id,
    default_view: body?.default_view ?? "kanban",
    created_by: auth.id,
  };

  const { data, error } = await supabaseAdmin()
    .from("projects")
    .insert(insert)
    .select(PROJECT_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project: data });
}
