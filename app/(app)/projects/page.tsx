"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import ProjectSettingsModal from "@/components/ProjectSettingsModal";
import { ProjectStatusBadge } from "@/components/Badges";
import { api, fmtDate } from "@/lib/api";
import type { Project } from "@/types";

type Row = Project & {
  stats: { total: number; done: number; overdue: number; progressTotal?: number };
  calculated_percent_complete?: number;
};

const ICONS = [
  { key: "folder", emoji: "📁" },
  { key: "rocket", emoji: "🚀" },
  { key: "chart", emoji: "📊" },
  { key: "sparkles", emoji: "✨" },
  { key: "briefcase", emoji: "💼" },
  { key: "calendar", emoji: "📅" },
  { key: "target", emoji: "🎯" },
  { key: "zap", emoji: "⚡" },
];

const ACCENTS = ["#12A594", "#3B82F6", "#6366F1", "#8B5CF6", "#F59E0B", "#EF4444", "#10B981"];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  // New project modal state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [icon, setIcon] = useState("folder");
  const [accentColor, setAccentColor] = useState("#12A594");
  const [defaultView, setDefaultView] = useState("kanban");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit project modal state
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ projects: Row[] }>("/api/projects");
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
    try {
      await api("/api/projects", {
        method: "POST",
        json: {
          name: trimmedName,
          description,
          start_date: startDate || null,
          end_date: endDate || null,
          icon,
          accent_color: accentColor,
          default_view: defaultView,
        },
      });
      setName("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setIcon("folder");
      setAccentColor("#12A594");
      setOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(project: Row) {
    if (!confirm(`Delete “${project.name}” and all of its tasks? This cannot be undone.`)) return;
    try {
      await api(`/api/projects/${project.id}`, { method: "DELETE" });
      setProjects((current) => current.filter((item) => item.id !== project.id));
    } catch (err: any) {
      alert(err.message || "Unable to delete project.");
    }
  }

  async function toggleArchive(p: Row) {
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

  const filteredByStatus = filter === "all" ? projects : projects.filter((p) => p.status === filter);
  const shown = search.trim()
    ? filteredByStatus.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
      )
    : filteredByStatus;

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Manage workspaces, custom workflows, and team initiatives."
        actions={
          <button onClick={() => setOpen(true)} className="btn-primary">
            + New project
          </button>
        }
      />
      <div className="px-8 py-6">
        {/* Filter and Search Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1">
            {["all", "active", "on_hold", "done", "archived"].map((f) => {
              const count = f === "all" ? projects.length : projects.filter((p) => p.status === f).length;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition flex items-center gap-1.5 ${
                    filter === f ? "bg-ink text-white" : "text-muted hover:bg-subtle"
                  }`}
                >
                  <span>{f.replace("_", " ")}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      filter === f ? "bg-white/20 text-white" : "bg-subtle text-muted"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input text-xs py-1.5"
            />
          </div>
        </div>

        {loading && <p className="text-sm text-muted">Loading projects…</p>}

        {!loading && shown.length === 0 && (
          <div className="card px-4 py-16 text-center">
            <p className="text-sm text-muted">
              {search ? `No projects matching "${search}"` : "No projects in this view yet."}
            </p>
            <button onClick={() => setOpen(true)} className="btn mt-3">
              Create a project
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => {
            const pct =
              p.calculated_percent_complete ??
              p.percent_complete ??
              (p.stats.total ? Math.round((p.stats.done / p.stats.total) * 100) : 0);
            const accent = p.accent_color || "#12A594";
            const iconKey = p.icon || "folder";

            const emojiMap: Record<string, string> = {
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

            return (
              <div
                key={p.id}
                className="card flex flex-col justify-between p-5 transition hover:shadow-pop border border-line bg-white"
              >
                <div>
                  <div className="mb-2.5 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-lg border border-line/40 shadow-xs"
                        style={{ backgroundColor: `${accent}18` }}
                      >
                        {emojiMap[iconKey] || "📁"}
                      </span>
                      <div className="min-w-0">
                        <Link href={`/projects/${p.id}`} className="block truncate font-semibold text-ink hover:text-accent">
                          {p.name}
                        </Link>
                        {p.owner && (
                          <p className="text-[11px] text-muted truncate">
                            Owner: {p.owner.name || p.owner.username}
                          </p>
                        )}
                      </div>
                    </div>
                    <ProjectStatusBadge status={p.status} />
                  </div>

                  <p className="line-clamp-2 min-h-[2.5rem] text-xs text-muted">
                    {p.description || "No project description"}
                  </p>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-muted mb-1">
                      <span>Progress</span>
                      <span className="font-medium text-ink">{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, backgroundColor: accent }}
                      />
                    </div>
                  </div>

                  <div className="mt-3.5 flex items-center justify-between text-xs text-muted">
                    <span>
                      {p.stats.total} task{p.stats.total === 1 ? "" : "s"} ({p.stats.done} done)
                    </span>
                    {p.stats.overdue > 0 ? (
                      <span className="font-semibold text-danger">{p.stats.overdue} overdue</span>
                    ) : (
                      <span>{fmtDate(p.end_date) || "No deadline"}</span>
                    )}
                  </div>
                </div>

                {/* Card footer actions */}
                <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                  <Link href={`/projects/${p.id}`} className="text-xs font-medium text-ink hover:underline">
                    View project →
                  </Link>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingProject(p)}
                      className="rounded p-1 text-xs text-muted hover:text-ink hover:bg-subtle"
                      title="Project Settings"
                    >
                      Settings
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleArchive(p)}
                      className="rounded p-1 text-xs text-muted hover:text-ink hover:bg-subtle"
                    >
                      {p.status === "archived" ? "Restore" : "Archive"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProject(p)}
                      className="rounded p-1 text-xs text-muted hover:text-danger hover:bg-rose-50"
                      title="Delete project"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* New Project Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Create New Project" width="max-w-xl">
        <form onSubmit={create} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-3">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Default View</label>
              <select
                className="input"
                value={defaultView}
                onChange={(e) => setDefaultView(e.target.value)}
              >
                <option value="kanban">Kanban Board</option>
                <option value="list">Tasks List</option>
                <option value="timeline">Timeline</option>
                <option value="members">Members</option>
              </select>
            </div>

            <div>
              <label className="label">Accent Color</label>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {ACCENTS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAccentColor(color)}
                    className={`h-6 w-6 rounded-md border-2 transition ${
                      accentColor === color ? "border-ink scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label">Project Icon</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setIcon(item.key)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border text-base transition ${
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

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setOpen(false)} className="btn">
              Cancel
            </button>
            <button className="btn-primary" disabled={saving}>
              {saving ? "Creating…" : "Create Project"}
            </button>
          </div>
        </form>
      </Modal>

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
