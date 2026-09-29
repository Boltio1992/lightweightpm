#!/usr/bin/env node
/**
 * Compares the live Supabase database against supabase/schema-manifest.json and
 * reports every table/column the app expects but the database does not have.
 *
 * This is the check for the "Could not find the 'x' column of 'y' in the schema
 * cache" family of bugs: the insert silently drops the field (lib/resilientInsert.ts)
 * and the data looks lost.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:check
 * (it also reads .env.local / .env automatically)
 *
 * Exit codes: 0 = in sync, 1 = drift found, 2 = no credentials.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

/* ---------------------------------------------------------------- env loading */

function loadEnv() {
  for (const file of [".env.local", ".env", ".env.example"]) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      if (process.env[key] != null) continue;
      process.env[key] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const manifestPath = path.join(ROOT, "supabase", "schema-manifest.json");

if (!fs.existsSync(manifestPath)) {
  console.error("Missing supabase/schema-manifest.json — run: npm run db:manifest");
  process.exit(2);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")).tables;

if (!url || !key || /YOUR-PROJECT-REF|placeholder|example\.com/i.test(url) || key === "your-service-role-key" || key.length < 20) {
  console.log("No live Supabase credentials found.");
  console.log("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or fill .env.local) and re-run:");
  console.log("  npm run db:check");
  console.log("");
  console.log("Static check (code vs SQL files) is always available:");
  console.log("  npm run db:audit");
  process.exit(2);
}

const base = url.replace(/\/+$/, "");
const headers = { apikey: key, Authorization: `Bearer ${key}` };

/* ------------------------------------------------------------- live schema ---- */

async function fetchLiveSchema() {
  // One request: PostgREST can describe itself as OpenAPI.
  try {
    const res = await fetch(`${base}/rest/v1/`, { headers: { ...headers, Accept: "application/openapi+json" } });
    if (res.ok) {
      const json = await res.json();
      const defs = json.definitions || (json.components && json.components.schemas) || {};
      const out = {};
      for (const [name, def] of Object.entries(defs)) {
        const props = (def && (def.properties || (def.definitions && def.definitions[name] && def.definitions[name].properties))) || {};
        out[name.toLowerCase()] = new Set(Object.keys(props));
      }
      if (Object.keys(out).length) return { schema: out, mode: "openapi" };
    }
  } catch {
    /* fall through to probing */
  }

  // Fallback: probe one column at a time. PostgREST answers 400 (PGRST204 /
  // 42703 "... does not exist") for a column it does not know.
  const out = {};
  for (const table of Object.keys(manifest)) {
    out[table] = new Set();
    for (const col of Object.keys(manifest[table])) {
      const res = await fetch(`${base}/rest/v1/${table}?select=${encodeURIComponent(col)}&limit=0`, { headers });
      if (res.ok) out[table].add(col);
      else await res.text();
    }
  }
  return { schema: out, mode: "probe" };
}

/* -------------------------------------------------------------------- report -- */

(async () => {
  const { schema: live, mode } = await fetchLiveSchema();

  const missingTables = [];
  const missingColumns = [];

  for (const table of Object.keys(manifest).sort()) {
    const liveCols = live[table];
    if (!liveCols) {
      missingTables.push(table);
      continue;
    }
    for (const col of Object.keys(manifest[table]).sort()) {
      if (!liveCols.has(col)) missingColumns.push({ table, col, def: manifest[table][col] });
    }
  }

  const unknownTables = Object.keys(live)
    .filter((t) => !manifest[t])
    .sort();

  console.log(`=== Live DB schema check (${mode}) ===`);
  console.log(`endpoint: ${base}`);
  console.log(`expected: ${Object.keys(manifest).length} tables / ${Object.values(manifest).reduce((n, t) => n + Object.keys(t).length, 0)} columns`);
  console.log("");

  if (!missingTables.length && !missingColumns.length) {
    console.log("In sync — every expected table and column exists in the database.");
    if (unknownTables.length) console.log(`(tables in the DB that the app does not use: ${unknownTables.join(", ")})`);
    process.exit(0);
  }

  if (missingTables.length) {
    console.log(`MISSING TABLES (${missingTables.length}):`);
    for (const t of missingTables) console.log(`  - ${t}`);
    console.log("");
  }

  if (missingColumns.length) {
    console.log(`MISSING COLUMNS (${missingColumns.length}):`);
    for (const { table, col, def } of missingColumns) console.log(`  - ${table}.${col}   (${def})`);
    console.log("");
    console.log("Run this in Supabase → SQL editor:");
    console.log("");
    const byTable = {};
    for (const { table, col, def } of missingColumns) (byTable[table] = byTable[table] || []).push([col, def]);
    for (const table of Object.keys(byTable)) {
      console.log(`alter table ${table}`);
      byTable[table].forEach(([col, def], i) => {
        const comma = i === byTable[table].length - 1 ? ";" : ",";
        console.log(`  add column if not exists ${col} ${def}${comma}`);
      });
      console.log("");
    }
    console.log("notify pgrst, 'reload schema';");
  }

  process.exit(1);
})();
