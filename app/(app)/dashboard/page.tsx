"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { ProjectStatusBadge } from "@/components/Badges";

type Summary = {
  totalProjects: number;
  totalTasks: number;
  projectTaskCount: number;
  standaloneTaskCount: number;
  subtaskCount: number;
  doneTasks: number;
  overdue: number;
  dueSoon: number;
  slaCompliance: number;
  byStatus: Record<string, number>;
};

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  stats: { total: number; done: number; overdue: number };
};

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone ?? "text-ink"}`}>{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => setSummary(d.summary));
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects((d.projects ?? []).slice(0, 6)));
  }, []);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="A quick look at everything in flight." />
      <div className="space-y-8 px-8 py-6">
        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Projects" value={summary.totalProjects} />
            <Stat label="Total tasks" value={summary.totalTasks} />
            <Stat label="Completed" value={summary.doneTasks} tone="text-good" />
            <Stat label="Overdue (SLA)" value={summary.overdue} tone="text-danger" />
            <Stat label="Due soon" value={summary.dueSoon} tone="text-warn" />
            <Stat label="SLA compliance" value={`${summary.slaCompliance}%`} tone="text-accent" />
          </div>
        )}

        {summary && (
          <div className="card p-5">
            <p className="mb-3 text-sm font-medium text-ink">Task breakdown</p>
            <div className="flex h-3 overflow-hidden rounded-full bg-subtle">
              {(["done", "in_progress", "blocked", "todo"] as const).map((key) => {
                const count = summary.byStatus[key] ?? 0;
                const pct = summary.totalTasks ? (count / summary.totalTasks) * 100 : 0;
                const color =
                  key === "done"
                    ? "bg-good"
                    : key === "in_progress"
                    ? "bg-accent"
                    : key === "blocked"
                    ? "bg-danger"
                    : "bg-gray-300";
                return <div key={key} className={color} style={{ width: `${pct}%` }} />;
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
              <span>To Do: {summary.byStatus.todo ?? 0}</span>
              <span>In Progress: {summary.byStatus.in_progress ?? 0}</span>
              <span>Blocked: {summary.byStatus.blocked ?? 0}</span>
              <span>Done: {summary.byStatus.done ?? 0}</span>
              <span className="ml-auto">Project tasks: {summary.projectTaskCount}</span>
              <span>Standalone tasks: {summary.standaloneTaskCount}</span>
              <span>Sub-tasks: {summary.subtaskCount}</span>
            </div>
          </div>
        )}

        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-ink">Recent projects</p>
            <Link href="/projects" className="text-sm text-accent hover:underline">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="card block p-4 hover:shadow-pop">
                <div className="mb-2 flex items-center justify-between">
                  <p className="truncate font-medium text-ink">{p.name}</p>
                  <ProjectStatusBadge status={p.status} />
                </div>
                <p className="text-xs text-muted">
                  {p.stats.done}/{p.stats.total} tasks done
                  {p.stats.overdue > 0 && <span className="text-danger"> · {p.stats.overdue} overdue</span>}
                </p>
              </Link>
            ))}
            {projects.length === 0 && (
              <p className="text-sm text-muted">No projects yet. Create your first one from the Projects tab.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
