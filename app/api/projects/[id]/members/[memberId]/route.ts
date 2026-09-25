import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const role = body?.role ? String(body.role).trim() : null;
  if (!role) {
    return NextResponse.json({ error: "Role is required." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("project_members")
    .update({ role })
    .eq("id", params.memberId)
    .eq("project_id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();
  const { error } = await db
    .from("project_members")
    .delete()
    .eq("id", params.memberId)
    .eq("project_id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
