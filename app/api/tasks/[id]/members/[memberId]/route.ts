import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

const MEMBER_SELECT =
  "id, task_id, user_id, role, added_at, user:users(id, username, name, title, role, created_at)";

export async function PATCH(req: NextRequest, { params }: { params: { taskId: string; memberId: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const role = String(body?.role ?? "").trim();
  if (!role) {
    return NextResponse.json({ error: "A role is required." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("task_members")
    .update({ role })
    .eq("id", params.memberId)
    .select(MEMBER_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { taskId: string; memberId: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();
  const { error } = await db.from("task_members").delete().eq("id", params.memberId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
