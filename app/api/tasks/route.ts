import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

const MODERN_TASK_SELECT =
  "id, project_id, parent_task_id, title, description, status, priority, assignee_id, start_date, due_date, sla_date, duration_days, percent_complete, sort_order, created_by, created_at, updated_at, assignee:users!tasks_assignee_id_fkey(id, username, name, title, role, created_at), project:projects(id, name)";

const LEGACY_TASK_SELECT =
  "id, project_id, parent_task_id, title, description, status, priority, assignee_id, start_date, due_date, sla_date, sort_order, created_by, created_at, updated_at, assignee:users!tasks_assignee_id_fkey(id, username, name, title, role, created_at), project:projects(id, name)";

function missingColumn(error: { message?: string } | null) {
  return /column .*does not exist|schema cache/i.test(error?.message ?? "");
}

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

  let query = db.from("tasks").select(MODERN_TASK_SELECT).order("sort_order", { ascending: true });
  if (projectId) {
    query = query.eq("project_id", projectId);
  } else if (standalone) {
    query = query.is("project_id", null);
  }

  const modernResult = await query;
  let data = modernResult.data;
  let error = modernResult.error;

  if (error && missingColumn(error)) {
    let legacy = db.from("tasks").select(LEGACY_TASK_SELECT).order("sort_order", { ascending: true });
    if (projectId) {
      legacy = legacy.eq("project_id", projectId);
    } else if (standalone) {
      legacy = legacy.is("project_id", null);
    }

    const legacyResult = await legacy;
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    tasks: (data ?? []).map((task) => withDefaults(task as Record<string, unknown>)),
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

  const base = {
    title,
    description: (body?.description ?? "").toString(),
    status: body?.status ?? (complete === 100 ? "done" : complete === 0 ? "todo" : "in_progress"),
    priority: body?.priority ?? "medium",
    assignee_id: body?.assignee_id ?? null,
    start_date: body?.start_date ?? null,
    due_date: body?.due_date ?? null,
    sla_date: body?.sla_date ?? null,
    project_id: body?.project_id ?? null,
    parent_task_id: body?.parent_task_id ?? null,
    sort_order: body?.sort_order ?? 0,
  };

  const modernResult = await supabaseAdmin()
    .from("tasks")
    .insert({
      ...base,
      duration_days: duration,
      percent_complete: complete,
    })
    .select(MODERN_TASK_SELECT)
    .single();

  let data = modernResult.data;
  let error = modernResult.error;

  if (error && missingColumn(error)) {
    const legacyResult = await supabaseAdmin()
      .from("tasks")
      .insert(base)
      .select(LEGACY_TASK_SELECT)
      .single();

    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    task: withDefaults(data as Record<string, unknown>),
  });
}
