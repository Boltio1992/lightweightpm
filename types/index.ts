export type UserPublic = { id: string; username: string; name: string; title: string; role: string; created_at: string };
export type Project = { id: string; name: string; description: string; status: "active" | "on_hold" | "done" | "archived"; start_date: string | null; end_date: string | null; percent_complete: number | null; created_by: string | null; created_at: string; updated_at: string };
export type ProjectMember = { id: string; project_id: string; user_id: string; role: string; added_at: string; user?: UserPublic };
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type Task = { id: string; project_id: string | null; parent_task_id: string | null; title: string; description: string; status: TaskStatus; priority: TaskPriority; assignee_id: string | null; start_date: string | null; due_date: string | null; sla_date: string | null; duration_days: number | null; percent_complete: number; sort_order: number; created_by: string | null; created_at: string; updated_at: string; assignee?: UserPublic | null; project?: Pick<Project, "id" | "name"> | null; subtasks?: Task[] };
export const TASK_STATUSES: { key: TaskStatus; label: string }[] = [{ key: "todo", label: "To Do" }, { key: "in_progress", label: "In Progress" }, { key: "blocked", label: "Blocked" }, { key: "done", label: "Done" }];
export const PRIORITY_ORDER: TaskPriority[] = ["urgent", "high", "medium", "low"];
