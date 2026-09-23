import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

const PROJECT_SELECT =
  "id, name, description, status, start_date, end_date, percent_complete, accent_color, icon, owner_id, default_view, archived_at, created_by, created_at, updated_at";

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

  return NextResponse.json({ project: { ...project, accent_color: project.accent_color ?? "#12A594", icon: project.icon ?? "folder", default_view: project.default_view ?? "kanban" } });
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
    "accent_color",
    "icon",
    "owner_id",
    "default_view",
    "archived_at",
  ];

  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
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

  const { data, error } = await supabaseAdmin()
    .from("projects")
    .update(patch)
    .eq("id", params.id)
    .select(PROJECT_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project: { ...data, accent_color: data.accent_color ?? "#12A594", icon: data.icon ?? "folder", default_view: data.default_view ?? "kanban" } });
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
