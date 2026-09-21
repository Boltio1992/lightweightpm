import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function PATCH(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").toString().slice(0, 100);
  const title = (body?.title ?? "").toString().slice(0, 100);
  const role = (body?.role ?? "").toString().slice(0, 50);

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("users")
    .update({ name, title, role })
    .eq("id", auth.id)
    .select("id, username, name, title, role, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}
