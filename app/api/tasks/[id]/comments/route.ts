import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("task_comments")
    .select("id, task_id, user_id, content, created_at")
    .eq("task_id", params.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const content = String(body?.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "Comment cannot be empty." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("task_comments")
    .insert({
      task_id: params.id,
      user_id: auth.id,
      content,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also log activity
  await db.from("task_activity").insert({
    task_id: params.id,
    user_id: auth.id,
    action: "comment_added",
    details: content.length > 60 ? `${content.slice(0, 57)}…` : content,
  });

  return NextResponse.json({ comment: data }, { status: 201 });
}
