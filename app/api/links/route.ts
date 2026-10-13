import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { LINK_COLUMNS, LINK_KINDS, isLinkKind, isOwnerKind, validProgress } from "@/lib/links";

/**
 * References out to Ticket / Change Request / Change Release.
 *
 * Those records live in their own systems. For the demo, `title` and
 * `progress_percent` are typed in by hand; once those systems are queryable the
 * same rows are refreshed by a direct query keyed on (kind, reference), so this
 * shape does not change. See docs/redesign/06-ux-design.md §8.
 */

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const ownerKind = req.nextUrl.searchParams.get("owner_kind") ?? "";
  const ownerId = req.nextUrl.searchParams.get("owner_id") ?? "";

  if (!isOwnerKind(ownerKind) || !ownerId) {
    return NextResponse.json(
      { error: "owner_kind (project|task) and owner_id are required." },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("links")
    .select(LINK_COLUMNS)
    .eq("owner_kind", ownerKind)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const ownerKind = String(body?.owner_kind ?? "").trim();
  const ownerId = String(body?.owner_id ?? "").trim();
  const kind = String(body?.kind ?? "").trim();
  const reference = String(body?.reference ?? "").trim();

  if (!isOwnerKind(ownerKind)) {
    return NextResponse.json({ error: "owner_kind must be project or task." }, { status: 400 });
  }
  if (!ownerId) {
    return NextResponse.json({ error: "owner_id is required." }, { status: 400 });
  }
  if (!isLinkKind(kind)) {
    return NextResponse.json(
      { error: "kind must be ticket, change_request or change_release." },
      { status: 400 }
    );
  }
  if (!reference) {
    return NextResponse.json({ error: "A reference is required." }, { status: 400 });
  }

  const title = body?.title === undefined || body?.title === null ? null : String(body.title).trim() || null;
  const progress_percent = validProgress(body?.progress_percent);

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("links")
    .insert({ owner_kind: ownerKind, owner_id: ownerId, kind, reference, title, progress_percent })
    .select(LINK_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data }, { status: 201 });
}
