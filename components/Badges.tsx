import type { TaskPriority, TaskStatus } from "@/types";

const STATUS_STYLE: Record<TaskStatus, string> = {
  todo: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-50 text-accent",
  blocked: "bg-red-50 text-danger",
  done: "bg-green-50 text-good",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`chip ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  urgent: "bg-red-50 text-danger",
  high: "bg-orange-50 text-warn",
  medium: "bg-blue-50 text-accent",
  low: "bg-gray-100 text-gray-500",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <span className={`chip ${PRIORITY_STYLE[priority]}`}>{priority}</span>;
}

export function ProjectStatusBadge({ status }: { status: string }) {
  const style: Record<string, string> = {
    active: "bg-green-50 text-good",
    on_hold: "bg-orange-50 text-warn",
    done: "bg-blue-50 text-accent",
    archived: "bg-gray-100 text-gray-500",
  };
  const label: Record<string, string> = {
    active: "Active",
    on_hold: "On Hold",
    done: "Done",
    archived: "Archived",
  };
  return <span className={`chip ${style[status] ?? style.active}`}>{label[status] ?? status}</span>;
}
