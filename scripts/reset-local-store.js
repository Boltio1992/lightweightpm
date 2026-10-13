/**
 * Reset the local LightPM store.
 *
 *   node scripts/reset-local-store.js          -> says what it would do
 *   node scripts/reset-local-store.js --yes    -> actually deletes the store
 *
 * Deleting it is safe: the next start re-seeds the demo data. Any projects,
 * tasks or accounts you created will be gone, so this asks first.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const targets = [
  process.env.LIGHTPM_DB_PATH
    ? path.resolve(process.env.LIGHTPM_DB_PATH)
    : path.join(ROOT, "data", "lightpm.db"),
  process.env.LIGHTPM_STORE_PATH
    ? path.resolve(process.env.LIGHTPM_STORE_PATH)
    : path.join(ROOT, "data", "lightpm.json"),
];

const confirmed = process.argv.includes("--yes");

// WAL/SHM siblings belong to the same database.
const files = [];
for (const t of targets) {
  for (const f of [t, `${t}-wal`, `${t}-shm`]) {
    if (fs.existsSync(f)) files.push(f);
  }
}

if (files.length === 0) {
  console.log("No local store found - nothing to reset.");
  console.log("The next start will seed fresh demo data.");
  process.exit(0);
}

console.log("Local store files:");
for (const f of files) {
  console.log(`  ${f}  (${(fs.statSync(f).size / 1024).toFixed(1)} KB)`);
}

if (!confirmed) {
  console.log("\nNothing was deleted. Re-run with --yes to reset.");
  console.log("The next start will re-seed the demo data.");
  process.exit(0);
}

for (const f of files) {
  fs.rmSync(f, { force: true });
  console.log(`  deleted ${f}`);
}
console.log("\nStore reset. The next start will seed fresh demo data.");
