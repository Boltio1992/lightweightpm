/**
 * LightPM Database Clear Script
 *
 * Usage:
 *   node scripts/clear-db.js [--preserve-users] [--complete]
 *
 * Options:
 *   --preserve-users   (Default) Clears all projects and tasks, keeps users
 *   --complete         Clears all projects, tasks, and all users
 */

const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isComplete = process.argv.includes("--complete");

async function clearSupabase() {
  if (!url || !key || url.includes("placeholder") || url.includes("YOUR-PROJECT-REF")) {
    console.log("ℹ️  No external Supabase instance configured.");
    console.log("ℹ️  If you are running the app in development or AI Studio preview,");
    console.log("    you can clear current data via curl:");
    console.log("    curl -X POST http://localhost:3000/api/dev/clear");
    return;
  }

  console.log(`Connecting to Supabase at ${url}...`);
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tablesToClear = [
    "task_activity",
    "task_comments",
    "tasks",
    "project_statuses",
    "project_members",
    "projects",
  ];

  if (isComplete) {
    tablesToClear.push("users");
  }

  console.log(`Clearing tables: ${tablesToClear.join(", ")}...`);

  for (const table of tablesToClear) {
    const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      console.error(`❌ Error clearing table ${table}:`, error.message);
    } else {
      console.log(`✅ Cleared ${table}`);
    }
  }

  console.log("🎉 Database clear completed!");
}

clearSupabase().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
