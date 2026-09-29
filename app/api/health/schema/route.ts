import { NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import manifest from "@/supabase/schema-manifest.json";

export const dynamic = "force-dynamic";

/**
 * GET /api/health/schema — admins only.
 *
 * Diffs supabase/schema-manifest.json against the live database so you can see,
 * without opening a terminal, which columns the app writes but the database does
 * not have. That mismatch is what silently drops fields on insert
 * (see lib/resilientInsert.ts) and produces errors like
 * "Could not find the 'accent_color' column of 'projects' in the schema cache".
 *
 * Response: { ok, mode, missingTables, missingColumns: [{table,column,definition}], sql }
 */

type LiveSchema = Record<string, Set<string>>;

async function liveSchema(base: string, headers: Record<string, string>): Promise<{ schema: LiveSchema; mode: string }> {
  try {
    const res = await fetch(`${base}/rest/v1/`, { headers: { ...headers, Accept: "application/openapi+json" } });
    if (res.ok) {
      const json = (await res.json()) as any;
      const defs = json.definitions || json.components?.schemas || {};
      const out: LiveSchema = {};
      for (const [name, def] of Object.entries<any>(defs)) {
        const props = def?.properties || def?.definitions?.[name]?.properties || {};
        out[name.toLowerCase()] = new Set(Object.keys(props));
      }
      if (Object.keys(out).length) return { schema: out, mode: "openapi" };
    }
  } catch {
    /* fall through to probing */
  }

  // Fallback: probe each expected column one by one.
  const out: LiveSchema = {};
  const tables = Object.keys(manifest.tables);
  for (const table of tables) {
    out[table] = new Set();
    for (const column of Object.keys((manifest.tables as any)[table])) {
      const res = await fetch(`${base}/rest/v1/${table}?select=${encodeURIComponent(column)}&limit=0`, { headers });
      if (res.ok) out[table].add(column);
      else await res.text();
    }
  }
  return { schema: out, mode: "probe" };
}

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const base = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base || !key) {
    return NextResponse.json(
      { error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set on this deployment." },
      { status: 503 }
    );
  }

  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const { schema, mode } = await liveSchema(base, headers);

  const missingTables: string[] = [];
  const missingColumns: Array<{ table: string; column: string; definition: string }> = [];

  for (const [table, columns] of Object.entries<any>(manifest.tables)) {
    if (!schema[table]) {
      missingTables.push(table);
      continue;
    }
    for (const [column, definition] of Object.entries<any>(columns)) {
      if (!schema[table].has(column)) missingColumns.push({ table, column, definition });
    }
  }

  const sql =
    missingColumns.length || missingTables.length
      ? [
          ...Object.entries(
            missingColumns.reduce<Record<string, string[]>>((acc, { table, column, definition }) => {
              acc[table] = acc[table] || [];
              acc[table].push(`  add column if not exists ${column} ${definition}`);
              return acc;
            }, {})
          ).map(([table, lines]) => `alter table ${table}\n${lines.join(",\n")};`),
          "notify pgrst, 'reload schema';",
        ].join("\n\n")
      : null;

  return NextResponse.json({
    ok: missingTables.length === 0 && missingColumns.length === 0,
    mode,
    generatedFrom: (manifest as any).generatedAt ?? null,
    missingTables,
    missingColumns,
    sql,
  });
}
