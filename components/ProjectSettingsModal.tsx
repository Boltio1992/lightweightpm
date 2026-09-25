"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import { api } from "@/lib/api";
import type { Project, ProjectMember, ProjectMemberRole, ProjectStatus, UserPublic } from "@/types";

const ICONS = [
  { key: "folder", emoji: "📁", label: "Folder" },
  { key: "rocket", emoji: "🚀", label: "Rocket" },
  { key: "chart", emoji: "📊", label: "Chart" },
  { key: "sparkles", emoji: "✨", label: "Sparkles" },
  { key: "briefcase", emoji: "💼", label: "Briefcase" },
  { key: "calendar", emoji: "📅", label: "Calendar" },
  { key: "target", emoji: "🎯", label: "Target" },
  { key: "zap", emoji: "⚡", label: "Lightning" },
  { key: "heart", emoji: "❤️", label: "Heart" },
  { key: "bookmark", emoji: "🔖", label: "Bookmark" },
];

const ACCENTS = [
  "#12A594",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#F59E0B",
  "#EF4444",
  "#10B981",
  "#14B8A6",
  "#475569",
];

type SettingsTab = "general" | "workflow" | "members" | "danger";

export default function ProjectSettingsModal({
  open,
  project,
  members = [],
  users = [],
  initialTab = "general",
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  project: Project | null;
  members?: ProjectMember[];
  users?: UserPublic[];
  initialTab?: SettingsTab;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onDeleted?: () => void;
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  // General tab state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [icon, setIcon] = useState("folder");
  const [accentColor, setAccentColor] = useState("#12A594");
  const [ownerId, setOwnerId] = useState("");
  const [defaultView, setDefaultView] = useState("kanban");
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Workflow tab state
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusColor, setNewStatusColor] = useState("#64748B");
  const [newStatusIsDone, setNewStatusIsDone] = useState(false);
  const [addingStatus, setAddingStatus] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  // Members tab state
  const [memberList, setMemberList] = useState<ProjectMember[]>(members);
  const [memberQuery, setMemberQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserPublic[]>([]);
  const [searching, setSearching] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  // Data member form state
  const [mName, setMName] = useState("");
  const [mTitle, setMTitle] = useState("");
  const [mRole, setMRole] = useState<ProjectMemberRole>("member");
  const [addingDataMember, setAddingDataMember] = useState(false);

  // Danger zone state
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, open]);

  useEffect(() => {
    if (!project || !open) return;
    setName(project.name ?? "");
    setDescription(project.description ?? "");
    setStatus(project.status ?? "active");
    setStartDate(project.start_date ?? "");
    setEndDate(project.end_date ?? "");
    setIcon(project.icon ?? "folder");
    setAccentColor(project.accent_color ?? "#12A594");
    setOwnerId(project.owner_id ?? "");
    setDefaultView(project.default_view ?? "kanban");
    setGeneralError(null);
    setWorkflowError(null);
    loadStatuses();
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, open]);

  async function loadStatuses() {
    if (!project) return;
    setLoadingStatuses(true);
    try {
      const res = await api<{ statuses: ProjectStatus[] }>(`/api/projects/${project.id}/statuses`);
      setStatuses(res.statuses ?? []);
    } catch {
      // fallback
    } finally {
      setLoadingStatuses(false);
    }
  }

  async function loadMembers() {
    if (!project) return;
    try {
      const res = await api<{ members: ProjectMember[] }>(`/api/projects/${project.id}/members`);
      setMemberList(res.members ?? []);
    } catch {
      // fallback
    }
  }

  // Debounced search for adding registered users
  useEffect(() => {
    if (!memberQuery.trim() || !project) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const data = await api<{ users: UserPublic[] }>(
          `/api/users?q=${encodeURIComponent(memberQuery.trim())}`
        );
        const existing = new Set(memberList.map((m) => m.user_id));
        setSearchResults((data.users ?? []).filter((u) => !existing.has(u.id)));
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [memberQuery, memberList, project]);

  async function saveGeneral(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    setSavingGeneral(true);
    setGeneralError(null);

    try {
      await api(`/api/projects/${project.id}`, {
        method: "PATCH",
        json: {
          name: name.trim(),
          description,
          status,
          start_date: startDate || null,
          end_date: endDate || null,
          icon,
          accent_color: accentColor,
          owner_id: ownerId || null,
          default_view: defaultView,
        },
      });
      await onSaved();
      onClose();
    } catch (err: any) {
      setGeneralError(err.message || "Unable to save project settings.");
    } finally {
      setSavingGeneral(false);
    }
  }

  async function handleAddStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !newStatusName.trim()) return;
    setAddingStatus(true);
    setWorkflowError(null);
    try {
      await api(`/api/projects/${project.id}/statuses`, {
        method: "POST",
        json: {
          name: newStatusName.trim(),
          color: newStatusColor,
          is_done: newStatusIsDone,
        },
      });
      setNewStatusName("");
      setNewStatusColor("#64748B");
      setNewStatusIsDone(false);
      await loadStatuses();
      await onSaved();
    } catch (err: any) {
      setWorkflowError(err.message || "Failed to add status");
    } finally {
      setAddingStatus(false);
    }
  }

  async function moveStatus(index: number, direction: "up" | "down") {
    if (!project) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= statuses.length) return;

    const copy = [...statuses];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    setStatuses(copy);

    try {
      await api(`/api/projects/${project.id}/statuses`, {
        method: "PUT",
        json: { statuses: copy },
      });
      await onSaved();
    } catch (err: any) {
      setWorkflowError(err.message || "Failed to reorder statuses");
      await loadStatuses();
    }
  }

  async function deleteStatus(statusId: string) {
    if (!project) return;
    if (statuses.length <= 1) {
      alert("A project must have at least one workflow status.");
      return;
    }
    if (!confirm("Delete this status? Tasks in this status will be moved to the first available status.")) return;

    try {
      await api(`/api/projects/${project.id}/statuses/${statusId}`, { method: "DELETE" });
      await loadStatuses();
      await onSaved();
    } catch (err: any) {
      setWorkflowError(err.message || "Failed to delete status");
    }
  }

  async function updateMemberRole(memberId: string, role: string) {
    if (!project) return;
    setUpdatingMemberId(memberId);
    try {
      await api(`/api/projects/${project.id}/members/${memberId}`, {
        method: "PATCH",
        json: { role },
      });
      await loadMembers();
      await onSaved();
    } catch (err: any) {
      alert(err.message || "Failed to update role");
    } finally {
      setUpdatingMemberId(null);
    }
  }

  async function removeMember(memberId: string) {
    if (!project) return;
    if (!confirm("Remove this member from the project?")) return;
    try {
      await api(`/api/projects/${project.id}/members/${memberId}`, { method: "DELETE" });
      await loadMembers();
      await onSaved();
    } catch (err: any) {
      alert(err.message || "Failed to remove member");
    }
  }

  async function addRegisteredMember(u: UserPublic) {
    if (!project) return;
    try {
      await api(`/api/projects/${project.id}/members`, {
        method: "POST",
        json: { user_id: u.id, role: "member" },
      });
      setMemberQuery("");
      setSearchResults([]);
      await loadMembers();
      await onSaved();
    } catch (err: any) {
      alert(err.message || "Failed to add member");
    }
  }

  async function addDataMember(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !mName.trim()) return;
    setAddingDataMember(true);
    try {
      await api(`/api/projects/${project.id}/members/manual`, {
        method: "POST",
        json: { name: mName.trim(), title: mTitle.trim(), role: mRole },
      });
      setMName("");
      setMTitle("");
      setMRole("member");
      await loadMembers();
      await onSaved();
    } catch (err: any) {
      alert(err.message || "Failed to add data member");
    } finally {
      setAddingDataMember(false);
    }
  }

  async function toggleArchive() {
    if (!project) return;
    setIsArchiving(true);
    const newStatus = project.status === "archived" ? "active" : "archived";
    try {
      await api(`/api/projects/${project.id}`, {
        method: "PATCH",
        json: {
          status: newStatus,
          archived_at: newStatus === "archived" ? new Date().toISOString() : null,
        },
      });
      await onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to change project archive state");
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleDeleteProject() {
    if (!project) return;
    const confirmed = prompt(`Type "${project.name}" to permanently delete this project:`);
    if (confirmed !== project.name) {
      if (confirmed !== null) alert("Project name did not match. Deletion cancelled.");
      return;
    }

    setIsDeleting(true);
    try {
      await api(`/api/projects/${project.id}`, { method: "DELETE" });
      onClose();
      onDeleted?.();
    } catch (err: any) {
      alert(err.message || "Failed to delete project");
      setIsDeleting(false);
    }
  }

  if (!project) return null;

  return (
    <Modal open={open} onClose={onClose} title="Project Settings" width="max-w-3xl">
      <div className="flex border-b border-line -mt-1 mb-5">
        <button
          type="button"
          onClick={() => setTab("general")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "general" ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          General
        </button>
        <button
          type="button"
          onClick={() => setTab("workflow")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "workflow" ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Workflow ({statuses.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("members")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "members" ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Members ({memberList.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("danger")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "danger" ? "border-danger text-danger font-semibold" : "border-transparent text-muted hover:text-danger"
          }`}
        >
          Danger Zone
        </button>
      </div>

      {/* TAB 1: GENERAL */}
      {tab === "general" && (
        <form onSubmit={saveGeneral} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="label">Project name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Apollo Design System"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Description</label>
              <textarea
                className="input min-h-[75px] resize-y"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project about?"
              />
            </div>

            <div>
              <label className="label">Status</label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="done">Done</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="label">Project Owner</label>
              <select className="input" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">No owner designated</option>
                {memberList.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user?.name || m.user?.username || m.user_id} {m.user?.title ? `(${m.user.title})` : ""}
                  </option>
                ))}
              </select>
            </div>

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
              <label className="label">End date</label>
              <input
                type="date"
                className="input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
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
              <label className="label">Accent color</label>
              <div className="flex flex-wrap items-center gap-2">
                {ACCENTS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAccentColor(color)}
                    className={`h-7 w-7 rounded-md border-2 transition ${
                      accentColor === color ? "border-ink scale-110 shadow-sm" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select accent color ${color}`}
                  />
                ))}
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded-md border border-line bg-transparent p-0"
                  title="Custom color"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="label">Icon / Emoji</label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setIcon(item.key)}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border text-lg transition ${
                      icon === item.key
                        ? "border-ink bg-subtle scale-105 shadow-sm"
                        : "border-line bg-white hover:bg-subtle text-muted"
                    }`}
                    title={item.label}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {generalError && <p className="text-sm text-danger">{generalError}</p>}

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <button type="button" onClick={onClose} className="btn">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={savingGeneral}>
              {savingGeneral ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: WORKFLOW */}
      {tab === "workflow" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-ink">Project Workflow Statuses</h3>
            <p className="text-xs text-muted mt-0.5">
              Customize the columns in your Kanban board and task lifecycle for this project.
            </p>
          </div>

          {workflowError && <p className="text-sm text-danger">{workflowError}</p>}

          {loadingStatuses ? (
            <p className="text-sm text-muted">Loading workflow statuses…</p>
          ) : (
            <div className="space-y-2">
              {statuses.map((s, idx) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-line bg-white hover:border-line"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="h-4 w-4 rounded-full flex-none"
                      style={{ backgroundColor: s.color || "#94A3B8" }}
                    />
                    <div>
                      <p className="text-sm font-medium text-ink flex items-center gap-2">
                        {s.name}
                        {s.is_done && (
                          <span className="rounded bg-emerald-100 text-emerald-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                            Done Status
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted font-mono">key: {s.key}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-none">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveStatus(idx, "up")}
                      className="p-1 rounded text-muted hover:text-ink disabled:opacity-30 disabled:hover:text-muted"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === statuses.length - 1}
                      onClick={() => moveStatus(idx, "down")}
                      className="p-1 rounded text-muted hover:text-ink disabled:opacity-30 disabled:hover:text-muted"
                      title="Move down"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteStatus(s.id)}
                      className="ml-2 text-xs text-danger hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Status Form */}
          <form onSubmit={handleAddStatus} className="card p-4 bg-subtle/50 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Add New Status</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="label">Status Name</label>
                <input
                  className="input"
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  placeholder="e.g. QA Testing, Ready for Deploy"
                  required
                />
              </div>
              <div>
                <label className="label">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newStatusColor}
                    onChange={(e) => setNewStatusColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-line p-1 bg-white"
                  />
                  <input
                    className="input font-mono uppercase text-xs"
                    value={newStatusColor}
                    onChange={(e) => setNewStatusColor(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_done_checkbox"
                checked={newStatusIsDone}
                onChange={(e) => setNewStatusIsDone(e.target.checked)}
                className="h-4 w-4 rounded border-line text-accent"
              />
              <label htmlFor="is_done_checkbox" className="text-xs text-ink cursor-pointer">
                Treat tasks in this status as completed (100% done)
              </label>
            </div>
            <div className="flex justify-end pt-1">
              <button className="btn-primary text-xs" disabled={addingStatus}>
                {addingStatus ? "Adding…" : "+ Add Status Column"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: MEMBERS */}
      {tab === "members" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-ink">Project Collaborators & Roles</h3>
            <p className="text-xs text-muted mt-0.5">
              Control member permissions and task assignment availability.
            </p>
          </div>

          <div className="divide-y divide-line rounded-lg border border-line bg-white">
            {memberList.map((m) => {
              const workload = m.workload ?? { total: 0, in_progress: 0, done: 0 };
              const isOwner = project.owner_id === m.user_id || m.role === "owner";
              return (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5 hover:bg-subtle/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
                      {(m.user?.name || m.user?.username || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink flex items-center gap-1.5">
                        {m.user?.name || m.user?.username}
                        {isOwner && (
                          <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.2 text-[10px] font-bold">
                            Owner
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {m.user?.title || "Team Member"} · {workload.total} assigned ({workload.in_progress} active, {workload.done} done)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                      className="input py-1 text-xs w-auto font-medium"
                      value={m.role}
                      disabled={updatingMemberId === m.id}
                      onChange={(e) => updateMemberRole(m.id, e.target.value)}
                    >
                      <option value="owner">Owner (Full control)</option>
                      <option value="admin">Admin (Manage project)</option>
                      <option value="member">Member (Can edit tasks)</option>
                      <option value="viewer">Viewer (Read-only)</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => removeMember(m.id)}
                      className="text-xs text-muted hover:text-danger px-1"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add registered member */}
          <div className="card p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Invite Registered User</h4>
            <input
              className="input"
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="Search user by name or @username…"
            />
            {searching && <p className="text-xs text-muted">Searching…</p>}
            {searchResults.length > 0 && (
              <div className="divide-y divide-line rounded-md border border-line">
                {searchResults.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-2 hover:bg-subtle">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{u.name || u.username}</p>
                      <p className="text-xs text-muted">@{u.username} {u.title ? `· ${u.title}` : ""}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addRegisteredMember(u)}
                      className="btn text-xs py-1"
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add data member */}
          <form onSubmit={addDataMember} className="card p-4 space-y-3">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Add Data Member</h4>
              <p className="text-xs text-muted mt-0.5">
                For external contractors or offline teammates so tasks can still be assigned to them.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="label">Name</label>
                <input
                  className="input"
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  placeholder="e.g. Sarah Connor"
                  required
                />
              </div>
              <div>
                <label className="label">Title / Role</label>
                <input
                  className="input"
                  value={mTitle}
                  onChange={(e) => setMTitle(e.target.value)}
                  placeholder="e.g. Security Auditor"
                />
              </div>
              <div>
                <label className="label">Access Level</label>
                <select
                  className="input"
                  value={mRole}
                  onChange={(e) => setMRole(e.target.value as ProjectMemberRole)}
                >
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button className="btn-primary text-xs" disabled={addingDataMember}>
                {addingDataMember ? "Adding…" : "+ Add Data Member"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: DANGER ZONE */}
      {tab === "danger" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-danger">Danger Zone</h3>
            <p className="text-xs text-muted mt-0.5">
              Destructive actions for this project. Please proceed with caution.
            </p>
          </div>

          {/* Archive / Restore */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-line bg-subtle/40">
            <div>
              <p className="text-sm font-semibold text-ink">
                {project.status === "archived" ? "Restore project" : "Archive project"}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {project.status === "archived"
                  ? "Re-activate this project and make tasks visible in active project boards."
                  : "Mark this project as archived. Tasks will be hidden from default views but preserved."}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleArchive}
              disabled={isArchiving}
              className="btn flex-none"
            >
              {isArchiving
                ? "Updating…"
                : project.status === "archived"
                ? "Restore Project"
                : "Archive Project"}
            </button>
          </div>

          {/* Delete Project */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-rose-200 bg-rose-50/50">
            <div>
              <p className="text-sm font-semibold text-danger">Delete project permanently</p>
              <p className="text-xs text-muted mt-0.5">
                Once deleted, all tasks, subtasks, statuses, and comments in this project will be permanently erased.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="btn-danger flex-none"
            >
              {isDeleting ? "Deleting…" : "Delete Project"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
