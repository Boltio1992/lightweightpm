export type UserPublic = { id: string; username: string; name: string; title: string; role: string; created_at: string };
export type Project = {
  id: string;
  name: string;
  description: string;
  status: "active" | "on_hold" | "done" | "archived";
  start_date: string | null;
  end_date: string | null;
  percent_complete: number | null;
  accent_color: string | null;
  icon: string | null;
  owner_id: string | null;
  default_view: "list" | "kanban" | "timeline" | "members";
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export type ProjectMember = { id: string; project_id: string; user_id: string; role: string; added_at: string; user?: UserPublic };
export type TaskStatus = "todo" | "in_progress" | "review" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type Task = {
  id: string;
  project_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  assignee?: UserPublic | null;
  start_date: string | null;
  due_date: string | null;
  duration_days: number | null;
  percent_complete: number;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export const TASK_STATUSES: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
];
export const PRIORITY_ORDER: TaskPriority[] = ["urgent", "high", "medium", "low"];
