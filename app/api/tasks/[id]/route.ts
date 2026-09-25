import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

const SELECT = `id, project_id, parent_task_id, title, description, status, priority, assignee_id, start_date, due_date, duration_days, percent_complete, sort_order, tags, created_by, created_at, updated_at, assignee:users!tasks_assignee_id_fkey(id, username, name, title, role, created_at), project:projects(id, name)`;

function validPercent(value: unknown) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : null;
}

function withDefaults<T extends Record<string, unknown>>(task: T) {
  return {
    ...task,
    tags: Array.isArray(task.tags) ? task.tags : [],
    duration_days: task.duration_days ?? null,
    percent_complete: task.percent_complete ?? (task.status === "done" ? 100 : 0),
  };
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
    "tags",
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

  // Auto-calculate due_date from start_date and duration_days if start_date or duration_days is being updated
  if (("start_date" in (body ?? {})) || ("duration_days" in (body ?? {}))) {
    // Only auto-calculate if due_date is not explicitly being set in this request
    if (!("due_date" in (body ?? {}))) {
      const startDate = patch.start_date ?? body?.start_date ?? null;
      const durationDays = patch.duration_days ?? body?.duration_days ?? null;
      
      if (startDate && durationDays) {
        const parsedDuration = Number(durationDays);
        if (Number.isInteger(parsedDuration) && parsedDuration > 0) {
          const start = new Date(startDate + "T00:00:00");
          const end = new Date(start.getTime() + parsedDuration * 24 * 60 * 60 * 1000);
          const year = end.getFullYear();
          const month = String(end.getMonth() + 1).padStart(2, "0");
          const day = String(end.getDate()).padStart(2, "0");
          patch.due_date = `${year}-${month}-${day}`;
        }
      }
    }
  }

  const db = supabaseAdmin();
  // Fetch current task state before update to compare changes for activity log
  const { data: currentTask } = await db.from("tasks").select("status, assignee_id, priority, percent_complete, title").eq("id", params.id).single();

  const { data, error } = await db.from("tasks").update(patch).eq("id", params.id).select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log activity
  if (currentTask) {
    if (patch.status && patch.status !== currentTask.status) {
      await db.from("task_activity").insert({
        task_id: params.id,
        user_id: auth.id,
        action: "status_changed",
        details: `changed status from ${currentTask.status} to ${patch.status}`,
      });
    }
    if ("assignee_id" in patch && patch.assignee_id !== currentTask.assignee_id) {
      await db.from("task_activity").insert({
        task_id: params.id,
        user_id: auth.id,
        action: "assigned",
        details: patch.assignee_id ? "reassigned the task" : "unassigned the task",
      });
    }
    if (patch.priority && patch.priority !== currentTask.priority) {
      await db.from("task_activity").insert({
        task_id: params.id,
        user_id: auth.id,
        action: "priority_changed",
        details: `changed priority to ${patch.priority}`,
      });
    }
  }

  return NextResponse.json({ task: withDefaults(data as Record<string, unknown>) });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { error } = await supabaseAdmin().from("tasks").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
