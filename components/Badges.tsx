import type { TaskPriority, TaskStatus } from "@/types";

const STATUS_STYLE: Record<TaskStatus, string> = {
  todo: "bg-subtle text-muted",
  in_progress: "bg-accentSoft text-accent",
  review: "bg-warnSoft text-warn",
  blocked: "bg-dangerSoft text-danger",
  done: "bg-goodSoft text-good",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  blocked: "Blocked",
  done: "Done",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`chip ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  urgent: "bg-dangerSoft text-danger",
  high: "bg-warnSoft text-warn",
  medium: "bg-accentSoft text-accent",
  low: "bg-subtle text-muted",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <span className={`chip ${PRIORITY_STYLE[priority]}`}>{priority}</span>;
}

export function ProjectStatusBadge({ status }: { status: string }) {
  const style: Record<string, string> = {
    active: "bg-goodSoft text-good",
    on_hold: "bg-warnSoft text-warn",
    done: "bg-accentSoft text-accent",
    archived: "bg-subtle text-muted",
  };
  const label: Record<string, string> = {
    active: "Active",
    on_hold: "On Hold",
    done: "Done",
    archived: "Archived",
  };
  return <span className={`chip ${style[status] ?? style.active}`}>{label[status] ?? status}</span>;
}
