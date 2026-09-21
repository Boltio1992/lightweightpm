import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

// GET /api/users?q=search-term
// Returns a lightweight list of users for search/select widgets
// (add-member search, assignee picker).
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const db = supabaseAdmin();

  let query = db
    .from("users")
    .select("id, username, name, title, role, created_at")
    .order("name", { ascending: true })
    .limit(20);

  if (q) {
    query = query.or(`name.ilike.%${q}%,username.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ users: data });
}
