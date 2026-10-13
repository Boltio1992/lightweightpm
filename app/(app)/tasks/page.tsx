"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import PageHeader from "@/components/PageHeader";
import TaskList from "@/components/TaskList";
import TaskModal from "@/components/TaskModal";
import TaskInspector from "@/components/TaskInspector";
import ImportModal from "@/components/ImportModal";
import KanbanBoard from "@/components/KanbanBoard";
import GanttTimeline from "@/components/GanttTimeline";
import { TaskViewSkeleton } from "@/components/LoadingSkeletons";
import { fadeUp, motionTransition } from "@/lib/motion";
import { api, onTasksChanged } from "@/lib/api";
import { nestTasks } from "@/lib/tasks";
import type { ProjectStatus, Task, UserPublic } from "@/types";

type View = "list" | "kanban" | "timeline";

/**
 * Which project to show: the id of one, or one of two sentinels.
 *
 * This page is the single task table - every task, project-bound or not. It used
 * to default to "standalone" with a two-way toggle, which made project-less
 * tasks look like a separate table; the split was presentation only, since
 * `tasks.project_id` has always been nullable.
 */
const ALL_PROJECTS = "all";
const NO_PROJECT = "none";

export default function TasksPage() {
  const reduceMotion = useReducedMotion();
  const [projectFilter, setProjectFilter] = useState<string>(ALL_PROJECTS);
  const [view, setView] = useState<View>("list");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<ProjectStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [parentFor, setParentFor] = useState<string | null>(null);
  const [inspectorTask, setInspectorTask] = useState<Task | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Always the full list: filtering happens below, so changing the project
      // filter never costs a round trip.
      const data = await api<{ tasks: Task[] }>("/api/tasks");
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<{ users: UserPublic[] }>("/api/users")
      .then((d) => setUsers(d.users ?? []))
      .then(() => undefined)
      .catch((e) => console.warn("[TasksPage] Could not load users:", e));
  }, []);

  // A task created from the global (⌘K) modal refreshes just this list.
  useEffect(() => onTasksChanged(load), [load]);

  // Which projects to offer. Derived from the tasks themselves, because each one
  // already arrives with its project embedded - no extra request, and no empty
  // projects cluttering the filter.
  const projectOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const t of tasks) {
      if (t.project) byId.set(t.project.id, t.project.name);
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    if (projectFilter === ALL_PROJECTS) return tasks;
    if (projectFilter === NO_PROJECT) return tasks.filter((t) => !t.project_id);
    return tasks.filter((t) => t.project_id === projectFilter);
  }, [tasks, projectFilter]);

  const filtered = projectFilter !== ALL_PROJECTS;
  const activeProjectName =
    projectFilter === NO_PROJECT
      ? "tasks with no project"
      : projectOptions.find(([id]) => id === projectFilter)?.[1] ?? "this project";

  // When the filter names one project, the board must show THAT project's
  // columns rather than the fallback vocabulary.
  useEffect(() => {
    if (projectFilter === ALL_PROJECTS || projectFilter === NO_PROJECT) {
      setFilterStatuses([]);
      return;
    }
    let cancelled = false;
    api<{ statuses: ProjectStatus[] }>(`/api/projects/${projectFilter}/statuses`)
      .then((d) => {
        if (!cancelled) setFilterStatuses(d.statuses ?? []);
      })
      .catch(() => {
        if (!cancelled) setFilterStatuses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectFilter]);

  const nested = useMemo(() => nestTasks(visibleTasks), [visibleTasks]);

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
        subtitle="Every task in one list. Filter by project to narrow it down."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setImportOpen(true)} className="btn tap">
              Import
            </button>
            <button onClick={openNew} className="btn-primary tap">
              New task
            </button>
          </div>
        }
      />

      <div className="page-x py-5 sm:py-6">
        <div className="mb-4 flex items-center gap-3">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            aria-label="Filter tasks by project"
            className="min-w-0 flex-none rounded-md border border-line bg-surface px-2 py-2 text-xs text-ink transition hover:bg-subtle sm:py-1"
          >
            <option value={ALL_PROJECTS}>All projects</option>
            <option value={NO_PROJECT}>No project</option>
            {projectOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>

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
                  className={`tap-tab relative flex-none whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition sm:py-1 ${
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

          <span className="ml-auto hidden flex-none text-xs text-muted sm:block">
            {filtered
              ? `${visibleTasks.length} of ${tasks.length} tasks`
              : `${tasks.length} tasks`}
          </span>
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-md border border-danger bg-dangerSoft px-4 py-3 text-xs text-danger">
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
        ) : visibleTasks.length === 0 ? (
          <div className="card px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-subtle text-muted">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="m8 12 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {/* Two different situations: nothing exists, or the filter hid
                everything. Saying which one stops a filter looking like lost
                data. */}
            <h3 className="mb-1 text-sm font-semibold text-ink">
              {tasks.length === 0 ? "No tasks yet" : "No tasks in this filter"}
            </h3>
            <p className="mx-auto mb-5 max-w-sm text-xs text-muted">
              {tasks.length === 0
                ? "Create a task to start tracking work. A task can belong to a project, or stand on its own."
                : `There is nothing for ${activeProjectName}.${
                    tasks.length > 0 ? " Other tasks are hidden by the filter." : ""
                  }`}
            </p>
            <div className="flex items-center justify-center gap-2">
              {filtered && tasks.length > 0 && (
                <button
                  onClick={() => setProjectFilter(ALL_PROJECTS)}
                  className="rounded-md border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle transition"
                >
                  Show all tasks
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
              key={`${projectFilter}-${view}`}
              initial={reduceMotion ? false : fadeUp.initial}
              animate={reduceMotion ? undefined : fadeUp.animate}
              exit={reduceMotion ? undefined : fadeUp.exit}
              transition={reduceMotion ? { duration: 0 } : motionTransition.normal}
            >
              {view === "list" ? (
                <TaskList tasks={nested} onEdit={openEdit} onAddSub={openSub} onChanged={load} />
              ) : view === "kanban" ? (
                <KanbanBoard
                  tasks={visibleTasks}
                  onEdit={openEdit}
                  onChanged={load}
                  projectStatuses={filterStatuses.length > 0 ? filterStatuses : undefined}
                />
              ) : (
                <GanttTimeline tasks={visibleTasks} onEdit={openEdit} />
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
        // Creating while filtered to a project puts the task in that project.
        projectId={filtered && projectFilter !== NO_PROJECT ? projectFilter : null}
        parentTaskId={parentFor}
        assignableUsers={users}
      />

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={load} />

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
