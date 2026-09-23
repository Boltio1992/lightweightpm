"use client";

import { useState } from "react";
import { PriorityBadge, StatusBadge } from "./Badges";
import { api, fmtDate, isOverdue } from "@/lib/api";
import type { Task, UserPublic } from "@/types";

function Row({
  task,
  depth,
  onEdit,
  onAddSub,
  onChanged,
}: {
  task: Task;
  depth: number;
  onEdit: (t: Task) => void;
  onAddSub: (t: Task) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const subtasks = task.subtasks ?? [];
  const overdue = isOverdue(task);

  async function toggleDone() {
    setBusy(true);
    await api(`/api/tasks/${task.id}`, {
      method: "PATCH",
      json: { status: task.status === "done" ? "todo" : "done" },
    }).catch(() => {});
    setBusy(false);
    onChanged();
  }

  async function remove() {
    if (!confirm(`Delete "${task.title}"${subtasks.length ? " and its sub-tasks" : ""}?`)) return;
    setBusy(true);
    await api(`/api/tasks/${task.id}`, { method: "DELETE" }).catch(() => {});
    setBusy(false);
    onChanged();
  }

  return (
    <>
      <div
        className="group flex items-center gap-3 border-b border-line px-4 py-2.5 hover:bg-subtle"
        style={{ paddingLeft: 16 + depth * 24 }}
      >
        {subtasks.length > 0 ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex-none text-muted hover:text-ink"
            aria-label="Toggle sub-tasks"
          >
            <svg
              className={`h-3 w-3 transition ${open ? "rotate-90" : ""}`}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5l10 7-10 7z" />
            </svg>
          </button>
        ) : (
          <span className="w-3 flex-none" />
        )}

        <input
          type="checkbox"
          checked={task.status === "done"}
          onChange={toggleDone}
          disabled={busy}
          className="h-4 w-4 flex-none cursor-pointer rounded border-line accent-accent"
        />

        <button
          onClick={() => onEdit(task)}
          className={`min-w-0 flex-1 truncate text-left text-sm ${
            task.status === "done" ? "text-muted line-through" : "text-ink"
          }`}
        >
          {task.title}
          {depth > 0 && <span className="ml-2 text-xs text-muted">sub-task</span>}
        </button>

        <div className="hidden flex-none items-center gap-2 sm:flex">
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
        </div>

        {/* Duration display */}
        <span className="hidden w-16 flex-none text-center text-xs text-muted lg:block">
          {task.duration_days ? `${task.duration_days}d` : "—"}
        </span>

        {/* Progress indicator */}
        <div className="hidden w-20 flex-none items-center gap-1 md:flex">
          {task.percent_complete > 0 ? (
            <>
              <div className="h-1 w-10 rounded-full bg-gray-200 overflow-hidden flex-1">
                <div 
                  className="h-full bg-accent" 
                  style={{ width: `${task.percent_complete}%` }}
                />
              </div>
              <span className="text-xs font-medium text-muted w-8 text-right">{task.percent_complete}%</span>
            </>
          ) : (
            <span className="text-xs text-muted">—</span>
          )}
        </div>

        <span
          className={`hidden w-28 flex-none text-right text-xs md:block ${
            overdue ? "font-medium text-danger" : "text-muted"
          }`}
        >
          {fmtDate(task.due_date)}
        </span>

        <span className="hidden w-24 flex-none truncate text-right text-xs text-muted lg:block">
          {task.assignee?.name || task.assignee?.username || "Unassigned"}
        </span>

        <div className="flex flex-none gap-1 opacity-0 transition group-hover:opacity-100">
          {depth === 0 && (
            <button
              onClick={() => onAddSub(task)}
              className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-white hover:text-accent"
              title="Add sub-task"
            >
              + Sub
            </button>
          )}
          <button
            onClick={remove}
            className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-white hover:text-danger"
            title="Delete"
          >
            Delete
          </button>
        </div>
      </div>

      {open &&
        subtasks.map((st) => (
          <Row
            key={st.id}
            task={st}
            depth={depth + 1}
            onEdit={onEdit}
            onAddSub={onAddSub}
            onChanged={onChanged}
          />
        ))}
    </>
  );
}

export default function TaskList({
  tasks,
  onEdit,
  onAddSub,
  onChanged,
}: {
  tasks: Task[];
  users: UserPublic[];
  onEdit: (t: Task) => void;
  onAddSub: (t: Task) => void;
  onChanged: () => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted">
        No tasks yet. Create one to get started.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line bg-subtle px-4 py-2 text-xs font-medium text-muted">
        <span className="w-3" />
        <span className="w-4" />
        <span className="flex-1">Task</span>
        <span className="hidden sm:block">Priority / Status</span>
        <span className="hidden w-16 text-center lg:block">Duration</span>
        <span className="hidden w-20 md:block">Progress</span>
        <span className="hidden w-28 text-right md:block">Deadline</span>
        <span className="hidden w-24 text-right lg:block">Assignee</span>
        <span className="w-[76px]" />
      </div>
      {tasks.map((t) => (
        <Row key={t.id} task={t} depth={0} onEdit={onEdit} onAddSub={onAddSub} onChanged={onChanged} />
      ))}
    </div>
  );
}
