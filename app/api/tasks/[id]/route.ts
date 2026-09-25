import { NextRequest, NextResponse } from "next/server";
import { calculateDueDate } from "@/lib/api";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { fetchTaskById } from "@/lib/tasks-query";

export const dynamic = "force-dynamic";

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

  // Auto-calculate due_date from start_date + duration_days, unless due_date is set explicitly.
  if (("start_date" in (body ?? {}) || "duration_days" in (body ?? {})) && !("due_date" in (body ?? {}))) {
    const startDate = (patch.start_date ?? body?.start_date ?? null) as string | null;
    const durationDays = Number(patch.duration_days ?? body?.duration_days ?? 0);
    const computed = calculateDueDate(startDate, durationDays);
    if (computed) patch.due_date = computed;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Read the current state (for the activity diff) and apply the update in one
  // round trip each; the previous FK-hinted select could silently fail.
  const [{ data: currentTask }, updateRes] = await Promise.all([
    db.from("tasks").select("status, assignee_id, priority").eq("id", params.id).limit(1),
    db.from("tasks").update(patch).eq("id", params.id).select("id"),
  ]);

  if (updateRes.error) {
    return NextResponse.json({ error: updateRes.error.message }, { status: 500 });
  }

  const current = ((currentTask ?? []) as Array<Record<string, unknown>>)[0] ?? null;

  // Batch every activity entry the patch produced into a single insert.
  if (current) {
    const entries: Array<{ task_id: string; user_id: string; action: string; details: string }> = [];

    if (patch.status != null && patch.status !== current.status) {
      entries.push({
        task_id: params.id,
        user_id: auth.id,
        action: "status_changed",
        details: `changed status from ${current.status} to ${patch.status}`,
      });
    }
    if ("assignee_id" in patch && patch.assignee_id !== current.assignee_id) {
      entries.push({
        task_id: params.id,
        user_id: auth.id,
        action: "assigned",
        details: patch.assignee_id ? "reassigned the task" : "unassigned the task",
      });
    }
    if (patch.priority != null && patch.priority !== current.priority) {
      entries.push({
        task_id: params.id,
        user_id: auth.id,
        action: "priority_changed",
        details: `changed priority to ${patch.priority}`,
      });
    }

    if (entries.length > 0) {
      void db.from("task_activity").insert(entries);
    }
  }

  try {
    const task = await fetchTaskById(params.id);
    return NextResponse.json({ task });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Task updated but could not be reloaded." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { error } = await supabaseAdmin().from("tasks").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
