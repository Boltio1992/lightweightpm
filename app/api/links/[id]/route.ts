import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { LINK_COLUMNS, validProgress } from "@/lib/links";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};

  if (body?.reference !== undefined) {
    const reference = String(body.reference).trim();
    if (!reference) {
      return NextResponse.json({ error: "A reference is required." }, { status: 400 });
    }
    patch.reference = reference;
  }
  if (body?.title !== undefined) {
    patch.title = body.title === null ? null : String(body.title).trim() || null;
  }
  if (body?.progress_percent !== undefined) {
    const n = validProgress(body.progress_percent);
    if (body.progress_percent !== null && body.progress_percent !== "" && n === null) {
      return NextResponse.json(
        { error: "progress_percent must be a whole number between 0 and 100." },
        { status: 400 }
      );
    }
    patch.progress_percent = n;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("links")
    .update(patch)
    .eq("id", params.id)
    .select(LINK_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();
  const { error } = await db.from("links").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
