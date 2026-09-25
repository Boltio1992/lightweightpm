"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import PageHeader from "@/components/PageHeader";
import TaskList from "@/components/TaskList";
import TaskModal from "@/components/TaskModal";
import TaskInspector from "@/components/TaskInspector";
import KanbanBoard from "@/components/KanbanBoard";
import GanttTimeline from "@/components/GanttTimeline";
import { TaskViewSkeleton } from "@/components/LoadingSkeletons";
import { fadeUp, motionTransition } from "@/lib/motion";
import { api } from "@/lib/api";
import { nestTasks } from "@/lib/tasks";
import type { Task, UserPublic } from "@/types";

type Scope = "standalone" | "all";
type View = "list" | "kanban" | "timeline";

export default function TasksPage() {
  const reduceMotion = useReducedMotion();
  const [scope, setScope] = useState<Scope>("standalone");
  const [view, setView] = useState<View>("list");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [parentFor, setParentFor] = useState<string | null>(null);
  const [inspectorTask, setInspectorTask] = useState<Task | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = scope === "standalone" ? "/api/tasks?standalone=true" : "/api/tasks";
      const data = await api<{ tasks: Task[] }>(url);
      const loadedTasks = data.tasks ?? [];
      setTasks(loadedTasks);
      setInspectorTask((prev) => {
        if (!prev) return null;
        return loadedTasks.find((t) => t.id === prev.id) || null;
      });
    } catch (err: any) {
      console.error("[TasksPage] Failed to load tasks:", err);
      setError(err?.message || "Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<{ users: UserPublic[] }>("/api/users")
      .then((d) => setUsers(d.users ?? []))
      .catch((e) => console.warn("[TasksPage] Could not load users:", e));
  }, []);

  const nested = useMemo(() => nestTasks(tasks), [tasks]);

  function openNew() {
    setEditing(null);
    setParentFor(null);
    setModalOpen(true);
  }
  function openEdit(t: Task) {
    setInspectorTask(t);
  }
  function openSub(t: Task) {
    setEditing(null);
    setParentFor(t.id);
    setModalOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Standalone tasks live here. Switch scope to see everything."
        actions={
          <button onClick={openNew} className="btn-primary">
            New task
          </button>
        }
      />

      <div className="px-8 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <LayoutGroup id="scope-toggle">
            <div className="relative flex gap-1 rounded-md bg-subtle p-1">
              {(
                [
                  { k: "standalone", l: "No project" },
                  { k: "all", l: "All tasks" },
                ] as const
              ).map((s) => (
                <button
                  key={s.k}
                  onClick={() => setScope(s.k)}
                  className={`relative rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    scope === s.k ? "text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {scope === s.k && (
                    <motion.span
                      layoutId="scope-pill"
                      className="absolute inset-0 -z-10 rounded-md border border-line bg-surface shadow-soft"
                      transition={reduceMotion ? { duration: 0 } : motionTransition.fast}
                    />
                  )}
                  {s.l}
                </button>
              ))}
            </div>
          </LayoutGroup>

          <LayoutGroup id="view-toggle">
            <div className="relative flex gap-1 rounded-md bg-subtle p-1">
              {(
                [
                  { k: "list", l: "List" },
                  { k: "kanban", l: "Kanban" },
                  { k: "timeline", l: "Timeline" },
                ] as const
              ).map((v) => (
                <button
                  key={v.k}
                  onClick={() => setView(v.k)}
                  className={`relative rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    view === v.k ? "text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {view === v.k && (
                    <motion.span
                      layoutId="view-pill"
                      className="absolute inset-0 -z-10 rounded-md border border-line bg-surface shadow-soft"
                      transition={reduceMotion ? { duration: 0 } : motionTransition.fast}
                    />
                  )}
                  {v.l}
                </button>
              ))}
            </div>
          </LayoutGroup>

          <span className="ml-auto text-xs text-muted">{tasks.length} tasks</span>
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            <span>{error}</span>
            <button
              onClick={() => load()}
              className="ml-3 shrink-0 font-semibold underline hover:text-red-900"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <TaskViewSkeleton />
        ) : tasks.length === 0 ? (
          <div className="card px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-subtle text-muted">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="m8 12 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="mb-1 text-sm font-semibold text-ink">
              {scope === "standalone" ? "No standalone tasks" : "No tasks found"}
            </h3>
            <p className="mx-auto mb-5 max-w-sm text-xs text-muted">
              {scope === "standalone"
                ? "You don't have any standalone tasks outside of projects. You can switch to 'All tasks' to see project tasks, or create a new one."
                : "Your workspace has no tasks yet. Create a task to start tracking your work."}
            </p>
            <div className="flex items-center justify-center gap-2">
              {scope === "standalone" && (
                <button
                  onClick={() => setScope("all")}
                  className="rounded-md border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle transition"
                >
                  View all tasks
                </button>
              )}
              <button onClick={openNew} className="btn-primary text-xs">
                New task
              </button>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${scope}-${view}`}
              initial={reduceMotion ? false : fadeUp.initial}
              animate={reduceMotion ? undefined : fadeUp.animate}
              exit={reduceMotion ? undefined : fadeUp.exit}
              transition={reduceMotion ? { duration: 0 } : motionTransition.normal}
            >
              {view === "list" ? (
                <TaskList tasks={nested} users={users} onEdit={openEdit} onAddSub={openSub} onChanged={load} />
              ) : view === "kanban" ? (
                <KanbanBoard tasks={tasks} onEdit={openEdit} onChanged={load} />
              ) : (
                <GanttTimeline tasks={tasks} onEdit={openEdit} />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        task={editing}
        projectId={null}
        parentTaskId={parentFor}
        assignableUsers={users}
      />

      {inspectorTask && (
        <TaskInspector
          task={inspectorTask}
          projectId={inspectorTask.project_id}
          assignableUsers={users}
          onClose={() => setInspectorTask(null)}
          onTaskUpdated={load}
          onTaskDeleted={() => {
            setInspectorTask(null);
            load();
          }}
        />
      )}
    </>
  );
}
