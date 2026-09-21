import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

const SELECT = `
  id, project_id, parent_task_id, title, description, status, priority,
  assignee_id, start_date, due_date, sla_date, sort_order, created_by,
  created_at, updated_at,
  assignee:users!tasks_assignee_id_fkey(id, username, name, title, role, created_at),
  project:projects(id, name)
`;

const PATCHABLE = [
  "title",
  "description",
  "status",
  "priority",
  "assignee_id",
  "start_date",
  "due_date",
  "sla_date",
  "sort_order",
  "project_id",
  "parent_task_id",
];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};
  for (const key of PATCHABLE) {
    if (key in (body ?? {})) patch[key] = body[key];
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("tasks")
    .update(patch)
    .eq("id", params.id)
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();
  const { error } = await db.from("tasks").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
