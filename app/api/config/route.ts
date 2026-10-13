import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { CONFIG_LIST_KEYS, isConfigListKey, slugifyConfigValue } from "@/lib/configLists";
import { seedConfigListsIfEmpty } from "@/lib/configStore";

/**
 * The configurable lists (project type, plan class, request type).
 *
 * A fresh database is seeded on first read, which keeps the seed in one place
 * and means an empty list is never a broken screen. The seeding itself lives in
 * lib/configStore.ts because the dashboard needs it too.
 */

const OPTION_COLUMNS = "id, list_key, value, label, sort_order, created_at";

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const db = supabaseAdmin();
  await seedConfigListsIfEmpty(db);

  const { data, error } = await db
    .from("config_options")
    .select(OPTION_COLUMNS)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lists: Record<string, any[]> = {};
  for (const key of CONFIG_LIST_KEYS) lists[key] = [];
  for (const row of data ?? []) {
    if (!lists[row.list_key]) lists[row.list_key] = [];
    lists[row.list_key].push(row);
  }

  return NextResponse.json({ lists });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const listKey = String(body?.list_key ?? "").trim();
  const label = String(body?.label ?? "").trim();

  if (!isConfigListKey(listKey)) {
    return NextResponse.json({ error: "Unknown list." }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: "A label is required." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const value = String(body?.value ?? "").trim() || slugifyConfigValue(label);

  const { data: existing } = await db
    .from("config_options")
    .select(OPTION_COLUMNS)
    .eq("list_key", listKey)
    .order("sort_order", { ascending: true });

  if ((existing ?? []).some((row: any) => row.value === value)) {
    return NextResponse.json({ error: "That option already exists." }, { status: 409 });
  }

  const nextOrder = (existing ?? []).reduce(
    (max: number, row: any) => Math.max(max, Number(row.sort_order) || 0),
    -1
  ) + 1;

  const { data, error } = await db
    .from("config_options")
    .insert({ list_key: listKey, value, label, sort_order: nextOrder })
    .select(OPTION_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ option: data }, { status: 201 });
}
