"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { ProjectStatusBadge } from "@/components/Badges";

type Summary = {
  totalProjects: number;
  totalTasks: number;
  doneTasks: number;
  overdue: number;
  dueSoon: number;
  unscheduled: number;
  byStatus: Record<string, number>;
};

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  stats: { total: number; done: number; overdue: number };
};

type Breakdown = Record<string, { name: string; total: number; done: number; overdue: number }>;

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone ?? "text-ink"}`}>{value}</p>
    </div>
  );
}

function BreakdownTable({
  title,
  rows,
  linkBase,
}: {
  title: string;
  rows: Breakdown;
  linkBase?: string;
}) {
  const entries = Object.entries(rows).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line bg-subtle px-4 py-2 text-xs font-medium text-muted">{title}</div>
      {entries.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">No data yet.</p>}
      {entries.map(([id, row]) => {
        const pct = row.total ? Math.round((row.done / row.total) * 100) : 0;
        const name = linkBase ? (
          <Link href={`${linkBase}/${id}`} className="truncate text-sm text-ink hover:underline">
            {row.name}
          </Link>
        ) : (
          <span className="truncate text-sm text-ink">{row.name}</span>
        );

        return (
          <div key={id} className="border-b border-line px-4 py-3 last:border-0">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              {name}
              <span className="flex-none text-xs text-muted">
                {row.done}/{row.total} done
                {row.overdue > 0 && <span className="ml-2 font-medium text-danger">{row.overdue} overdue</span>}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [perProject, setPerProject] = useState<Breakdown>({});
  const [perAssignee, setPerAssignee] = useState<Breakdown>({});

  useEffect(() => {
    let active = true;

    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setSummary(d.summary ?? null);
        setProjects((d.projects ?? []).slice(0, 6));
        setPerProject(d.perProject ?? {});
        setPerAssignee(d.perAssignee ?? {});
      })
      .catch(() => {
        if (!active) return;
        setSummary(null);
        setProjects([]);
        setPerProject({});
        setPerAssignee({});
      });

    return () => {
      active = false;
    };
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
            <Stat label="Overdue" value={summary.overdue} tone="text-danger" />
            <Stat label="Due soon" value={summary.dueSoon} tone="text-warn" />
            <Stat label="Unscheduled" value={summary.unscheduled} />
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
            {projects.length === 0 && !summary && (
              <p className="text-sm text-muted">Loading dashboard…</p>
            )}
            {projects.length === 0 && summary && (
              <p className="text-sm text-muted">No projects yet. Create your first one from the Projects tab.</p>
            )}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <BreakdownTable title="By project" rows={perProject} linkBase="/projects" />
          <BreakdownTable title="By assignee" rows={perAssignee} />
        </div>
      </div>
    </>
  );
}
