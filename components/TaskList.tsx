"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PriorityBadge, StatusBadge } from "./Badges";
import { api, isOverdue } from "@/lib/api";
import { dueLabel, fmtDate, initials } from "@/lib/format";
import { fadeUp, motionTransition } from "@/lib/motion";
import type { Task } from "@/types";

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
  const reduceMotion = useReducedMotion();
  const subtasks = task.subtasks ?? [];
  const overdue = isOverdue(task);
  const due = dueLabel(task.due_date);

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
      <motion.div
        layout
        initial={reduceMotion ? false : fadeUp.initial}
        animate={reduceMotion ? undefined : fadeUp.animate}
        exit={reduceMotion ? undefined : fadeUp.exit}
        transition={reduceMotion ? { duration: 0 } : motionTransition.fast}
        className="row-grid task-indent group border-b border-line px-4 py-2.5 hover:bg-subtle"
      >
        {/* 1 — expander. w-full rather than w-5: the column is 20px on desktop
            and 32px on a phone, and the caret should be tappable across all of
            it. Rows without children keep an empty span so the checkbox beside
            this one never moves sideways. */}
        {subtasks.length > 0 ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="tap flex h-5 w-full items-center justify-center text-muted hover:text-ink"
            aria-label="Toggle sub-tasks"
            aria-expanded={open}
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
          <span aria-hidden="true" />
        )}

        {/* 2 — done checkbox */}
        <input
          type="checkbox"
          checked={task.status === "done"}
          onChange={toggleDone}
          disabled={busy}
          className="task-check mx-auto h-4 w-4 cursor-pointer rounded border-line accent-accent"
          aria-label={`Mark "${task.title}" ${task.status === "done" ? "not done" : "done"}`}
        />

        {/* 3 — title. Sub-task indentation lives inside this cell, so every
            column to the right stays aligned with its header. */}
        <div className="min-w-0" style={{ paddingLeft: `calc(${depth} * var(--task-indent, 24px))` }}>
          <button onClick={() => onEdit(task)} className="block w-full min-w-0 text-left">
            <span
              className={`block truncate text-sm ${
                task.status === "done" ? "text-muted line-through" : "font-medium text-ink"
              }`}
            >
              {task.title}
              {depth > 0 && (
                <span className="ml-2 hidden text-xs font-normal text-muted xl:inline">sub-task</span>
              )}
            </span>
          </button>

          {/* Phones: the columns to the right are switched off, so the three
              things worth seeing move under the title. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 sm:hidden">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
            {due && (
              <span
                className={`text-xs ${
                  overdue
                    ? "font-medium text-danger"
                    : due === "Today"
                    ? "font-medium text-warn"
                    : "text-muted"
                }`}
              >
                {due}
              </span>
            )}
          </div>
        </div>

        {/* 4 — priority and status, side by side and never the same shape */}
        <div className="hidden min-w-0 items-center gap-2 sm:flex">
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
        </div>

        {/* 5 — duration */}
        <span className="hidden text-center text-xs text-muted xl:block">
          {task.duration_days ? `${task.duration_days}d` : "—"}
        </span>

        {/* 6 — progress */}
        <div className="hidden items-center gap-2 lg:flex">
          <span className="h-1 w-10 flex-none overflow-hidden rounded-full bg-subtle">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${task.percent_complete ?? 0}%` }}
            />
          </span>
          <span className="w-8 flex-none text-right text-xs text-muted">
            {task.percent_complete ? `${task.percent_complete}%` : "—"}
          </span>
        </div>

        {/* 7 — deadline. Overdue and "due today" are the only two states that
            get colour, so colour always means "act on this". */}
        <span
          className={`hidden text-right text-xs sm:block ${
            overdue ? "font-medium text-danger" : due === "Today" ? "font-medium text-warn" : "text-muted"
          }`}
          title={task.due_date ? fmtDate(task.due_date) : undefined}
        >
          {due ?? "—"}
        </span>

        {/* 8 — assignee */}
        <div className="hidden min-w-0 items-center justify-end gap-2 xl:flex">
          <span className="avatar" aria-hidden="true">
            {initials(task.assignee?.name || task.assignee?.username)}
          </span>
          <span className="min-w-0 truncate text-xs text-ink">
            {task.assignee?.name || task.assignee?.username || "Unassigned"}
          </span>
        </div>

        {/* 9 — row actions. Hover-revealed on desktop, always visible on touch.
            The width is reserved rather than left to the content: the header has
            an empty cell of the same size, so without it the two buttons would
            be pushed out to the row edge and the whole column would look
            misaligned. Phones use `auto` for this column, so the fixed width
            only applies from sm up. */}
        <div className="flex flex-none items-center justify-end gap-0.5 opacity-100 transition sm:w-[88px] sm:opacity-0 sm:group-hover:opacity-100">
          {depth === 0 && (
            <button
              onClick={() => onAddSub(task)}
              className="tap rounded px-2 text-xs text-muted hover:bg-subtle hover:text-accent"
              title="Add sub-task"
            >
              + Sub
            </button>
          )}
          <button
            onClick={remove}
            className="tap rounded px-2 text-xs text-muted hover:bg-subtle hover:text-danger"
            title="Delete"
          >
            Delete
          </button>
        </div>
      </motion.div>

      {reduceMotion ? (
        open &&
        subtasks.map((st) => (
          <Row
            key={st.id}
            task={st}
            depth={depth + 1}
            onEdit={onEdit}
            onAddSub={onAddSub}
            onChanged={onChanged}
          />
        ))
      ) : (
        <AnimatePresence initial={false}>
          {open && subtasks.length > 0 && (
            <motion.div
              key={`${task.id}-children`}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={motionTransition.normal}
              className="overflow-hidden"
            >
              {subtasks.map((st) => (
                <Row
                  key={st.id}
                  task={st}
                  depth={depth + 1}
                  onEdit={onEdit}
                  onAddSub={onAddSub}
                  onChanged={onChanged}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
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
  onEdit: (t: Task) => void;
  onAddSub: (t: Task) => void;
  onChanged: () => void;
}) {
  return (
    <div className="card overflow-hidden">
      {/* Same .row-grid template as the rows, so every label sits above the
          column it belongs to instead of approximately near it. */}
      <div className="row-grid hidden border-b border-line bg-subtle px-4 py-2 text-xs font-medium text-muted sm:grid">
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span>Task</span>
        <span>Priority / status</span>
        <span className="hidden text-center xl:block">Dur.</span>
        <span className="hidden lg:block">Progress</span>
        <span className="text-right">Deadline</span>
        <span className="hidden text-right xl:block">Assignee</span>
        {/* Matches the actions cell in Row, so the columns cannot drift. */}
        <span className="hidden sm:block" aria-hidden="true" />
      </div>
      <AnimatePresence initial={false}>
        {tasks.map((t) => (
          <Row key={t.id} task={t} depth={0} onEdit={onEdit} onAddSub={onAddSub} onChanged={onChanged} />
        ))}
      </AnimatePresence>
      {tasks.length === 0 && (
        <p className="px-4 py-10 text-center text-sm text-muted">No tasks match this view.</p>
      )}
    </div>
  );
}
