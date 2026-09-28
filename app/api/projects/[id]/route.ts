import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { updateSkippingMissingColumns } from "@/lib/resilientInsert";
import { supabaseAdmin } from "@/lib/supabaseServer";

// "*" instead of an explicit list: naming a column the live database (or
// PostgREST's schema cache) does not know makes the query fail, which surfaced
// as a bogus 404 → "Project not found" on the project detail page.
const PROJECT_SELECT = "*";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();
  const { data: project, error } = await db
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("id", params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ project: { ...project, icon: project.icon ?? "folder", default_view: project.default_view ?? "kanban" } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  const allowed = [
    "name",
    "description",
    "status",
    "start_date",
    "end_date",
    "percent_complete",
    "icon",
    "owner_id",
    "default_view",
    "archived_at",
  ];

  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  if (patch.status === "archived" && !patch.archived_at) {
    patch.archived_at = new Date().toISOString();
  } else if (patch.status && patch.status !== "archived") {
    patch.archived_at = null;
  }

  if (patch.name !== undefined && String(patch.name).trim() === "") {
    return NextResponse.json({ error: "Project name is required." }, { status: 400 });
  }

  if (patch.percent_complete !== undefined) {
    const value = Number(patch.percent_complete);
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      return NextResponse.json({ error: "Percent complete must be between 0 and 100." }, { status: 400 });
    }
    patch.percent_complete = value;
  }

  // Columns like icon / default_view may not exist in older
  // databases; drop them rather than failing the whole edit.
  const result = await updateSkippingMissingColumns<Record<string, any>>(
    "projects",
    patch,
    { column: "id", value: params.id },
    PROJECT_SELECT
  );

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const data = (result.data ?? [])[0] ?? null;
  if (!data) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json({
    project: {
      ...data,
      icon: data.icon ?? "folder",
      default_view: data.default_view ?? "kanban",
    },
    droppedColumns: result.droppedColumns,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { error } = await supabaseAdmin().from("projects").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
