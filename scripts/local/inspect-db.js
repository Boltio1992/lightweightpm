// Inspect the local LightPM store directly. Read-only.
// usage: node inspect-db.js <path-to-lightpm.db>
const { DatabaseSync } = require("node:sqlite");

const file = process.argv[2];
const db = new DatabaseSync(file, { readOnly: true });

const tables = [
  "users",
  "projects",
  "project_members",
  "project_statuses",
  "tasks",
  "task_comments",
  "task_activity",
];

console.log("=== row counts ===");
for (const t of tables) {
  console.log(t.padEnd(18), db.prepare(`select count(*) c from ${t}`).get().c);
}

console.log("\n=== project_members ===");
console.table(db.prepare("select project_id, user_id, role from project_members").all());

console.log("\n=== projects ===");
console.table(db.prepare("select id, name, status from projects").all());

console.log("\n=== statuses per project ===");
console.table(
  db.prepare("select project_id, count(*) n from project_statuses group by project_id").all()
);

console.log("\n=== tasks created by the smoke test ===");
console.table(
  db
    .prepare(
      "select id, title, status, percent_complete, tags, project_id from tasks where title like 'Verify%'"
    )
    .all()
);

console.log("\n=== users (hash presence only) ===");
console.table(
  db
    .prepare(
      "select username, name, role, is_placeholder, case when password_hash is null then 'MISSING' else 'present' end as hash from users"
    )
    .all()
);
