/* Shared formatting helpers. Pure functions only — used by client components,
   server components and API routes alike, so nothing here may touch the DOM. */

const DAY_MS = 24 * 60 * 60 * 1000;

export function fmtDate(d?: string | null, opts?: { year?: boolean }) {
  if (!d) return "—";
  const date = new Date(d.length > 10 ? d : `${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(opts?.year === false ? {} : { year: "numeric" }),
  });
}

export function startOfDay(d: Date | string) {
  const date = typeof d === "string" ? new Date(`${d.slice(0, 10)}T00:00:00`) : new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Whole days from today to `date`. Negative means the date has passed. */
export function daysFromToday(date?: string | null) {
  if (!date) return null;
  const target = startOfDay(date);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - startOfDay(new Date()).getTime()) / DAY_MS);
}

/** "Today", "Tomorrow", "in 3d", "2d late" — wording a person can act on. */
export function dueLabel(due?: string | null) {
  const days = daysFromToday(due);
  if (days === null) return null;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "1d late";
  if (days < 0) return `${-days}d late`;
  if (days <= 14) return `in ${days}d`;
  return fmtDate(due, { year: false });
}

/** Deadline state drives colour; colour always means "do something". */
export type DeadlineTone = "none" | "future" | "soon" | "today" | "late";

export function deadlineTone(due?: string | null, done = false): DeadlineTone {
  if (!due || done) return "none";
  const days = daysFromToday(due);
  if (days === null) return "none";
  if (days < 0) return "late";
  if (days === 0) return "today";
  if (days <= 3) return "soon";
  return "future";
}

export function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function plural(n: number, word: string, pluralForm?: string) {
  return `${n} ${n === 1 ? word : pluralForm ?? `${word}s`}`;
}

/** Percent that never divides by zero and never leaves 0–100. */
export function percent(done: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

/** "in 12 days", "12 days left", "3 days over" — for project end dates. */
export function countdownLabel(endDate?: string | null, status?: string) {
  const days = daysFromToday(endDate);
  if (days === null) return null;
  if (days === 0) return "Ends today";
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} left`;
  const over = -days;
  return status === "done" ? `Ended ${over}d ago` : `${over} day${over === 1 ? "" : "s"} over`;
}
