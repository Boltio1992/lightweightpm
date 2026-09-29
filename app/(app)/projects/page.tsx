"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import ImportModal from "@/components/ImportModal";
import ProjectSettingsModal from "@/components/ProjectSettingsModal";
import ProjectCard, {
  CardMenu,
  ProjectAttentionChip,
  ProjectDeadline,
  ProjectProgress,
  projectPercent,
} from "@/components/ProjectCard";
import { ProjectStatusBadge } from "@/components/Badges";
import { api, droppedColumnsMessage } from "@/lib/api";
import { initials } from "@/lib/format";
import { PROJECT_ICONS, projectEmoji } from "@/lib/projectIcon";
import type { Project, ProjectWithStats } from "@/types";

type SortKey = "recent" | "name" | "progress" | "deadline" | "overdue";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "on_hold", label: "On hold" },
  { key: "done", label: "Done" },
  { key: "archived", label: "Archived" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Recently created" },
  { key: "name", label: "Name A–Z" },
  { key: "progress", label: "Most complete" },
  { key: "deadline", label: "Deadline soonest" },
  { key: "overdue", label: "Needs attention" },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<"grid" | "list">("grid");

  // New project modal state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [icon, setIcon] = useState("folder");
  const [defaultView, setDefaultView] = useState("kanban");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ projects: ProjectWithStats[] }>("/api/projects");
      setProjects(data.projects ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Project name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setWarning(null);
    try {
      const res = await api<{ project?: Record<string, any>; droppedColumns?: string[] }>("/api/projects", {
        method: "POST",
        json: {
          name: trimmedName,
          description,
          start_date: startDate || null,
          end_date: endDate || null,
          icon,
          default_view: defaultView,
        },
      });
      await load();
      const dropped = droppedColumnsMessage(res?.droppedColumns);
      if (dropped) {
        // Keep the modal open so the message is actually seen.
        setWarning(dropped);
        return;
      }
      setName("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setIcon("folder");
      setOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(project: ProjectWithStats) {
    if (!confirm(`Delete “${project.name}” and all of its tasks? This cannot be undone.`)) return;
    try {
      await api(`/api/projects/${project.id}`, { method: "DELETE" });
      setProjects((current) => current.filter((item) => item.id !== project.id));
    } catch (err: any) {
      alert(err.message || "Unable to delete project.");
    }
  }

  async function toggleArchive(p: ProjectWithStats) {
    const newStatus = p.status === "archived" ? "active" : "archived";
    try {
      await api(`/api/projects/${p.id}`, {
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

  const totals = useMemo(() => {
    const tasks = projects.reduce((sum, p) => sum + (p.stats?.total ?? 0), 0);
    const overdue = projects.reduce((sum, p) => sum + (p.stats?.overdue ?? 0), 0);
    return { tasks, overdue };
  }, [projects]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = projects.filter((p) => {
      if (filter !== "all" && p.status !== filter) return false;
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        (p.description ?? "").toLowerCase().includes(term)
      );
    });

    const byName = (a: ProjectWithStats, b: ProjectWithStats) => a.name.localeCompare(b.name);
    switch (sort) {
      case "name":
        return rows.sort(byName);
      case "progress":
        return rows.sort((a, b) => projectPercent(b) - projectPercent(a) || byName(a, b));
      case "deadline":
        // Projects without a deadline sort last instead of pretending to be earliest.
        return rows.sort((a, b) => {
          if (!a.end_date && !b.end_date) return byName(a, b);
          if (!a.end_date) return 1;
          if (!b.end_date) return -1;
          return a.end_date.localeCompare(b.end_date);
        });
      case "overdue":
        return rows.sort(
          (a, b) =>
            (b.stats?.overdue ?? 0) - (a.stats?.overdue ?? 0) || projectPercent(a) - projectPercent(b)
        );
      default:
        return rows; // API already returns newest first
    }
  }, [projects, filter, search, sort]);

  const filtersActive = filter !== "all" || search.trim().length > 0;

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle={
          loading
            ? "Loading…"
            : `${projects.length} project${projects.length === 1 ? "" : "s"} · ${totals.tasks} tasks · ${totals.overdue} overdue`
        }
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setImportOpen(true)} className="btn tap flex-1 sm:flex-none">
              Import
            </button>
            <button onClick={() => setOpen(true)} className="btn-primary tap flex-1 sm:flex-none">
              + New project
            </button>
          </div>
        }
      />

      <div className="page-x py-5 sm:py-6">
        {/* Filters, search, sort and view switch */}
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="scroll-x">
            {STATUS_FILTERS.map((f) => {
              const count =
                f.key === "all" ? projects.length : projects.filter((p) => p.status === f.key).length;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`tap-tab flex-none gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition sm:px-2.5 sm:py-1 ${
                    filter === f.key ? "bg-ink text-white" : "text-muted hover:bg-subtle"
                  }`}
                >
                  <span>{f.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-xs ${
                      filter === f.key ? "bg-white/20 text-white" : "bg-subtle text-muted"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
              <input
                type="text"
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pr-8 text-sm"
                aria-label="Search projects"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="tap-icon absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 rounded text-muted hover:bg-subtle hover:text-ink"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <label className="sr-only" htmlFor="project-sort">
              Sort projects
            </label>
            <select
              id="project-sort"
              className="input w-auto flex-none py-1.5 text-xs"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>

            <div className="seg" role="group" aria-label="View mode">
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-pressed={view === "grid"}
                className={`seg-item ${view === "grid" ? "seg-item-on" : ""}`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
                className={`seg-item ${view === "list" ? "seg-item-on" : ""}`}
              >
                List
              </button>
            </div>
          </div>
        </div>

        {loading && <p className="text-sm text-muted">Loading projects…</p>}

        {!loading && shown.length === 0 && (
          <div className="card px-4 py-16 text-center">
            <p className="text-sm text-muted">
              {search ? `No projects matching “${search}”.` : "No projects in this view yet."}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {filtersActive && (
                <button
                  onClick={() => {
                    setFilter("all");
                    setSearch("");
                  }}
                  className="btn"
                >
                  Clear filters
                </button>
              )}
              <button onClick={() => setOpen(true)} className="btn-primary">
                Create a project
              </button>
            </div>
          </div>
        )}

        {/* Grid: cards. List: a real table on desktop, cards again on phones. */}
        {view === "grid" ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onSettings={() => setEditingProject(p)}
                onArchive={() => toggleArchive(p)}
                onDelete={() => deleteProject(p)}
              />
            ))}
          </div>
        ) : (
          <>
            {/* Table from lg up only: at 768–1023px these columns cannot fit
                beside the sidebar and the actions cell gets clipped. */}
            <div className="card hidden overflow-hidden lg:block">
              <div className="proj-grid border-b border-line bg-subtle px-3 py-2 text-xs font-medium text-muted">
                <span>Project</span>
                <span>Status</span>
                <span>Progress</span>
                <span>Tasks</span>
                <span>Deadline</span>
                <span className="hidden xl:block">Owner</span>
                <span />
              </div>
              {shown.map((p) => {
                const ownerName = p.owner?.name || p.owner?.username;
                return (
                  <div
                    key={p.id}
                    className="proj-grid border-b border-line px-3 py-2.5 transition last:border-0 hover:bg-subtle"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-line bg-subtle text-base">
                        {projectEmoji(p.icon)}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/projects/${p.id}`}
                          className="block truncate text-sm font-medium text-ink hover:underline"
                        >
                          {p.name}
                        </Link>
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs text-muted">
                            {p.description || "No description"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      <ProjectStatusBadge status={p.status} />
                      <ProjectAttentionChip project={p} />
                    </div>

                    <div className="flex items-center gap-2">
                      <ProjectProgress project={p} />
                      <span className="w-9 flex-none text-right text-xs font-medium text-ink">
                        {projectPercent(p)}%
                      </span>
                    </div>

                    <span className="text-xs text-muted">
                      {p.stats.done}/{p.stats.total}
                    </span>

                    <span className="text-xs">
                      <ProjectDeadline project={p} />
                    </span>

                    <div className="hidden min-w-0 items-center gap-1.5 xl:flex">
                      {ownerName ? (
                        <>
                          <span className="avatar">{initials(ownerName)}</span>
                          <span className="truncate text-xs text-muted">{ownerName}</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted">Unassigned</span>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <CardMenu
                        archived={p.status === "archived"}
                        onSettings={() => setEditingProject(p)}
                        onArchive={() => toggleArchive(p)}
                        onDelete={() => deleteProject(p)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
              {shown.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onSettings={() => setEditingProject(p)}
                  onArchive={() => toggleArchive(p)}
                  onDelete={() => deleteProject(p)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* New Project Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Create New Project" width="max-w-xl">
        <form onSubmit={create} className="space-y-4">
          {warning && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
              <span className="text-sm leading-none">⚠️</span>
              <p className="flex-1 text-xs leading-relaxed text-amber-900">{warning}</p>
              <button
                type="button"
                onClick={() => setWarning(null)}
                className="tap -my-1 px-1 text-amber-700 hover:text-amber-900"
                aria-label="Dismiss warning"
              >
                ✕
              </button>
            </div>
          )}
          <div>
            <label className="label">Project name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apollo Redesign, Mobile App v2"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[72px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Objectives, deliverables, and scope…"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Start date</label>
              <input
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Target end date</label>
              <input
                type="date"
                className="input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Default view</label>
            <select className="input" value={defaultView} onChange={(e) => setDefaultView(e.target.value)}>
              <option value="kanban">Kanban Board</option>
              <option value="list">Tasks List</option>
              <option value="timeline">Timeline</option>
              <option value="members">Members</option>
            </select>
          </div>

          <div>
            <label className="label">Project icon</label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_ICONS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setIcon(item.key)}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg border text-lg transition sm:h-9 sm:w-9 sm:text-base ${
                    icon === item.key
                      ? "border-ink bg-subtle scale-105"
                      : "border-line bg-white hover:bg-subtle text-muted"
                  }`}
                >
                  {item.emoji}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          {/* Sticky on phones (thumb reach, survives the keyboard), an
              ordinary right-aligned row from sm up. */}
          <div className="sheet-actions">
            <button type="button" onClick={() => setOpen(false)} className="btn tap w-full sm:w-auto">
              Cancel
            </button>
            <button className="btn-primary tap w-full sm:w-auto" disabled={saving}>
              {saving ? "Creating…" : "Create Project"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Excel Import Modal */}
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={load} />

      {/* Edit Project Settings Modal */}
      {editingProject && (
        <ProjectSettingsModal
          open={Boolean(editingProject)}
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSaved={load}
          onDeleted={load}
        />
      )}
    </>
  );
}
