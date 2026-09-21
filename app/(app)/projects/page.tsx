"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import { ProjectStatusBadge } from "@/components/Badges";
import { api, fmtDate } from "@/lib/api";
import type { Project } from "@/types";

type Row = Project & { stats: { total: number; done: number; overdue: number; progressTotal?: number }; calculated_percent_complete?: number };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSaving, setImportSaving] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { const data = await api<{ projects: Row[] }>("/api/projects"); setProjects(data.projects ?? []); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    try { await api("/api/projects", { method: "POST", json: { name, description, start_date: startDate || null, end_date: endDate || null } }); setName(""); setDescription(""); setStartDate(""); setEndDate(""); setOpen(false); await load(); }
    catch (err: any) { setError(err.message); } finally { setSaving(false); }
  }

  async function importProjects(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile) { setImportError("Please choose a CSV or Excel file."); return; }
    setImportSaving(true); setImportError(null);
    try {
      const form = new FormData(); form.append("file", importFile);
      const result = await api<{ imported: number }>("/api/projects/import", { method: "POST", body: form });
      setImportFile(null); setImportOpen(false); window.alert(`${result.imported} project${result.imported === 1 ? "" : "s"} imported.`); await load();
    } catch (err: any) { setImportError(err.message); } finally { setImportSaving(false); }
  }

  async function deleteProject(project: Row) {
    if (!confirm(`Delete “${project.name}” and all of its tasks? This cannot be undone.`)) return;
    try { await api(`/api/projects/${project.id}`, { method: "DELETE" }); setProjects((current) => current.filter((item) => item.id !== project.id)); }
    catch (err: any) { window.alert(err.message || "Unable to delete project."); }
  }

  const shown = filter === "all" ? projects : projects.filter((p) => p.status === filter);
  return <>
    <PageHeader title="Projects" subtitle="Everything on hand, in one place." actions={<div className="flex gap-2"><button onClick={() => { setImportError(null); setImportOpen(true); }} className="btn">Import projects</button><button onClick={() => setOpen(true)} className="btn-primary">New project</button></div>} />
    <div className="px-8 py-6">
      <div className="mb-4 flex gap-1">{["all", "active", "on_hold", "done", "archived"].map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${filter === f ? "bg-ink text-white" : "text-muted hover:bg-subtle"}`}>{f.replace("_", " ")}</button>)}</div>
      {loading && <p className="text-sm text-muted">Loading…</p>}
      {!loading && shown.length === 0 && <div className="card px-4 py-16 text-center"><p className="text-sm text-muted">No projects here yet.</p><button onClick={() => setOpen(true)} className="btn mt-3">Create your first project</button></div>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{shown.map((p) => {
        const pct = p.calculated_percent_complete ?? p.percent_complete ?? (p.stats.total ? Math.round((p.stats.done / p.stats.total) * 100) : 0);
        return <div key={p.id} className="card p-4 transition hover:shadow-pop">
          <Link href={`/projects/${p.id}`} className="block"><div className="mb-1.5 flex items-start justify-between gap-2"><p className="truncate font-medium text-ink">{p.name}</p><ProjectStatusBadge status={p.status} /></div><p className="mb-3 line-clamp-2 min-h-[32px] text-xs text-muted">{p.description || "No description"}</p><div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} /></div><div className="flex items-center justify-between text-xs text-muted"><span>{p.stats.done}/{p.stats.total} done ({pct}%)</span>{p.stats.overdue > 0 ? <span className="font-medium text-danger">{p.stats.overdue} overdue</span> : <span>{fmtDate(p.end_date)}</span>}</div></Link>
          <div className="mt-3 flex justify-end"><button onClick={() => deleteProject(p)} className="btn-danger px-2 py-1 text-xs">Delete project</button></div>
        </div>;
      })}</div>
    </div>
    <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import projects"><form onSubmit={importProjects} className="space-y-3"><p className="text-sm text-muted">Import up to 500 new projects. Required column: <strong>name</strong>. Optional columns: description, status, start_date, end_date.</p><p className="rounded-md bg-subtle p-3 font-mono text-xs text-muted">name,description,status,start_date,end_date<br />Website redesign,Refresh website,active,2026-10-01,2026-12-31</p><input type="file" accept=".csv,.xlsx,.xls,text/csv" className="input" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} required />{importError && <p className="text-sm text-danger">{importError}</p>}<div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setImportOpen(false)} className="btn">Cancel</button><button className="btn-primary" disabled={importSaving}>{importSaving ? "Importing…" : "Import projects"}</button></div></form></Modal>
    <Modal open={open} onClose={() => setOpen(false)} title="New project"><form onSubmit={create} className="space-y-3"><div><label className="label">Project name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus required /></div><div><label className="label">Description</label><textarea className="input min-h-[72px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} /></div><div className="grid grid-cols-2 gap-3"><div><label className="label">Start date</label><input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div><div><label className="label">End date</label><input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div></div>{error && <p className="text-sm text-danger">{error}</p>}<div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setOpen(false)} className="btn">Cancel</button><button className="btn-primary" disabled={saving}>{saving ? "Creating…" : "Create project"}</button></div></form></Modal>
  </>;
}
