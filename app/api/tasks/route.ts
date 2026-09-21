import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

const SELECT = `id, project_id, parent_task_id, title, description, status, priority, assignee_id, start_date, due_date, sla_date, duration_days, percent_complete, sort_order, created_by, created_at, updated_at, assignee:users!tasks_assignee_id_fkey(id, username, name, title, role, created_at), project:projects(id, name)`;
function validPercent(value: unknown) { const n = Number(value); return Number.isInteger(n) && n >= 0 && n <= 100 ? n : null; }
export async function GET(req: NextRequest) {
  const auth = await requireUser(); if (auth instanceof NextResponse) return auth;
  const projectId = req.nextUrl.searchParams.get("project_id"); const standalone = req.nextUrl.searchParams.get("standalone") === "true";
  const db = supabaseAdmin(); let query = db.from("tasks").select(SELECT).order("sort_order", { ascending: true });
  if (projectId) query = query.eq("project_id", projectId); else if (standalone) query = query.is("project_id", null);
  const { data, error } = await query; if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data });
}
export async function POST(req: NextRequest) {
  const auth = await requireUser(); if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null); const title = (body?.title ?? "").toString().trim();
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  const complete = validPercent(body?.percent_complete ?? 0); if (complete == null) return NextResponse.json({ error: "% Complete must be between 0 and 100." }, { status: 400 });
  const duration = body?.duration_days == null || body.duration_days === "" ? null : Number(body.duration_days);
  if (duration != null && (!Number.isInteger(duration) || duration < 0)) return NextResponse.json({ error: "Duration must be a non-negative number of days." }, { status: 400 });
  const insert = { title, description: (body?.description ?? "").toString(), status: body?.status ?? (complete === 100 ? "done" : complete === 0 ? "todo" : "in_progress"), priority: body?.priority ?? "medium", project_id: body?.project_id ?? null, parent_task_id: body?.parent_task_id ?? null, assignee_id: body?.assignee_id ?? null, start_date: body?.start_date || null, due_date: body?.due_date || null, sla_date: body?.sla_date || null, duration_days: duration, percent_complete: complete, sort_order: body?.sort_order ?? 0, created_by: auth.id };
  const db = supabaseAdmin(); const { data, error } = await db.from("tasks").insert(insert).select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 }); return NextResponse.json({ task: data });
}
