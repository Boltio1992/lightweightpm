import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  const db = supabaseAdmin();

  if (!q) {
    // Return recent projects & tasks
    const [pRes, tRes] = await Promise.all([
      db.from("projects").select("id, name, description, status, accent_color, icon").limit(5),
      db.from("tasks").select("id, title, status, priority, project_id").limit(8),
    ]);
    return NextResponse.json({
      projects: pRes.data ?? [],
      tasks: tRes.data ?? [],
    });
  }

  const [pRes, tRes] = await Promise.all([
    db.from("projects").select("id, name, description, status, accent_color, icon").or(`name.ilike.%${q}%,description.ilike.%${q}%`).limit(10),
    db.from("tasks").select("id, title, status, priority, project_id").or(`title.ilike.%${q}%,description.ilike.%${q}%`).limit(15),
  ]);

  return NextResponse.json({
    projects: pRes.data ?? [],
    tasks: tRes.data ?? [],
  });
}
