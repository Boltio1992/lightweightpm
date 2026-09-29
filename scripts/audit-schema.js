#!/usr/bin/env node
/**
 * Static schema drift audit.
 *
 * Compares the columns the app actually reads/writes (every `.from("table")`
 * call and the selects/inserts/updates/filters chained onto it) against the
 * columns declared in supabase/schema.sql + supabase/migrations/*.sql.
 *
 * It catches the class of bug behind "Could not find the 'x' column of
 * 'tasks' in the schema cache": a column the code writes that no migration
 * ever created.
 *
 * Usage:  node scripts/audit-schema.js
 * Exit code 1 if drift is found.
 */

const fs = require("fs");
const path = require("path");

const { parseSqlSchema } = require("./lib/schema-parse");

const ROOT = path.join(__dirname, "..");
const SCAN_DIRS = ["app", "lib", "components"];
const SQL_KEYWORDS = new Set([
  "primary",
  "unique",
  "foreign",
  "check",
  "constraint",
  "references",
  "default",
  "not",
  "null",
  "on",
]);

/* ------------------------------------------------------------------ SQL side */

/** { table: Set(column) } from supabase/schema.sql + every migration. */
function declaredColumns() {
  const parsed = parseSqlSchema();
  const out = {};
  for (const table of Object.keys(parsed)) out[table] = new Set(Object.keys(parsed[table]));
  return out;
}

/* ----------------------------------------------------------------- code side */

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(p);
  }
  return acc;
}

/** const NAME = "col, col2" — used for TASK_COLUMNS / USER_COLUMNS etc. */
function collectStringConstants(files) {
  const consts = {};
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    const re = /const\s+([A-Z][A-Z0-9_]*)\s*=\s*(["'`])([\s\S]*?)\2/g;
    let m;
    while ((m = re.exec(src))) consts[m[1]] = m[3];
  }
  return consts;
}

function splitSelect(cols) {
  // Split on top-level commas (embedded resource selects contain commas).
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of cols) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);

  const names = [];
  for (const part of parts) {
    let p = part.trim();
    if (!p || p === "*") continue;
    p = p.replace(/\s+/g, "");
    const alias = p.match(/^([a-zA-Z0-9_]+):/); // alias:column
    if (alias) p = p.slice(alias[0].length);
    p = p.split("!")[0]; // drop FK hints: users!tasks_assignee_id_fkey(...)
    p = p.split("(")[0]; // drop embedded resources
    p = p.split(".")[0]; // drop json paths
    if (/^[a-z_][a-z0-9_]*$/.test(p)) names.push(p);
  }
  return names;
}

function usedColumns() {
  const files = SCAN_DIRS.map((d) => path.join(ROOT, d)).filter(fs.existsSync).flatMap((d) => walk(d));
  const consts = collectStringConstants(files);
  const out = {};
  const where = {};

  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    const fromRe = /\.from\(\s*["'`]([a-z_][a-z0-9_]*)["'`]\s*\)/g;
    let m;
    while ((m = fromRe.exec(src))) {
      const table = m[1];
      // Only look at THIS statement — stop at the next `.from(` so a chained
      // query on another table does not leak its columns in here.
      const nextFrom = src.indexOf(".from(", m.index + m[0].length);
      const stop = nextFrom === -1 ? m.index + 1200 : Math.min(nextFrom, m.index + 1200);
      const rest = src.slice(m.index, stop);
      out[table] = out[table] || new Set();
      where[table] = where[table] || {};

      const add = (col) => {
        if (!col) return;
        out[table].add(col);
        const rel = path.relative(ROOT, file).replace(/\\/g, "/");
        (where[table][col] = where[table][col] || new Set()).add(rel);
      };

      // .select("a, b") / .select(`a, b`) / .select(SOME_CONST) / .select(SOME_CONST + "...")
      const selRe = /\.select\(\s*([^)]*?)\s*\)/g;
      let s;
      while ((s = selRe.exec(rest))) {
        let arg = s[1].trim();
        const constRef = arg.match(/^([A-Z][A-Z0-9_]*)$/);
        if (constRef && consts[constRef[1]] != null) arg = consts[constRef[1]];
        else {
          const inline = arg.match(/^["'`](.*)["'`]$/);
          if (inline) arg = inline[1];
          else continue;
        }
        for (const c of splitSelect(arg)) add(c);
      }

      // .insert({ ... }) / .update({ ... }) / .upsert({ ... })
      const writeRe = /\.(insert|update|upsert)\(\s*\{/g;
      let w;
      while ((w = writeRe.exec(rest))) {
        const start = rest.indexOf("{", w.index);
        let depth = 0;
        let end = start;
        for (let i = start; i < rest.length; i++) {
          if (rest[i] === "{") depth++;
          else if (rest[i] === "}") {
            depth--;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
        const body = rest.slice(start + 1, end);
        const keyRe = /(?:^|[,{])\s*([a-z_][a-z0-9_]*)\s*:/g;
        let k;
        while ((k = keyRe.exec(body))) add(k[1]);
      }

      // filters / ordering
      const filterRe = /\.(eq|neq|in|is|not|gt|gte|lt|lte|like|ilike|order|contains|containedBy|overlaps)\(\s*["'`]([a-z_][a-z0-9_]*)["'`]/g;
      let f;
      while ((f = filterRe.exec(rest))) add(f[2]);
    }
  }
  return { used: out, where };
}

/* ---------------------------------------------------------------------- main */

const declared = declaredColumns();
const { used, where } = usedColumns();

let problems = 0;
const lines = [];

for (const table of Object.keys(used).sort()) {
  const dec = declared[table];
  if (!dec) {
    lines.push(`\n!! table "${table}" is used in code but is not created anywhere in supabase/*.sql`);
    problems++;
    continue;
  }
  const missing = [...used[table]].filter((c) => !dec.has(c)).sort();
  if (missing.length) {
    problems += missing.length;
    lines.push(`\n${table}: ${missing.length} column(s) used in code but missing from SQL`);
    for (const c of missing) {
      const files = [...(where[table][c] || [])].slice(0, 4).join(", ");
      lines.push(`   - ${c}   (${files})`);
    }
  } else {
    lines.push(`\n${table}: OK (${used[table].size} columns referenced, all declared)`);
  }
}

console.log("=== LightPM schema drift audit ===");
console.log(lines.join("\n"));

if (problems) {
  console.log(`\n${problems} problem(s) found.`);
  console.log("Add the missing columns with: ALTER TABLE <table> ADD COLUMN IF NOT EXISTS <col> <type>;");
  console.log("and finish the migration with: NOTIFY pgrst, 'reload schema';");
  process.exit(1);
}
console.log("\nNo drift: every column used in code is declared in supabase/schema.sql or a migration.");
