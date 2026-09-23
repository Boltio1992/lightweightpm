import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

const TASK_SELECT =
  "id, project_id, parent_task_id, title, description, status, priority, assignee_id, start_date, due_date, duration_days, percent_complete, sort_order, created_by, created_at, updated_at, assignee:users!tasks_assignee_id_fkey(id, username, name, title, role, created_at), project:projects!tasks_project_id_fkey(id, name)";

function withDefaults<T extends Record<string, unknown>>(task: T) {
  return {
    ...task,
    duration_days: task.duration_days ?? null,
    percent_complete: task.percent_complete ?? (task.status === "done" ? 100 : 0),
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const projectId = req.nextUrl.searchParams.get("project_id");
  const standalone = req.nextUrl.searchParams.get("standalone") === "true";
  const db = supabaseAdmin();

  let query = db.from("tasks").select(TASK_SELECT).order("sort_order", { ascending: true });
  if (projectId) {
    query = query.eq("project_id", projectId);
  } else if (standalone) {
    query = query.is("project_id", null);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    tasks: (data ?? []).map((task) => withDefaults(task)),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const title = (body?.title ?? "").toString().trim();

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const complete = Number(body?.percent_complete ?? 0);
  const duration =
    body?.duration_days == null || body.duration_days === "" ? null : Number(body.duration_days);

  if (!Number.isInteger(complete) || complete < 0 || complete > 100) {
    return NextResponse.json({ error: "% Complete must be between 0 and 100." }, { status: 400 });
  }

  if (duration != null && (!Number.isInteger(duration) || duration < 0)) {
    return NextResponse.json({ error: "Duration must be a non-negative number of days." }, { status: 400 });
  }

  // Auto-calculate due_date from start_date and duration_days if not explicitly provided
  let dueDate = body?.due_date ?? null;
  if (!dueDate && body?.start_date && duration) {
    const startDate = new Date(body.start_date + "T00:00:00");
    const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
    const year = endDate.getFullYear();
    const month = String(endDate.getMonth() + 1).padStart(2, "0");
    const day = String(endDate.getDate()).padStart(2, "0");
    dueDate = `${year}-${month}-${day}`;
  }

  const base = {
    title,
    description: (body?.description ?? "").toString(),
    status: body?.status ?? (complete === 100 ? "done" : complete === 0 ? "todo" : "in_progress"),
    priority: body?.priority ?? "medium",
    assignee_id: body?.assignee_id ?? null,
    start_date: body?.start_date ?? null,
    due_date: dueDate,
    project_id: body?.project_id ?? null,
    parent_task_id: body?.parent_task_id ?? null,
    sort_order: body?.sort_order ?? 0,
  };

  const { data, error } = await supabaseAdmin()
    .from("tasks")
    .insert({
      ...base,
      duration_days: duration,
      percent_complete: complete,
    })
    .select(TASK_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    task: withDefaults(data as Record<string, unknown>),
  });
}
