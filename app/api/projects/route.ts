import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

// GET /api/projects - list all projects, with task counts
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();

  const { data: projects, error } = await db
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: tasks } = await db
    .from("tasks")
    .select("id, project_id, status, sla_date, due_date")
    .not("project_id", "is", null);

  const now = new Date();
  const stats: Record<string, { total: number; done: number; overdue: number }> = {};
  for (const t of tasks ?? []) {
    const pid = t.project_id as string;
    stats[pid] ??= { total: 0, done: 0, overdue: 0 };
    stats[pid].total += 1;
    if (t.status === "done") stats[pid].done += 1;
    const deadline = t.sla_date || t.due_date;
    if (deadline && t.status !== "done" && new Date(deadline) < now) {
      stats[pid].overdue += 1;
    }
  }

  const withStats = (projects ?? []).map((p) => ({
    ...p,
    stats: stats[p.id] ?? { total: 0, done: 0, overdue: 0 },
  }));

  return NextResponse.json({ projects: withStats });
}

// POST /api/projects - create a project (creator is auto-added as owner member)
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").toString().trim();
  if (!name) return NextResponse.json({ error: "Project name is required." }, { status: 400 });

  const description = (body?.description ?? "").toString();
  const status = (body?.status ?? "active").toString();
  const start_date = body?.start_date || null;
  const end_date = body?.end_date || null;

  const db = supabaseAdmin();
  const { data: project, error } = await db
    .from("projects")
    .insert({ name, description, status, start_date, end_date, created_by: auth.id })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db
    .from("project_members")
    .insert({ project_id: project.id, user_id: auth.id, role: "owner" });

  return NextResponse.json({ project });
}
