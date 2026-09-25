import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { randomUUID } from "crypto";
import type { ProjectStatus } from "@/types";

const DEFAULT_STATUSES = [
  { name: "To Do", key: "todo", color: "#94A3B8", sort_order: 0, is_done: false },
  { name: "In Progress", key: "in_progress", color: "#12A594", sort_order: 1, is_done: false },
  { name: "Review", key: "review", color: "#F59E0B", sort_order: 2, is_done: false },
  { name: "Blocked", key: "blocked", color: "#EF4444", sort_order: 3, is_done: false },
  { name: "Done", key: "done", color: "#10B981", sort_order: 4, is_done: true },
];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("project_statuses")
    .select("id, project_id, name, key, color, sort_order, is_done")
    .eq("project_id", params.id)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let statuses = (data ?? []) as ProjectStatus[];

  // If no custom statuses exist yet for this project, seed the defaults
  if (statuses.length === 0) {
    const toInsert = DEFAULT_STATUSES.map((s) => ({
      id: randomUUID(),
      project_id: params.id,
      ...s,
    }));
    await db.from("project_statuses").insert(toInsert);
    statuses = toInsert as ProjectStatus[];
  }

  return NextResponse.json({ statuses });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Status name is required." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const rawKey = body?.key ? String(body.key).trim().toLowerCase() : name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const key = rawKey || `status_${Date.now()}`;
  const color = body?.color || "#64748B";
  const is_done = Boolean(body?.is_done);

  // Determine next sort_order
  const { data: existing } = await db
    .from("project_statuses")
    .select("sort_order")
    .eq("project_id", params.id)
    .order("sort_order", { ascending: false });

  const nextSort = existing && existing.length > 0 ? (existing[0].sort_order ?? 0) + 1 : 0;

  const { data, error } = await db
    .from("project_statuses")
    .insert({
      project_id: params.id,
      name,
      key,
      color,
      sort_order: body?.sort_order != null ? Number(body.sort_order) : nextSort,
      is_done,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: data }, { status: 201 });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const statuses = body?.statuses;
  if (!Array.isArray(statuses)) {
    return NextResponse.json({ error: "statuses array required." }, { status: 400 });
  }

  const db = supabaseAdmin();
  // Update each status sort order and details
  for (let i = 0; i < statuses.length; i++) {
    const s = statuses[i];
    if (s.id) {
      await db
        .from("project_statuses")
        .update({
          name: s.name,
          color: s.color,
          sort_order: i,
          is_done: Boolean(s.is_done),
        })
        .eq("id", s.id)
        .eq("project_id", params.id);
    }
  }

  const { data } = await db
    .from("project_statuses")
    .select()
    .eq("project_id", params.id)
    .order("sort_order", { ascending: true });

  return NextResponse.json({ statuses: data ?? [] });
}
