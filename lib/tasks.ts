import type { Task } from "@/types";

// Turns a flat list of task rows into a two-level tree: top-level tasks each
// carrying their sub-tasks. Orphaned sub-tasks (parent filtered out) are
// promoted to top level so nothing silently disappears from the UI.
export function nestTasks(flat: Task[]): Task[] {
  const byId = new Map<string, Task>();
  for (const t of flat) byId.set(t.id, { ...t, subtasks: [] });

  const roots: Task[] = [];
  for (const t of byId.values()) {
    if (t.parent_task_id && byId.has(t.parent_task_id)) {
      byId.get(t.parent_task_id)!.subtasks!.push(t);
    } else {
      roots.push(t);
    }
  }
  return roots;
}
