import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

/**
 * People named on a project-less task. Mirrors the project members API, minus
 * the "data member" flow: a task is small enough that a registered user is
 * always the right thing to attach.
 */

const MEMBER_SELECT =
  "id, task_id, user_id, role, added_at, user:users(id, username, name, title, role, created_at)";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("task_members")
    .select(MEMBER_SELECT)
    .eq("task_id", params.id)
    .order("added_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const user_id = String(body?.user_id ?? "").trim();
  const role = String(body?.role ?? "member").trim() || "member";

  if (!user_id) {
    return NextResponse.json({ error: "user_id is required." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("task_members")
    .insert({ task_id: params.id, user_id, role })
    .select(MEMBER_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "That person is already on this task." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ member: data }, { status: 201 });
}
