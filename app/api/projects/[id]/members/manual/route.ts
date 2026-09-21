import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

// POST { name, title, role }
// Creates a "data member": a placeholder user record typed in by hand, so a
// person who never logs in can still be a project member and be assigned tasks.
// They get an unusable password hash, so this account can never be logged into.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").toString().trim();
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const title = (body?.title ?? "").toString().trim();
  const role = (body?.role ?? "member").toString().trim() || "member";

  // derive a unique, non-loginable username from the name
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 20) || "member";
  const username = `${base}.${randomUUID().slice(0, 6)}`;

  const db = supabaseAdmin();

  const { data: user, error: userErr } = await db
    .from("users")
    .insert({
      username,
      // bcrypt hashes never start with "!", so this can never match a password
      password_hash: "!placeholder-no-login",
      name,
      title,
      role,
      is_placeholder: true,
    })
    .select("id, username, name, title, role, created_at")
    .single();

  if (userErr || !user) {
    return NextResponse.json({ error: userErr?.message ?? "Could not create member." }, { status: 500 });
  }

  const { data: member, error: memberErr } = await db
    .from("project_members")
    .insert({ project_id: params.id, user_id: user.id, role })
    .select(
      "id, project_id, user_id, role, added_at, user:users(id, username, name, title, role, created_at)"
    )
    .single();

  if (memberErr) {
    return NextResponse.json({ error: memberErr.message }, { status: 500 });
  }

  return NextResponse.json({ member });
}
