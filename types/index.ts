export type UserPublic = {
  id: string;
  username: string;
  name: string;
  title: string;
  role: string;
  created_at: string;
};

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
  owner?: UserPublic | null;
  default_view: "list" | "kanban" | "timeline" | "members";
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectMemberRole = "owner" | "admin" | "member" | "viewer";

export type ProjectMember = {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectMemberRole | string;
  added_at: string;
  user?: UserPublic;
  workload?: {
    total: number;
    in_progress: number;
    done: number;
  };
};

export type ProjectStatus = {
  id: string;
  project_id: string;
  name: string;
  key: string;
  color: string;
  sort_order: number;
  is_done: boolean;
};

export type TaskStatus = string;
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskComment = {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: UserPublic | null;
};

export type TaskActivity = {
  id: string;
  task_id: string;
  user_id: string;
  action: string;
  details?: string | null;
  created_at: string;
  user?: UserPublic | null;
};

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
  project?: { id: string; name: string } | null;
  start_date: string | null;
  due_date: string | null;
  duration_days: number | null;
  percent_complete: number;
  sort_order: number;
  tags?: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  subtasks?: Task[];
};

export const TASK_STATUSES: { key: string; label: string; color: string; is_done: boolean }[] = [
  { key: "todo", label: "To Do", color: "#94A3B8", is_done: false },
  { key: "in_progress", label: "In Progress", color: "#12A594", is_done: false },
  { key: "review", label: "Review", color: "#F59E0B", is_done: false },
  { key: "blocked", label: "Blocked", color: "#EF4444", is_done: false },
  { key: "done", label: "Done", color: "#10B981", is_done: true },
];

export const PRIORITY_ORDER: TaskPriority[] = ["urgent", "high", "medium", "low"];

