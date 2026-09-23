"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import { api } from "@/lib/api";

const ICONS = ["folder", "rocket", "chart", "sparkles", "briefcase", "calendar"];
const ACCENTS = ["#12A594", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#10B981"];

export default function ProjectSettingsModal({
  open,
  project,
  onClose,
  onSaved,
}: {
  open: boolean;
  project: {
    id: string;
    name: string;
    description?: string | null;
    status: string;
    start_date?: string | null;
    end_date?: string | null;
    accent_color?: string | null;
    icon?: string | null;
    default_view?: string | null;
  } | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [icon, setIcon] = useState("folder");
  const [accentColor, setAccentColor] = useState("#12A594");
  const [defaultView, setDefaultView] = useState("kanban");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project || !open) return;
    setName(project.name ?? "");
    setDescription(project.description ?? "");
    setStatus(project.status ?? "active");
    setStartDate(project.start_date ?? "");
    setEndDate(project.end_date ?? "");
    setIcon(project.icon ?? "folder");
    setAccentColor(project.accent_color ?? "#12A594");
    setDefaultView(project.default_view ?? "kanban");
    setError(null);
  }, [project, open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    setSaving(true);
    setError(null);

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
          default_view: defaultView,
        },
      });
      await onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Unable to save project settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Project settings" width="max-w-2xl">
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label">Project name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="md:col-span-2">
            <label className="label">Description</label>
            <textarea className="input min-h-[80px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} />
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
            <label className="label">Default view</label>
            <select className="input" value={defaultView} onChange={(e) => setDefaultView(e.target.value)}>
              <option value="kanban">Kanban</option>
              <option value="list">List</option>
              <option value="timeline">Timeline</option>
              <option value="members">Members</option>
            </select>
          </div>

          <div>
            <label className="label">Start date</label>
            <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div>
            <label className="label">End date</label>
            <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          <div>
            <label className="label">Icon</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setIcon(item)}
                  className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm ${icon === item ? "border-ink bg-subtle text-ink" : "border-line text-muted"}`}
                  aria-label={`Set icon ${item}`}
                >
                  {item === "folder" && "📁"}
                  {item === "rocket" && "🚀"}
                  {item === "chart" && "📊"}
                  {item === "sparkles" && "✨"}
                  {item === "briefcase" && "💼"}
                  {item === "calendar" && "📅"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Accent color</label>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAccentColor(color)}
                  className={`h-8 w-8 rounded-md border-2 ${accentColor === color ? "border-ink" : "border-transparent"}`}
                  style={{ backgroundColor: color }}
                  aria-label={`Set accent color ${color}`}
                />
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn">Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </Modal>
  );
}
