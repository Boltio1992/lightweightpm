import type { TaskPriority, TaskStatus } from "@/types";

/* Status and priority are different things and never share a shape:
   status is a pill with a coloured dot, priority is a flag with a label.
   That way "urgent" can never be mistaken for "blocked". */

/* Single source of truth for status colour — badges, dots and the timeline bars
   all read the same value, so "blocked" is one red everywhere. The values are
   CSS variables so the palette flips with the theme. */
export const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: "var(--color-muted)",
  in_progress: "var(--color-accent)",
  review: "var(--color-warn)",
  blocked: "var(--color-danger)",
  done: "var(--color-good)",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  blocked: "Blocked",
  done: "Done",
};

const STATUS_STYLE: Record<TaskStatus, { dot: string; chip: string }> = {
  todo: { dot: STATUS_COLOR.todo, chip: "bg-subtle text-ink" },
  in_progress: { dot: STATUS_COLOR.in_progress, chip: "bg-accentSoft text-accent" },
  review: { dot: STATUS_COLOR.review, chip: "bg-warnSoft text-warn" },
  blocked: { dot: STATUS_COLOR.blocked, chip: "bg-dangerSoft text-danger" },
  done: { dot: STATUS_COLOR.done, chip: "bg-goodSoft text-good" },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const style = STATUS_STYLE[status];
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
