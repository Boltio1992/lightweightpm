import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, clearMockStore } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const wipeUsers = url.searchParams.get("users") === "true";
  const reseed = url.searchParams.get("reseed") === "true";

  // Check if real Supabase or mock store
  const db = supabaseAdmin();

  // Clear in-memory mock store
  clearMockStore({
    preserveUsers: !wipeUsers,
    reseed: reseed,
  });

  // If real Supabase is connected, execute table deletes
  if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes("YOUR-PROJECT-REF")) {
    try {
      const tables = [
        "task_activity",
        "task_comments",
        "tasks",
        "project_statuses",
        "project_members",
        "projects",
      ];
      if (wipeUsers) tables.push("users");

      for (const table of tables) {
        await db.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }
    } catch (e: any) {
      console.error("[LightPM] Error clearing external DB:", e);
    }
  }

  return NextResponse.json({
    ok: true,
    message: reseed
      ? "Database re-seeded with clean demo data."
      : wipeUsers
      ? "Database completely cleared (all projects, tasks, and users removed)."
      : "Database cleared (all projects and tasks removed; user accounts preserved).",
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
