import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

const OPTION_COLUMNS = "id, list_key, value, label, sort_order, created_at";

/**
 * Renaming or reordering a config option. The `value` is deliberately NOT
 * editable: it is what records store, so changing it would orphan them.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};

  if (body?.label !== undefined) {
    const label = String(body.label).trim();
    if (!label) return NextResponse.json({ error: "A label is required." }, { status: 400 });
    patch.label = label;
  }
  if (body?.sort_order !== undefined) {
    const order = Number(body.sort_order);
    if (!Number.isInteger(order)) {
      return NextResponse.json({ error: "sort_order must be a whole number." }, { status: 400 });
    }
    patch.sort_order = order;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("config_options")
    .update(patch)
    .eq("id", params.id)
    .select(OPTION_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ option: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();
  const { error } = await db.from("config_options").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
