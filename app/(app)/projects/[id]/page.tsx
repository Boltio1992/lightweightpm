"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import TaskList from "@/components/TaskList";
import TaskModal from "@/components/TaskModal";
import KanbanBoard from "@/components/KanbanBoard";
import GanttTimeline from "@/components/GanttTimeline";
import ProjectMembers from "@/components/ProjectMembers";
import { ProjectStatusBadge } from "@/components/Badges";
import { api, fmtDate, isOverdue } from "@/lib/api";
import { nestTasks } from "@/lib/tasks";
import type { Project, ProjectMember, Task, UserPublic } from "@/types";

type Tab = "list" | "kanban" | "timeline" | "members";

const TABS: { key: Tab; label: string }[] = [
  { key: "list", label: "Tasks" },
  { key: "kanban", label: "Kanban" },
  { key: "timeline", label: "Timeline" },
  { key: "members", label: "Members" },
];

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [tab, setTab] = useState<Tab>("list");
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [parentFor, setParentFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, t, m] = await Promise.all([
      api<{ project: Project }>(`/api/projects/${projectId}`),
      api<{ tasks: Task[] }>(`/api/tasks?project_id=${projectId}`),
      api<{ members: ProjectMember[] }>(`/api/projects/${projectId}/members`),
    ]);
    setProject(p.project);
    setTasks(t.tasks ?? []);
    setMembers(m.members ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const nested = useMemo(() => nestTasks(tasks), [tasks]);

  // Only project members can be assigned work on this project.
  const assignable: UserPublic[] = useMemo(
    () => members.map((m) => m.user).filter(Boolean) as UserPublic[],
    [members]
  );

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const overdue = tasks.filter((t) => isOverdue(t)).length;
    return { total, done, overdue, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [tasks]);

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

  async function deleteProject() {
    if (!confirm("Delete this project and all of its tasks? This cannot be undone.")) return;
    await api(`/api/projects/${projectId}`, { method: "DELETE" }).catch(() => {});
    router.push("/projects");
  }

  async function changeStatus(status: string) {
    await api(`/api/projects/${projectId}`, { method: "PATCH", json: { status } }).catch(() => {});
    load();
  }

  if (loading) return <div className="px-8 py-8 text-sm text-muted">Loading…</div>;
  if (!project) return <div className="px-8 py-8 text-sm text-muted">Project not found.</div>;

  return (
    <>
      <div className="border-b border-line px-8 pt-5">
        <Link href="/projects" className="text-xs text-muted hover:text-ink">
          ← Projects
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-semibold text-ink">{project.name}</h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted">
              {project.description || "No description"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {fmtDate(project.start_date)} → {fmtDate(project.end_date)} · {stats.done}/{stats.total} tasks
              done ({stats.pct}%)
              {stats.overdue > 0 && <span className="text-danger"> · {stats.overdue} overdue</span>}
            </p>
          </div>
          <div className="flex flex-none items-center gap-2">
            <select
              className="input w-auto"
              value={project.status}
              onChange={(e) => changeStatus(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="done">Done</option>
              <option value="archived">Archived</option>
            </select>
            <button onClick={openNew} className="btn-primary">
              New task
            </button>
            <button onClick={deleteProject} className="btn-danger">
              Delete
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
                tab === t.key
                  ? "border-ink font-medium text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
              {t.key === "members" && <span className="ml-1.5 text-xs text-muted">{members.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6">
        {tab === "list" && (
          <TaskList
            tasks={nested}
            users={assignable}
            onEdit={openEdit}
            onAddSub={openSub}
            onChanged={load}
          />
        )}
        {tab === "kanban" && <KanbanBoard tasks={tasks} onEdit={openEdit} onChanged={load} />}
        {tab === "timeline" && <GanttTimeline tasks={tasks} onEdit={openEdit} />}
        {tab === "members" && <ProjectMembers projectId={projectId} onChanged={load} />}
      </div>

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        task={editing}
        projectId={projectId}
        parentTaskId={parentFor}
        assignableUsers={assignable}
      />
    </>
  );
}
