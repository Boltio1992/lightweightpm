/**
 * Print the shape and size of the local store, so a migration can be proved
 * additive. Compares nothing itself - it is meant to be run before and after.
 *
 * usage: node scripts/local/schema-state.js [path-to-lightpm.db]
 */
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const file = process.argv[2] || path.join(process.cwd(), "data", "lightpm.db");

if (!fs.existsSync(file)) {
  console.log(`no database at ${file}`);
  process.exit(0);
}

const db = new DatabaseSync(file, { readOnly: true });

const tables = db
  .prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name")
  .all()
  .map((r) => r.name);

console.log(`database: ${file}`);
console.log(`tables (${tables.length}): ${tables.join(", ")}`);

console.log("\nrow counts:");
for (const t of tables) {
  const n = db.prepare(`select count(*) c from ${t}`).get().c;
  console.log(`  ${t.padEnd(18)} ${n}`);
}

for (const t of ["projects", "tasks", "links", "task_members"]) {
  if (!tables.includes(t)) {
    console.log(`\n${t}: TABLE MISSING`);
    continue;
  }
  const cols = db
    .prepare(`select name from pragma_table_info('${t}')`)
    .all()
    .map((r) => r.name);
  console.log(`\n${t} columns (${cols.length}): ${cols.join(", ")}`);
}

// A fingerprint of real content, so a migration cannot silently blank a table.
const sample = db
  .prepare("select id, name, status, percent_complete from projects order by id limit 3")
  .all();
console.log("\nprojects sample:");
for (const row of sample) console.log(`  ${row.id} | ${row.name} | ${row.status} | ${row.percent_complete}`);

const taskSample = db
  .prepare("select id, title, status, percent_complete from tasks order by id limit 3")
  .all();
console.log("\ntasks sample:");
for (const row of taskSample) console.log(`  ${row.id} | ${row.title} | ${row.status} | ${row.percent_complete}`);
