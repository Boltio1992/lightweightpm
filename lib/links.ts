/**
 * Shared vocabulary for references out to the Ticket / Change Request / Change
 * Release systems.
 *
 * Kept in lib rather than in a route file because Next type-checks the exports
 * of `route.ts` — only HTTP methods and route config belong there.
 */

export const LINK_COLUMNS =
  "id, owner_kind, owner_id, kind, reference, title, progress_percent, created_at, updated_at";

export const OWNER_KINDS = ["project", "task"] as const;
export const LINK_KINDS = ["ticket", "change_request", "change_release"] as const;

/**
 * Type guards, so a route can validate a query-string value without widening the
 * union to `string`. `OWNER_KINDS.includes(someString)` does not type-check
 * because the array is `as const`.
 */
export function isOwnerKind(value: string): value is (typeof OWNER_KINDS)[number] {
  return (OWNER_KINDS as readonly string[]).includes(value);
}

export function isLinkKind(value: string): value is (typeof LINK_KINDS)[number] {
  return (LINK_KINDS as readonly string[]).includes(value);
}

/** Display names, so the UI never shows a raw key. */
export const LINK_KIND_LABELS: Record<string, string> = {
  ticket: "Ticket",
  change_request: "Change Request",
  change_release: "Change Release",
};

/** Short badges for the dense list. */
export const LINK_KIND_SHORT: Record<string, string> = {
  ticket: "TKT",
  change_request: "CR",
  change_release: "CREL",
};

/** A whole number 0-100, or null for "not recorded". */
export function validProgress(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : null;
}
