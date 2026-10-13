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
  icon: string | null;
  owner_id: string | null;
  owner?: UserPublic | null;
  default_view: "list" | "kanban" | "timeline" | "members";
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Workflow classification (docs/redesign/05-light-plan.md §4). All three of
  // `type`, `plan_class` and `request_type` hold keys from configurable lists,
  // never a hard-coded enum.
  reference_no: string | null;
  type: string | null;
  plan_class: string | null;
  request_type: string | null;
};

export type ProjectStats = { total: number; done: number; overdue: number };

/** What `GET /api/projects` returns: the project plus its rolled-up task stats. */
export type ProjectWithStats = Project & {
  stats: ProjectStats;
  calculated_percent_complete?: number;
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
  reference_no: string | null;
  tags?: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  subtasks?: Task[];
};

export type LinkKind = "ticket" | "change_request" | "change_release";
export type LinkOwnerKind = "project" | "task";

/**
 * A reference from a project or task out to a record that lives in its own
 * system (Ticket / Change Request / Change Release). `title` and
 * `progress_percent` are typed by hand for now; once those systems are
 * queryable they are refreshed in place and nothing else changes.
 */
export type ExternalLink = {
  id: string;
  owner_kind: LinkOwnerKind;
  owner_id: string;
  kind: LinkKind;
  reference: string;
  title: string | null;
  progress_percent: number | null;
  created_at: string;
  updated_at: string;
};

/** People named on a project-less task; mirrors ProjectMember. */
export type TaskMember = {
  id: string;
  task_id: string;
  user_id: string;
  role: ProjectMemberRole | string;
  added_at: string;
  user?: UserPublic;
};

// Task status vocabularies live in lib/statusSets.ts — one source of truth.

export const PRIORITY_ORDER: TaskPriority[] = ["urgent", "high", "medium", "low"];

