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

// GET /api/tasks
//   ?project_id=<uuid>   -> all tasks (incl. subtasks) belonging to a project
//   ?standalone=true     -> tasks with no project (top-level only unless ?all=true)
//   (no params)          -> every task, for reporting
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const projectId = req.nextUrl.searchParams.get("project_id");
  const standalone = req.nextUrl.searchParams.get("standalone") === "true";

  const db = supabaseAdmin();
  let query = db.from("tasks").select(SELECT).order("sort_order", { ascending: true });

  if (projectId) {
    query = query.eq("project_id", projectId);
  } else if (standalone) {
    query = query.is("project_id", null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tasks: data });
}

// POST - create a task or subtask. project_id may be null (standalone task).
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const title = (body?.title ?? "").toString().trim();
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  const insert = {
    title,
    description: (body?.description ?? "").toString(),
    status: body?.status ?? "todo",
    priority: body?.priority ?? "medium",
    project_id: body?.project_id ?? null,
    parent_task_id: body?.parent_task_id ?? null,
    assignee_id: body?.assignee_id ?? null,
    start_date: body?.start_date || null,
    due_date: body?.due_date || null,
    sla_date: body?.sla_date || null,
    sort_order: body?.sort_order ?? 0,
    created_by: auth.id,
  };

  const db = supabaseAdmin();
  const { data, error } = await db.from("tasks").insert(insert).select(SELECT).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}
