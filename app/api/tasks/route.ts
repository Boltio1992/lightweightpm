import { NextRequest, NextResponse } from "next/server";
import { calculateDueDate } from "@/lib/api";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { fetchTaskById, fetchTasks } from "@/lib/tasks-query";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const projectId = req.nextUrl.searchParams.get("project_id");
  const standalone = req.nextUrl.searchParams.get("standalone") === "true";

  try {
    const tasks = await fetchTasks({ projectId, standalone });
    return NextResponse.json(
      { tasks },
      {
        headers: {
          // Private per-user data: never let a CDN or the browser disk cache serve it.
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load tasks." },
      { status: 500 }
    );
  }
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
  const dueDate = body?.due_date ?? calculateDueDate(body?.start_date, duration);

  const row = {
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
    tags: Array.isArray(body?.tags) ? body.tags : [],
    duration_days: duration,
    percent_complete: complete,
    created_by: auth.id,
  };

  const db = supabaseAdmin();
  const { data, error } = await db.from("tasks").insert(row).select("id").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.id) {
    return NextResponse.json({ error: "Task could not be created." }, { status: 500 });
  }

  // Fire-and-forget: the activity log must never block the task response.
  void db.from("task_activity").insert({
    task_id: data.id,
    user_id: auth.id,
    action: "created",
    details: "created the task",
  });

  try {
    const task = await fetchTaskById(data.id);
    return NextResponse.json({ task });
  } catch {
    // The row exists; return the plain insert result rather than failing the request.
    return NextResponse.json({ task: { ...row, id: data.id } });
  }
}
