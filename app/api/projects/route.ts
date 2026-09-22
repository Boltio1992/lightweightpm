import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();
  const { data: projects, error } = await db.from("projects").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: tasks } = await db.from("tasks").select("id, project_id, status, percent_complete, sla_date, due_date").not("project_id", "is", null);
  const now = new Date();
  const stats: Record<string, { total: number; done: number; overdue: number; progressTotal: number }> = {};

  for (const t of tasks ?? []) {
    const pid = t.project_id as string;
    stats[pid] ??= { total: 0, done: 0, overdue: 0, progressTotal: 0 };
    stats[pid].total++;
    stats[pid].done += t.status === "done" ? 1 : 0;
    stats[pid].progressTotal += Number(t.percent_complete ?? (t.status === "done" ? 100 : 0));

    const deadline = t.sla_date || t.due_date;
    if (deadline && t.status !== "done" && new Date(deadline) < now) stats[pid].overdue++;
  }

  const withStats = (projects ?? []).map((p) => ({
    ...p,
    stats: stats[p.id] ?? { total: 0, done: 0, overdue: 0, progressTotal: 0 },
    calculated_percent_complete: stats[p.id]?.total ? Math.round(stats[p.id].progressTotal / stats[p.id].total) : 0,
  }));

  return NextResponse.json({ projects: withStats });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const inputName = (body?.name ?? "").toString();
  const name = inputName.trim();

  if (!name) {
    return NextResponse.json({ error: "Project name is required." }, { status: 400 });
  }

  const description = (body?.description ?? "").toString().trim();
  const status = ((body?.status ?? "active").toString() || "active").trim();
  const start_date = body?.start_date || null;
  const end_date = body?.end_date || null;

  const percent = body?.percent_complete == null || body.percent_complete === "" ? null : Number(body.percent_complete);
  if (percent != null && (!Number.isInteger(percent) || percent < 0 || percent > 100)) {
    return NextResponse.json({ error: "% Complete must be between 0 and 100." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: project, error } = await db
    .from("projects")
    .insert({
      name,
      description,
      status,
      start_date,
      end_date,
      percent_complete: percent,
      created_by: auth.id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("project_members").insert({ project_id: project.id, user_id: auth.id, role: "owner" });
  return NextResponse.json({ project });
}
