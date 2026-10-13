import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { isProjectAdmin } from "@/lib/authorize";
import { NEW_REQUEST_VALUE } from "@/lib/configLists";
import { updateSkippingMissingColumns } from "@/lib/resilientInsert";
import { supabaseAdmin } from "@/lib/supabaseServer";

/**
 * Verifies the caller is allowed to mutate the given project: either they
 * created it, or they hold an admin/owner role in the project's membership.
 * Returns null when permitted, or a NextResponse describing the failure.
 */
async function authorizeProjectMutation(
  userId: string,
  projectId: string
): Promise<NextResponse | null> {
  const db = supabaseAdmin();
  const { data: project, error } = await db
    .from("projects")
    .select("id, created_by")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const isCreator = project.created_by === userId;
  const isAdmin = await isProjectAdmin(userId, projectId);
  if (!isCreator && !isAdmin) {
    return NextResponse.json(
      { error: "You do not have permission to modify this project." },
      { status: 403 }
    );
  }

  return null;
}

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

  const forbidden = await authorizeProjectMutation(auth.id, params.id);
  if (forbidden) return forbidden;

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
    // Classification: settable at create time and editable afterwards, so a
    // typo made during creation can be corrected here. Values are keys from
    // the configurable Admin lists, never a hard-coded enum.
    "reference_no",
    "type",
    "plan_class",
    "request_type",
  ];

  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  // Blank classification fields mean "not set" (null), matching POST
  // /api/projects. request_type only applies to New Request work, so it is
  // cleared whenever the effective plan class says otherwise — the same rule
  // the create form applies client-side.
  for (const key of ["reference_no", "type", "plan_class", "request_type"] as const) {
    if (key in patch) {
      patch[key] = String(patch[key] ?? "").trim() || null;
    }
  }
  if ("plan_class" in patch || "request_type" in patch) {
    const { data: current } = await supabaseAdmin()
      .from("projects")
      .select("plan_class")
      .eq("id", params.id)
      .maybeSingle();
    const effectivePlanClass =
      "plan_class" in patch
        ? (patch.plan_class as string | null)
        : ((current?.plan_class as string | null) ?? null);
    if (effectivePlanClass !== NEW_REQUEST_VALUE) {
      patch.request_type = null;
    }
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

  const forbidden = await authorizeProjectMutation(auth.id, params.id);
  if (forbidden) return forbidden;

  const { error } = await supabaseAdmin().from("projects").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
