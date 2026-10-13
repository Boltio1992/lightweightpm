/**
 * Local persistence for LightPM.
 *
 * The app's whole data layer is `supabaseAdmin()` in lib/supabaseServer.ts. It
 * returns either the hosted Supabase client or a local implementation of the
 * same query-builder surface. Until now that local implementation kept
 * everything in `globalThis`, so every restart threw the data away.
 *
 * This module makes that local store durable without adding a dependency:
 *
 *   - SQLite via `node:sqlite` (built into Node >= 22.5) when available
 *   - otherwise a plain JSON file, so older Node versions still work
 *
 * Both go through the same calls: loadStore / saveStore / clearTables. Nothing
 * here knows about queries or relations - it only mirrors the object store, so
 * the query semantics stay exactly where they already are and are proven.
 *
 * The mirror is deliberately permissive: no NOT NULL, no UNIQUE, no foreign
 * keys. The application layer is the source of truth (it already implements
 * cascade deletes itself), so stricter constraints here could only reject
 * writes the in-memory store accepts - i.e. turn a working demo into a 500.
 */

import fs from "fs";
import path from "path";

export interface Store {
  users: any[];
  projects: any[];
  project_members: any[];
  project_statuses: any[];
  tasks: any[];
  task_comments: any[];
  task_activity: any[];
  links: any[];
  task_members: any[];
  notifications: any[];
}

/** Mirrors supabase/schema.sql + migrations; see supabase/schema-manifest.json. */
const TABLE_COLUMNS: Record<string, string[]> = {
  users: [
    "id",
    "username",
    "password_hash",
    "name",
    "title",
    "role",
    "is_placeholder",
    "created_at",
  ],
  projects: [
    "id",
    "name",
    "description",
    "status",
    "start_date",
    "end_date",
    "percent_complete",
    "accent_color",
    "icon",
    "owner_id",
    "default_view",
    "archived_at",
    "created_by",
    "created_at",
    "updated_at",
    // Workflow classification (docs/redesign/05-light-plan.md §4)
    "reference_no",
    "type",
    "plan_class",
    "request_type",
  ],
  project_statuses: [
    "id",
    "project_id",
    "name",
    "key",
    "color",
    "sort_order",
    "is_done",
  ],
  project_members: ["id", "project_id", "user_id", "role", "added_at"],
  tasks: [
    "id",
    "project_id",
    "parent_task_id",
    "title",
    "description",
    "status",
    "priority",
    "assignee_id",
    "start_date",
    "due_date",
    "duration_days",
    "percent_complete",
    "sort_order",
    "tags",
    "created_by",
    "created_at",
    "updated_at",
    "reference_no",
  ],
  task_comments: ["id", "task_id", "user_id", "content", "created_at"],
  task_activity: [
    "id",
    "task_id",
    "user_id",
    "action",
    "details",
    "created_at",
  ],
  // References out to Ticket / Change Request / Change Release. Those records
  // live in their own systems; title and progress are typed by hand for the
  // demo and become values pulled by a direct query once the source systems are
  // reachable. kind + reference are the query key, so nothing else must change.
  links: [
    "id",
    "owner_kind",
    "owner_id",
    "kind",
    "reference",
    "title",
    "progress_percent",
    "created_at",
    "updated_at",
  ],
  // People named on a project-less task, mirroring project_members.
  task_members: ["id", "task_id", "user_id", "role", "added_at"],
  // Configurable lists (project type, plan class, request type). One table
  // rather than one per list, because they all have the same shape: a stable
  // value plus a label the user can change, in a chosen order.
  config_options: ["id", "list_key", "value", "label", "sort_order", "created_at"],
};

export const SCHEMA_TABLES = Object.keys(TABLE_COLUMNS);

const BOOLEAN_COLUMNS: Record<string, string[]> = {
  users: ["is_placeholder"],
  project_statuses: ["is_done"],
};

const JSON_COLUMNS: Record<string, string[]> = { tasks: ["tags"] };

const DDL = `
create table if not exists users (
  id text primary key, username text, password_hash text, name text, title text,
  role text, is_placeholder integer, created_at text
);
create table if not exists projects (
  id text primary key, name text, description text, status text, start_date text,
  end_date text, percent_complete integer, accent_color text, icon text,
  owner_id text, default_view text, archived_at text, created_by text,
  created_at text, updated_at text,
  reference_no text, type text, plan_class text, request_type text
);
create table if not exists project_statuses (
  id text primary key, project_id text, name text, key text, color text,
  sort_order integer, is_done integer
);
create table if not exists project_members (
  id text primary key, project_id text, user_id text, role text, added_at text
);
create table if not exists tasks (
  id text primary key, project_id text, parent_task_id text, title text,
  description text, status text, priority text, assignee_id text,
  start_date text, due_date text, duration_days integer,
  percent_complete integer, sort_order integer, tags text, created_by text,
  created_at text, updated_at text, reference_no text
);
create table if not exists task_comments (
  id text primary key, task_id text, user_id text, content text, created_at text
);
create table if not exists task_activity (
  id text primary key, task_id text, user_id text, action text, details text,
  created_at text
);
create index if not exists idx_tasks_project on tasks(project_id);
create index if not exists idx_tasks_assignee on tasks(assignee_id);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_task_comments_task on task_comments(task_id);
create index if not exists idx_task_activity_task on task_activity(task_id);
create index if not exists idx_project_statuses_project on project_statuses(project_id);
create index if not exists idx_project_members_project on project_members(project_id);

create table if not exists links (
  id text primary key, owner_kind text, owner_id text, kind text,
  reference text, title text, progress_percent integer,
  created_at text, updated_at text
);
create table if not exists task_members (
  id text primary key, task_id text, user_id text, role text, added_at text
);
create table if not exists config_options (
  id text primary key, list_key text, value text, label text,
  sort_order integer, created_at text
);
create index if not exists idx_links_owner on links(owner_kind, owner_id);
create index if not exists idx_task_members_task on task_members(task_id);
create index if not exists idx_config_options_list on config_options(list_key);
`;

/**
 * Columns added after a database was first created.
 *
 * `create table if not exists` cannot add a column to a table that already
 * exists, and readTable() selects every expected column - so an older store
 * would throw on read. SQLite has no "add column if not exists", hence the
 * pragma check. Everything added so far is text, so the type is fixed.
 */
const ADDED_COLUMNS: Record<string, string[]> = {
  projects: ["reference_no", "type", "plan_class", "request_type"],
  tasks: ["reference_no"],
};

function ensureColumns(db: any): void {
  for (const [table, columns] of Object.entries(ADDED_COLUMNS)) {
    let existing: Set<string>;
    try {
      const rows = db.prepare(`select name from pragma_table_info('${table}')`).all();
      existing = new Set(rows.map((r: any) => String(r.name)));
    } catch {
      continue; // table not created yet; the DDL above handles it
    }
    for (const column of columns) {
      if (existing.has(column)) continue;
      try {
        db.exec(`alter table ${table} add column ${column} text`);
        console.info(`[LightPM] local store: added column ${table}.${column}`);
      } catch (e) {
        // Another worker added it between our check and this statement. That is
        // exactly the outcome we wanted, so a duplicate-column error is success.
        if (!/duplicate column name/i.test(String((e as Error).message))) throw e;
      }
    }
  }
}

function dataDir(): string {
  return path.join(process.cwd(), "data");
}

function sqlitePath(): string {
  const configured = process.env.LIGHTPM_DB_PATH;
  // resolve() so a relative LIGHTPM_DB_PATH still gets its directory created
  return configured ? path.resolve(configured) : path.join(dataDir(), "lightpm.db");
}

function jsonPath(): string {
  return process.env.LIGHTPM_STORE_PATH || path.join(dataDir(), "lightpm.json");
}

function ensureDir(file: string): void {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/* ------------------------------------------------------------------ values -- */

function toDbValue(table: string, column: string, value: any): any {
  if (value === undefined) return null;
  if ((JSON_COLUMNS[table] || []).includes(column)) {
    return JSON.stringify(Array.isArray(value) ? value : []);
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return value;
}

function fromDbValue(table: string, column: string, value: any): any {
  if ((JSON_COLUMNS[table] || []).includes(column)) {
    if (value === null || value === undefined) return [];
    try {
      const parsed = JSON.parse(String(value));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if ((BOOLEAN_COLUMNS[table] || []).includes(column)) {
    if (value === null || value === undefined) return false;
    return Boolean(value);
  }
  return value === undefined ? null : value;
}

/* ----------------------------------------------------------------- sqlite -- */

let sqliteConn: any = null;
let sqliteModuleResolved = false;
let sqliteModuleCache: any = null;
let lastSqliteError: string | null = null;

/**
 * `process.getBuiltinModule` gives us node:sqlite without a static import, so
 * bundlers never try to resolve it. Resolved once - it cannot change at runtime.
 */
function sqliteModule(): any {
  if (sqliteModuleResolved) return sqliteModuleCache;
  sqliteModuleResolved = true;
  try {
    const getBuiltin = (process as any).getBuiltinModule;
    if (typeof getBuiltin !== "function") return (sqliteModuleCache = null);
    const mod = getBuiltin.call(process, "node:sqlite");
    sqliteModuleCache = mod && typeof mod.DatabaseSync === "function" ? mod : null;
  } catch {
    sqliteModuleCache = null;
  }
  return sqliteModuleCache;
}

/** True when this Node has node:sqlite, i.e. the JSON store is NOT in play. */
function sqliteIsExpected(): boolean {
  return sqliteModule() !== null;
}

/**
 * node:sqlite is available but the file is momentarily unusable. The caller must
 * NOT fall through to the JSON store in this case: that would point the app at a
 * different dataset and look like data loss.
 */
function sqliteUnavailableButExpected(): boolean {
  return sqliteIsExpected() && !sqliteConn;
}

function openSqlite(mod: any): any {
  const file = sqlitePath();
  ensureDir(file);
  const db = new mod.DatabaseSync(file);

  // Order matters: busy_timeout needs no lock, so it is set before anything that
  // may have to wait for one. Without it SQLite fails instantly with
  // "database is locked" instead of waiting.
  db.exec("PRAGMA busy_timeout = 8000;");
  try {
    // Switching journal mode needs a brief exclusive lock, which a concurrently
    // starting worker may hold. Not fatal: whoever succeeded already made it WAL.
    db.exec("PRAGMA journal_mode = WAL;");
  } catch {
    /* another worker holds the lock; the database itself is fine */
  }
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec(DDL);
  ensureColumns(db);
  return db;
}

/**
 * The connection, or null.
 *
 * A failure to open is treated as TRANSIENT and is not cached, so the next call
 * retries. That matters because Next starts several workers at once (notably for
 * `next build`): a worker that gave up permanently would otherwise stay on the
 * wrong store for the life of the process.
 */
function getSqlite(): any {
  if (sqliteConn) return sqliteConn;
  const mod = sqliteModule();
  if (!mod) return null;
  try {
    sqliteConn = openSqlite(mod);
    lastSqliteError = null;
    return sqliteConn;
  } catch (e) {
    lastSqliteError = (e as Error).message;
    sqliteConn = null;
    console.error(
      `[LightPM] could not open the local database (${lastSqliteError}); will retry on the next call.`
    );
    return null;
  }
}

function readTable(db: any, table: string): any[] {
  const cols = TABLE_COLUMNS[table];
  const rows = db.prepare(`select ${cols.join(", ")} from ${table}`).all();
  return rows.map((row: any) => {
    const out: any = {};
    for (const c of cols) out[c] = fromDbValue(table, c, row[c]);
    return out;
  });
}

function writeTable(db: any, table: string, rows: any[]): void {
  const cols = TABLE_COLUMNS[table];
  db.exec(`delete from ${table}`);
  const stmt = db.prepare(
    `insert into ${table} (${cols.join(", ")}) values (${cols.map(() => "?").join(", ")})`
  );
  for (const row of rows) {
    const values = cols.map((c) => toDbValue(table, c, (row || {})[c]));
    try {
      stmt.run(...values);
    } catch (e) {
      throw new Error(
        `failed writing ${table} row ${(row && row.id) || "?"}: ${(e as Error).message}`
      );
    }
  }
}

function transaction(db: any, work: () => void): void {
  db.exec("begin immediate");
  try {
    work();
    db.exec("commit");
  } catch (e) {
    try {
      db.exec("rollback");
    } catch {
      /* the transaction is already gone; surface the original error */
    }
    throw e;
  }
}

/* ------------------------------------------------------------------ public -- */

export type BackendKind = "sqlite" | "json";

export function backendKind(): BackendKind {
  // "json" only when node:sqlite genuinely is not available; a transient failure
  // to open the file is still the sqlite backend.
  return getSqlite() || sqliteIsExpected() ? "sqlite" : "json";
}

export function backendDescription(): string {
  return getSqlite() || sqliteIsExpected()
    ? `sqlite: ${sqlitePath()}`
    : `json: ${jsonPath()}`;
}

/** Returns null when there is nothing stored yet (first run, or wiped). */
export function loadStore(): Store | null {
  const db = getSqlite();

  if (db) {
    const users = readTable(db, "users");
    if (users.length === 0) return null;
    const store: any = { notifications: [] };
    for (const t of SCHEMA_TABLES) store[t] = readTable(db, t);
    return store as Store;
  }

  if (sqliteUnavailableButExpected()) return null; // never read a different store

  const file = jsonPath();
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!parsed || !Array.isArray(parsed.users) || parsed.users.length === 0) return null;
    const store: any = { notifications: [] };
    for (const t of SCHEMA_TABLES) {
      store[t] = Array.isArray(parsed[t]) ? parsed[t] : [];
    }
    return store as Store;
  } catch (e) {
    console.warn(
      `[LightPM] could not read ${file} (${(e as Error).message}); starting fresh.`
    );
    return null;
  }
}

/**
 * Load, or seed atomically when empty.
 *
 * The check and the seed happen inside one write transaction, so when several
 * worker processes boot at the same moment exactly one seeds and the rest read
 * back that same row set - instead of every process keeping its own diverging
 * copy and overwriting the others on the next write.
 *
 * The seed factory is only invoked when seeding is actually required, which
 * also keeps the (deliberately slow) bcrypt hashing out of the common path.
 */
export function loadStoreOrSeed(seedFactory: () => Store): {
  store: Store;
  seeded: boolean;
} {
  const db = getSqlite();

  if (db) {
    let seeded = false;
    transaction(db, () => {
      if (readTable(db, "users").length === 0) {
        const seed = seedFactory();
        for (const t of SCHEMA_TABLES) writeTable(db, t, (seed as any)[t] || []);
        seeded = true;
      }
    });
    const store: any = { notifications: [] };
    for (const t of SCHEMA_TABLES) store[t] = readTable(db, t);
    return { store: store as Store, seeded };
  }

  if (sqliteUnavailableButExpected()) {
    // Serve from memory for this call; nothing is written to disk, so no second
    // dataset can appear. The next call retries the database.
    console.error(
      `[LightPM] local database not ready${
        lastSqliteError ? ` (${lastSqliteError})` : ""
      }; serving from memory, nothing written to disk.`
    );
    return { store: seedFactory(), seeded: true };
  }

  const existing = loadStore();
  if (existing) return { store: existing, seeded: false };

  const seed = seedFactory();
  saveStore(seed);
  return { store: seed, seeded: true };
}

/** Full mirror write. Small data set, so rewriting every table is simplest and safest. */
export function saveStore(store: Store): void {
  const db = getSqlite();

  if (db) {
    transaction(db, () => {
      for (const table of SCHEMA_TABLES) {
        writeTable(db, table, (store as any)[table] || []);
      }
    });
    return;
  }

  if (sqliteUnavailableButExpected()) {
    console.error("[LightPM] local database not ready; skipping this write.");
    return;
  }

  const file = jsonPath();
  ensureDir(file);
  const payload: any = {
    savedAt: new Date().toISOString(),
    backend: "json",
  };
  for (const t of SCHEMA_TABLES) payload[t] = (store as any)[t] || [];
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
  fs.renameSync(tmp, file); // atomic-ish: never leave a half-written store
}

export function clearTables(tables: string[]): void {
  const valid = tables.filter((t) => !!TABLE_COLUMNS[t]);
  const db = getSqlite();

  if (db) {
    transaction(db, () => {
      for (const t of valid) db.exec(`delete from ${t}`);
    });
    return;
  }

  if (sqliteUnavailableButExpected()) return;

  const file = jsonPath();
  if (!fs.existsSync(file)) return;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const t of valid) parsed[t] = [];
    fs.writeFileSync(file, JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.warn(`[LightPM] could not clear ${file}: ${(e as Error).message}`);
  }
}
