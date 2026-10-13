import type { TaskPriority, TaskStatus } from "@/types";
import { DEFAULT_STATUS_SET } from "@/lib/statusSets";

/* Status and priority are different things and never share a shape:
   status is a pill with a coloured dot, priority is a flag with a label.
   That way "urgent" can never be mistaken for "blocked". */

/* The theme palette for the canonical statuses. These are CSS variables so the
   colour flips with the theme, which is why they are not the hex values in
   lib/statusSets.ts (those are what gets stored on a status row). The keys must
   stay in step with DEFAULT_STATUS_SET. */
export const STATUS_COLOR: Record<string, string> = {
  todo: "var(--color-muted)",
  in_progress: "var(--color-accent)",
  review: "var(--color-warn)",
  blocked: "var(--color-danger)",
  done: "var(--color-good)",
};

/* Labels come from the single status vocabulary, so a relabelled status reads
   the same text everywhere. */
export const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  DEFAULT_STATUS_SET.map((s) => [s.key, s.label])
);

const STATUS_STYLE: Record<string, { dot: string; chip: string }> = {
  todo: { dot: STATUS_COLOR.todo, chip: "bg-subtle text-ink" },
  in_progress: { dot: STATUS_COLOR.in_progress, chip: "bg-accentSoft text-accent" },
  review: { dot: STATUS_COLOR.review, chip: "bg-warnSoft text-warn" },
  blocked: { dot: STATUS_COLOR.blocked, chip: "bg-dangerSoft text-danger" },
  done: { dot: STATUS_COLOR.done, chip: "bg-goodSoft text-good" },
};

/* A project may define its own statuses (UAT, On Hold, ...), so an unknown key
   is normal rather than an error - without this, style.chip threw. */
const NEUTRAL_STATUS_STYLE = { dot: "var(--color-muted)", chip: "bg-subtle text-ink" };

export function StatusBadge({ status }: { status: TaskStatus }) {
  const style = STATUS_STYLE[status] ?? NEUTRAL_STATUS_STYLE;
  return (
    <span className={`chip ${style.chip}`}>
      <span
        className="h-1.5 w-1.5 flex-none rounded-full"
        style={{ backgroundColor: style.dot }}
        aria-hidden="true"
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

/* Compact dot-only status for dense views (kanban cards, mobile rows). */
export function StatusDot({ status }: { status: TaskStatus }) {
  return (
    <span
      className="h-2 w-2 flex-none rounded-full"
      style={{ backgroundColor: STATUS_STYLE[status].dot }}
      title={STATUS_LABEL[status]}
      aria-label={STATUS_LABEL[status]}
    />
  );
}

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  urgent: "var(--color-danger)",
  high: "var(--color-warn)",
  medium: "var(--color-accent)",
  low: "var(--color-muted)",
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_BARS: Record<TaskPriority, number> = {
  urgent: 3,
  high: 3,
  medium: 2,
  low: 1,
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const color = PRIORITY_COLOR[priority];
  const bars = PRIORITY_BARS[priority];
  return (
    <span
      className="inline-flex flex-none items-center gap-1 text-xs font-medium"
      style={{ color }}
      title={`${PRIORITY_LABEL[priority]} priority`}
    >
      {/* Signal-bar flag: filled bars read as urgency without a second pill. */}
      <svg className="h-3 w-3 flex-none" viewBox="0 0 12 12" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={1 + i * 3.7}
            y={9 - (i + 1) * 2.4}
            width="2.4"
            height={(i + 1) * 2.4}
            rx="0.6"
            fill={i < bars ? color : "var(--color-line)"}
          />
        ))}
      </svg>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

const PROJECT_STATUS_STYLE: Record<string, { dot: string; chip: string; label: string }> = {
  active: { dot: "var(--color-good)", chip: "bg-goodSoft text-good", label: "Active" },
  on_hold: { dot: "var(--color-warn)", chip: "bg-warnSoft text-warn", label: "On Hold" },
  done: { dot: "var(--color-accent)", chip: "bg-accentSoft text-accent", label: "Done" },
  archived: { dot: "var(--color-muted)", chip: "bg-subtle text-ink", label: "Archived" },
};

export function ProjectStatusBadge({ status }: { status: string }) {
  const style = PROJECT_STATUS_STYLE[status] ?? PROJECT_STATUS_STYLE.active;
  return (
    <span className={`chip ${style.chip}`}>
      <span
        className="h-1.5 w-1.5 flex-none rounded-full"
        style={{ backgroundColor: style.dot }}
        aria-hidden="true"
      />
      {style.label}
    </span>
  );
}
