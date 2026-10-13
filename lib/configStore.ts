/**
 * Seeding for the configurable lists.
 *
 * This lives outside the route file because more than one caller needs it: the
 * Admin screen reads the lists, and so does the dashboard (for the classification
 * rollup labels). Seeding only from the Admin route meant that opening the
 * dashboard first on a fresh store showed raw keys like `cr` instead of labels.
 *
 * `route.ts` also cannot export a helper — Next type-checks its exports.
 */

import { CONFIG_LIST_KEYS, CONFIG_SEED } from "@/lib/configLists";

// At most once per process, so the several workers Next starts cannot all decide
// to seed at the same moment.
let seedChecked = false;

export async function seedConfigListsIfEmpty(db: any): Promise<void> {
  if (seedChecked) return;
  seedChecked = true;
  try {
    const { data, error } = await db.from("config_options").select("list_key, value");
    if (error) return; // table missing or unreadable; callers degrade to raw keys

    const existing = new Set(
      (data ?? []).map((row: any) => `${row.list_key}\u0000${row.value}`)
    );

    const rows: any[] = [];
    for (const listKey of CONFIG_LIST_KEYS) {
      CONFIG_SEED[listKey].forEach((option, index) => {
        if (existing.has(`${listKey}\u0000${option.value}`)) return;
        rows.push({
          list_key: listKey,
          value: option.value,
          label: option.label,
          sort_order: index,
        });
      });
    }

    if (rows.length > 0) await db.from("config_options").insert(rows);
  } catch {
    // Never let seeding break a read path.
  }
}
