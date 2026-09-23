"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import PageHeader from "@/components/PageHeader";
import TaskList from "@/components/TaskList";
import TaskModal from "@/components/TaskModal";
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

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [parentFor, setParentFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const url = scope === "standalone" ? "/api/tasks?standalone=true" : "/api/tasks";
    const data = await api<{ tasks: Task[] }>(url);
    setTasks(data.tasks ?? []);
    setLoading(false);
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<{ users: UserPublic[] }>("/api/users").then((d) => setUsers(d.users ?? []));
  }, []);

  const nested = useMemo(() => nestTasks(tasks), [tasks]);

  function openNew() {
    setEditing(null);
    setParentFor(null);
    setModalOpen(true);
  }
  function openEdit(t: Task) {
    setEditing(t);
    setParentFor(null);
    setModalOpen(true);
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

        {loading ? (
          <TaskViewSkeleton />
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
    </>
  );
}
