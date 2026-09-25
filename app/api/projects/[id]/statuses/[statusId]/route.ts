import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; statusId: string } }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};

  if (body?.name !== undefined) patch.name = String(body.name).trim();
  if (body?.color !== undefined) patch.color = String(body.color);
  if (body?.sort_order !== undefined) patch.sort_order = Number(body.sort_order);
  if (body?.is_done !== undefined) patch.is_done = Boolean(body.is_done);

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("project_statuses")
    .update(patch)
    .eq("id", params.statusId)
    .eq("project_id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; statusId: string } }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();

  // Find the status to be deleted to know its key
  const { data: statusToDelete } = await db
    .from("project_statuses")
    .select()
    .eq("id", params.statusId)
    .eq("project_id", params.id)
    .single();

  if (!statusToDelete) {
    return NextResponse.json({ error: "Status not found." }, { status: 404 });
  }

  // Find fallback status for tasks (e.g. first status or 'todo')
  const { data: otherStatuses } = await db
    .from("project_statuses")
    .select()
    .eq("project_id", params.id)
    .not("id", "is", params.statusId)
    .order("sort_order", { ascending: true });

  if (!otherStatuses || otherStatuses.length === 0) {
    return NextResponse.json({ error: "Cannot delete the only status for a project." }, { status: 400 });
  }

  const fallbackKey = otherStatuses[0].key;

  // Reassign any tasks currently having this status key
  await db
    .from("tasks")
    .update({ status: fallbackKey })
    .eq("project_id", params.id)
    .eq("status", statusToDelete.key);

  const { error } = await db
    .from("project_statuses")
    .delete()
    .eq("id", params.statusId)
    .eq("project_id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
