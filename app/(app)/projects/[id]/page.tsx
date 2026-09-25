"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import TaskList from "@/components/TaskList";
import TaskModal from "@/components/TaskModal";
import TaskInspector from "@/components/TaskInspector";
import KanbanBoard from "@/components/KanbanBoard";
import GanttTimeline from "@/components/GanttTimeline";
import ProjectMembers from "@/components/ProjectMembers";
import ProjectSettingsModal from "@/components/ProjectSettingsModal";
import { ProjectStatusBadge } from "@/components/Badges";
import { api, fmtDate, isOverdue } from "@/lib/api";
import { nestTasks } from "@/lib/tasks";
import type { Project, ProjectMember, ProjectStatus, Task, UserPublic } from "@/types";

type Tab = "list" | "kanban" | "timeline" | "members";

const TABS: { key: Tab; label: string }[] = [
  { key: "kanban", label: "Kanban" },
  { key: "list", label: "Tasks" },
  { key: "timeline", label: "Timeline" },
  { key: "members", label: "Members" },
];

const EMOJI_MAP: Record<string, string> = {
  folder: "📁",
  rocket: "🚀",
  chart: "📊",
  sparkles: "✨",
  briefcase: "💼",
  calendar: "📅",
  target: "🎯",
  zap: "⚡",
  heart: "❤️",
  bookmark: "🔖",
};

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [tab, setTab] = useState<Tab>("kanban");
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Panels
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<"general" | "workflow" | "members" | "danger">("general");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [parentFor, setParentFor] = useState<string | null>(null);
  const [inspectorTask, setInspectorTask] = useState<Task | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pRes, tRes, mRes, sRes] = await Promise.all([
        api<{ project: Project }>(`/api/projects/${projectId}`),
        api<{ tasks: Task[] }>(`/api/tasks?project_id=${projectId}`),
        api<{ members: ProjectMember[] }>(`/api/projects/${projectId}/members`),
        api<{ statuses: ProjectStatus[] }>(`/api/projects/${projectId}/statuses`).catch(() => ({ statuses: [] })),
      ]);
      setProject(pRes.project);
      setTasks(tRes.tasks ?? []);
      setMembers(mRes.members ?? []);
      setStatuses(sRes.statuses ?? []);

      // If project has default_view set and it's valid, respect it on first load
      if (pRes.project?.default_view && ["kanban", "list", "timeline", "members"].includes(pRes.project.default_view)) {
        setTab((curr) => (curr === "kanban" ? (pRes.project.default_view as Tab) : curr));
      }

      // If inspector is open, refresh its task object
      setInspectorTask((prev) => {
        if (!prev) return null;
        return (tRes.tasks ?? []).find((t) => t.id === prev.id) || null;
      });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const nested = useMemo(() => nestTasks(tasks), [tasks]);
  const assignable: UserPublic[] = useMemo(
    () => members.map((m) => m.user).filter(Boolean) as UserPublic[],
    [members]
  );

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const overdue = tasks.filter((t) => isOverdue(t)).length;
    return {
      total,
      done,
      overdue,
      pct: total ? Math.round((done / total) * 100) : 0,
    };
  }, [tasks]);

  // Click on card opens TaskInspector
  function handleTaskClick(t: Task) {
    setInspectorTask(t);
  }

  function openNewTask() {
    setEditingTask(null);
    setParentFor(null);
    setModalOpen(true);
  }

  function openSubtask(t: Task) {
    setEditingTask(null);
    setParentFor(t.id);
    setModalOpen(true);
  }

  function openSettingsTab(targetTab: "general" | "workflow" | "members" | "danger") {
    setSettingsInitialTab(targetTab);
    setSettingsOpen(true);
    setShowActionMenu(false);
  }

  async function toggleArchive() {
    if (!project) return;
    const newStatus = project.status === "archived" ? "active" : "archived";
    try {
      await api(`/api/projects/${projectId}`, {
        method: "PATCH",
        json: {
          status: newStatus,
          archived_at: newStatus === "archived" ? new Date().toISOString() : null,
        },
      });
      await load();
    } catch (err: any) {
      alert(err.message || "Failed to update project status.");
    }
  }

  async function deleteProject() {
    if (!project) return;
    const confirmed = prompt(`Type "${project.name}" to delete this project permanently:`);
    if (confirmed !== project.name) return;
    try {
      await api(`/api/projects/${projectId}`, { method: "DELETE" });
      router.push("/projects");
    } catch (err: any) {
      alert(err.message || "Unable to delete project.");
    }
  }

  if (loading) return <div className="px-8 py-8 text-sm text-muted">Loading project…</div>;
  if (!project) return <div className="px-8 py-8 text-sm text-muted">Project not found.</div>;

  const accent = project.accent_color ?? "#12A594";
  const iconKey = project.icon ?? "folder";
  const isArchived = project.status === "archived";

  return (
    <>
      {/* Archived Notice Banner */}
      {isArchived && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-8 py-2.5 flex items-center justify-between">
          <p className="text-xs text-amber-800 font-medium flex items-center gap-2">
            <span>⚠️</span>
            This project is currently archived. Tasks are read-only until restored.
          </p>
          <button
            type="button"
            onClick={toggleArchive}
            className="rounded bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 transition"
          >
            Restore project
          </button>
        </div>
      )}

      {/* Project Header */}
      <div className="border-b border-line px-8 pt-5 bg-white">
        <div className="flex items-center justify-between">
          <Link href="/projects" className="text-xs text-muted hover:text-ink flex items-center gap-1">
            <span>←</span> Projects
          </Link>

          {/* Quick status badge */}
          <div className="flex items-center gap-2">
            {project.owner && (
              <span className="text-xs text-muted">
                Owner: <strong className="text-ink">{project.owner.name || project.owner.username}</strong>
              </span>
            )}
            <ProjectStatusBadge status={project.status} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-10 w-10 flex-none items-center justify-center rounded-lg text-xl border border-line/40 shadow-xs"
                style={{ backgroundColor: `${accent}18` }}
              >
                {EMOJI_MAP[iconKey] || "📁"}
              </span>
              <h1 className="truncate text-xl font-bold text-ink">{project.name}</h1>
            </div>

            <p className="mt-1.5 text-sm text-muted line-clamp-2">
              {project.description || "No project description provided."}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
              <span>
                {fmtDate(project.start_date)} → {fmtDate(project.end_date) || "No deadline"}
              </span>
              <span>·</span>
              <span>
                {stats.done}/{stats.total} tasks completed ({stats.pct}%)
              </span>
              {stats.overdue > 0 && (
                <>
                  <span>·</span>
                  <span className="text-danger font-medium">{stats.overdue} overdue</span>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-none items-center gap-2">
            <button onClick={openNewTask} className="btn-primary">
              + New task
            </button>

            <button onClick={() => openSettingsTab("general")} className="btn">
              Settings
            </button>

            {/* Dropdown Action Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowActionMenu(!showActionMenu)}
                className="btn px-2.5"
                title="More actions"
              >
                •••
              </button>

              {showActionMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowActionMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-30 w-52 rounded-lg border border-line bg-white p-1.5 shadow-xl">
                    <button
                      type="button"
                      onClick={() => openSettingsTab("general")}
                      className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-ink hover:bg-subtle"
                    >
                      ✏️ Edit Project Details
                    </button>
                    <button
                      type="button"
                      onClick={() => openSettingsTab("workflow")}
                      className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-ink hover:bg-subtle"
                    >
                      🔄 Configure Workflow
                    </button>
                    <button
                      type="button"
                      onClick={() => openSettingsTab("members")}
                      className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-ink hover:bg-subtle"
                    >
                      👥 Manage Members
                    </button>
                    <div className="my-1 border-t border-line" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowActionMenu(false);
                        toggleArchive();
                      }}
                      className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-ink hover:bg-subtle"
                    >
                      📁 {isArchived ? "Restore Project" : "Archive Project"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowActionMenu(false);
                        deleteProject();
                      }}
                      className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-danger hover:bg-rose-50"
                    >
                      🗑️ Delete Project
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <div className="mt-5 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
                tab === t.key
                  ? "border-ink font-semibold text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
              {t.key === "members" && (
                <span className="ml-1.5 rounded-full bg-subtle px-1.5 py-0.2 text-xs text-muted">
                  {members.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main View Area */}
      <div className="px-8 py-6">
        {tab === "kanban" && (
          <KanbanBoard
            tasks={tasks}
            projectStatuses={statuses}
            onEdit={handleTaskClick}
            onChanged={load}
          />
        )}
        {tab === "list" && (
          <TaskList
            tasks={nested}
            users={assignable}
            onEdit={handleTaskClick}
            onAddSub={openSubtask}
            onChanged={load}
          />
        )}
        {tab === "timeline" && (
          <GanttTimeline
            tasks={tasks}
            onEdit={handleTaskClick}
          />
        )}
        {tab === "members" && (
          <ProjectMembers
            projectId={projectId}
            onChanged={load}
          />
        )}
      </div>

      {/* Task Creation / Full Edit Modal */}
      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        task={editingTask}
        projectId={projectId}
        parentTaskId={parentFor}
        assignableUsers={assignable}
        projectStatuses={statuses}
      />

      {/* Right-Side Task Inspector Drawer */}
      {inspectorTask && (
        <TaskInspector
          task={inspectorTask}
          projectId={projectId}
          projectStatuses={statuses}
          members={members}
          assignableUsers={assignable}
          onClose={() => setInspectorTask(null)}
          onTaskUpdated={load}
          onTaskDeleted={() => {
            setInspectorTask(null);
            load();
          }}
        />
      )}

      {/* Project Settings Modal (General, Workflow, Members, Danger Zone) */}
      <ProjectSettingsModal
        open={settingsOpen}
        project={project}
        members={members}
        users={assignable}
        initialTab={settingsInitialTab}
        onClose={() => setSettingsOpen(false)}
        onSaved={load}
        onDeleted={() => router.push("/projects")}
      />
    </>
  );
}
