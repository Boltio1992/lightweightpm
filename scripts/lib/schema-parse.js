/**
 * Shared parser for supabase/schema.sql + supabase/migrations/*.sql.
 *
 * Returns { [table]: { [column]: "<full column definition>" } } where the
 * definition is everything after the column name (type, defaults, checks) —
 * exactly the text `ALTER TABLE ... ADD COLUMN IF NOT EXISTS name <def>` needs.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

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

function sqlFiles() {
  const migrationsDir = path.join(ROOT, "supabase", "migrations");
  return [
    path.join(ROOT, "supabase", "schema.sql"),
    ...(fs.existsSync(migrationsDir)
      ? fs.readdirSync(migrationsDir)
          .filter((f) => f.endsWith(".sql"))
          .sort()
          .map((f) => path.join(migrationsDir, f))
      : []),
  ].filter(fs.existsSync);
}

function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function addColumn(tableMap, table, part) {
  const text = part.replace(/\s+/g, " ").trim().replace(/,$/, "");
  if (!text) return;
  const match = text.match(/^([a-z_][a-z0-9_]*)\s*(.*)$/i);
  if (!match) return;
  const name = match[1].toLowerCase();
  if (SQL_KEYWORDS.has(name)) return;
  tableMap[table] = tableMap[table] || {};
  // First definition wins (schema.sql is read before migrations).
  if (!tableMap[table][name]) tableMap[table][name] = match[2].trim();
}

function parseSqlSchema() {
  const out = {};

  for (const file of sqlFiles()) {
    const sql = fs.readFileSync(file, "utf8");

    const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\n\s*\);/gi;
    let m;
    while ((m = createRe.exec(sql))) {
      const table = m[1].toLowerCase();
      for (const part of splitTopLevel(m[2])) addColumn(out, table, part);
    }

    const alterRe = /alter\s+table\s+(?:if\s+exists\s+)?([a-z_][a-z0-9_]*)\s+([\s\S]*?);/gi;
    while ((m = alterRe.exec(sql))) {
      const table = m[1].toLowerCase();
      const colRe = /add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\s*([^,]*)/gi;
      let c;
      out[table] = out[table] || {};
      while ((c = colRe.exec(m[2]))) {
        const name = c[1].toLowerCase();
        if (!out[table][name]) out[table][name] = c[2].trim();
      }
      // drop column — keep the manifest honest if a migration removed one
      const dropRe = /drop\s+column\s+(?:if\s+exists\s+)?([a-z_][a-z0-9_]*)/gi;
      let d;
      while ((d = dropRe.exec(m[2]))) delete out[table][d[1].toLowerCase()];
    }
  }

  return out;
}

module.exports = { parseSqlSchema, sqlFiles, ROOT };
