import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

const PROFILE_SELECT = "id, username, name, title, role, created_at";

// GET /api/profile — return the current user's profile (never password_hash:
// the mock strips it via the column projection, and we only select public cols).
export async function GET(_req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("users")
    .select(PROFILE_SELECT)
    .eq("id", auth.id)
    .limit(1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const user = (data ?? [])[0] ?? null;
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Only include fields that were actually sent. Defaulting absent fields to ""
  // (the previous behaviour) silently wiped columns such as `role`.
  const patch: Record<string, unknown> = {};
  if ("name" in body) patch.name = String(body.name ?? "").slice(0, 100);
  if ("title" in body) patch.title = String(body.title ?? "").slice(0, 100);
  if ("role" in body) patch.role = String(body.role ?? "").slice(0, 50);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("users")
    .update(patch)
    .eq("id", auth.id)
    .select(PROFILE_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}

// PUT is an alias for PATCH so both verbs work for profile updates.
export const PUT = PATCH;
