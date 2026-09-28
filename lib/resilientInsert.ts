import { supabaseAdmin } from "@/lib/supabaseServer";

/**
 * PostgREST reports an unknown column in two shapes, depending on whether it is
 * a schema-cache miss or a genuine "column does not exist" error:
 *   - "Could not find the 'accent_color' column of 'projects' in the schema cache"
 *   - "column tasks.tags does not exist"
 */
const MISSING_COLUMN_PATTERNS = [
  /Could not find the '([^']+)' column of '[^']+'/,
  /column [\w.]*?([\w]+) does not exist/,
];

export function missingColumnFromError(message: string): string | null {
  for (const pattern of MISSING_COLUMN_PATTERNS) {
    const match = message.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export type ResilientInsertResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
  /** Columns that had to be removed for the insert to succeed. */
  droppedColumns: string[];
};

/**
 * Inserts rows and, whenever the database (or PostgREST's schema cache) does not
 * know a column yet, drops that one column and retries. The rows are still
 * written — just without that field — instead of the whole request failing.
 *
 * Callers should surface `droppedColumns` to the user so they know to run the
 * pending migration and reload the PostgREST schema cache.
 */
export async function insertSkippingMissingColumns<T = Record<string, any>>(
  table: string,
  rows: Array<Record<string, unknown>>,
  select: string
): Promise<ResilientInsertResult<T>> {
  if (rows.length === 0) return { data: [], error: null, droppedColumns: [] };

  let payload = rows;
  const dropped: string[] = [];
  const maxAttempts = Object.keys(rows[0] ?? {}).length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await supabaseAdmin().from(table).insert(payload).select(select);

    if (!res.error) {
      return { data: (res.data ?? null) as T[] | null, error: null, droppedColumns: dropped };
    }

    const column = missingColumnFromError(res.error.message ?? "");
    if (!column || !payload.some((row) => column in row)) {
      return { data: null, error: { message: res.error.message }, droppedColumns: dropped };
    }

    dropped.push(column);
    payload = payload.map((row) => {
      const copy = { ...row };
      delete copy[column];
      return copy;
    });
  }

  return { data: null, error: { message: `Too many missing columns on "${table}".` }, droppedColumns: dropped };
}
