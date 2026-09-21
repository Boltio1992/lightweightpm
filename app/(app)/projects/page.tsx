"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import { ProjectStatusBadge } from "@/components/Badges";
import { api, fmtDate } from "@/lib/api";
import type { Project } from "@/types";

type Row = Project & { stats: { total: number; done: number; overdue: number } };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const data = await api<{ projects: Row[] }>("/api/projects");
    setProjects(data.projects ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api("/api/projects", {
        method: "POST",
        json: {
          name,
          description,
          start_date: startDate || null,
          end_date: endDate || null,
        },
      });
      setName("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const shown = filter === "all" ? projects : projects.filter((p) => p.status === filter);

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Everything on hand, in one place."
        actions={
          <button onClick={() => setOpen(true)} className="btn-primary">
            New project
          </button>
        }
      />

      <div className="px-8 py-6">
        <div className="mb-4 flex gap-1">
          {["all", "active", "on_hold", "done", "archived"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                filter === f ? "bg-ink text-white" : "text-muted hover:bg-subtle"
              }`}
            >
              {f.replace("_", " ")}
            </button>
          ))}
        </div>

        {loading && <p className="text-sm text-muted">Loading…</p>}

        {!loading && shown.length === 0 && (
          <div className="card px-4 py-16 text-center">
            <p className="text-sm text-muted">No projects here yet.</p>
            <button onClick={() => setOpen(true)} className="btn mt-3">
              Create your first project
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => {
            const pct = p.stats.total ? Math.round((p.stats.done / p.stats.total) * 100) : 0;
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="card block p-4 transition hover:shadow-pop">
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <p className="truncate font-medium text-ink">{p.name}</p>
                  <ProjectStatusBadge status={p.status} />
                </div>
                <p className="mb-3 line-clamp-2 min-h-[32px] text-xs text-muted">
                  {p.description || "No description"}
                </p>
                <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-subtle">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>
                    {p.stats.done}/{p.stats.total} done ({pct}%)
                  </span>
                  {p.stats.overdue > 0 ? (
                    <span className="font-medium text-danger">{p.stats.overdue} overdue</span>
                  ) : (
                    <span>{fmtDate(p.end_date)}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New project">
        <form onSubmit={create} className="space-y-3">
          <div>
            <label className="label">Project name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              <label className="label">End date</label>
              <input
                type="date"
                className="input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="btn">
              Cancel
            </button>
            <button className="btn-primary" disabled={saving}>
              {saving ? "Creating…" : "Create project"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
