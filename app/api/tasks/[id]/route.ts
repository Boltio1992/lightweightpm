import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

const SELECT = `id, project_id, parent_task_id, title, description, status, priority, assignee_id, start_date, due_date, duration_days, percent_complete, sort_order, created_by, created_at, updated_at, assignee:users!tasks_assignee_id_fkey(id, username, name, title, role, created_at), project:projects(id, name)`;

function validPercent(value: unknown) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};

  for (const key of [
    "title",
    "description",
    "status",
    "priority",
    "assignee_id",
    "start_date",
    "due_date",
    "duration_days",
    "project_id",
    "parent_task_id",
    "sort_order",
  ]) {
    if (key in (body ?? {})) patch[key] = body[key];
  }

  if ("percent_complete" in (body ?? {})) {
    const value = validPercent(body.percent_complete);
    if (value == null) {
      return NextResponse.json({ error: "% Complete must be between 0 and 100." }, { status: 400 });
    }
    patch.percent_complete = value;
  }

  const db = supabaseAdmin();
  const { data, error } = await db.from("tasks").update(patch).eq("id", params.id).select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ task: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { error } = await supabaseAdmin().from("tasks").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
