import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("project_members")
    .select("id, project_id, user_id, role, added_at, user:users(id, username, name, title, role, created_at)")
    .eq("project_id", params.id)
    .order("added_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data });
}

// POST { user_id, role } - add an existing user (searched by name/username) to the project
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const user_id = body?.user_id;
  const role = (body?.role ?? "member").toString();

  if (!user_id) return NextResponse.json({ error: "user_id is required." }, { status: 400 });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("project_members")
    .insert({ project_id: params.id, user_id, role })
    .select("id, project_id, user_id, role, added_at, user:users(id, username, name, title, role, created_at)")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "That person is already a member." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ member: data });
}
