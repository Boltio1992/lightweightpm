"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";

type Breakdown = Record<string, { name: string; total: number; done: number; overdue: number }>;

type Report = {
  summary: {
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
  perProject: Breakdown;
  perAssignee: Breakdown;
};

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone ?? "text-ink"}`}>{value}</p>
    </div>
  );
}

function BreakdownTable({ title, rows }: { title: string; rows: Breakdown }) {
  const entries = Object.entries(rows).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line bg-subtle px-4 py-2 text-xs font-medium text-muted">{title}</div>
      {entries.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">No data yet.</p>}
      {entries.map(([id, r]) => {
        const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
        const sla = r.total ? Math.round(((r.total - r.overdue) / r.total) * 100) : 100;
        return (
          <div key={id} className="border-b border-line px-4 py-3 last:border-0">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="truncate text-sm text-ink">{r.name}</span>
              <span className="flex-none text-xs text-muted">
                {r.done}/{r.total} done
                {r.overdue > 0 && <span className="ml-2 font-medium text-danger">{r.overdue} overdue</span>}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle">
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
              <span
                className={`w-20 flex-none text-right text-xs ${
                  sla >= 90 ? "text-good" : sla >= 70 ? "text-warn" : "text-danger"
                }`}
              >
                SLA {sla}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    api<Report>("/api/reports").then(setReport);
  }, []);

  if (!report) return <div className="px-8 py-8 text-sm text-muted">Loading…</div>;

  const s = report.summary;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Summary across all projects and standalone tasks."
      />
      <div className="space-y-6 px-8 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Projects" value={s.totalProjects} />
          <Stat label="Total tasks" value={s.totalTasks} />
          <Stat label="Completed" value={s.doneTasks} tone="text-good" />
          <Stat label="Overdue" value={s.overdue} tone="text-danger" />
          <Stat label="Due within 3 days" value={s.dueSoon} tone="text-warn" />
          <Stat
            label="SLA compliance"
            value={`${s.slaCompliance}%`}
            tone={s.slaCompliance >= 90 ? "text-good" : s.slaCompliance >= 70 ? "text-warn" : "text-danger"}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Project tasks" value={s.projectTaskCount} />
          <Stat label="Standalone tasks" value={s.standaloneTaskCount} />
          <Stat label="Sub-tasks" value={s.subtaskCount} />
          <Stat label="Blocked" value={s.byStatus.blocked ?? 0} tone="text-danger" />
        </div>

        <div className="card p-5">
          <p className="mb-3 text-sm font-medium text-ink">Status distribution</p>
          <div className="flex h-3 overflow-hidden rounded-full bg-subtle">
            {(["done", "in_progress", "blocked", "todo"] as const).map((key) => {
              const count = s.byStatus[key] ?? 0;
              const pct = s.totalTasks ? (count / s.totalTasks) * 100 : 0;
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
            <span>To Do: {s.byStatus.todo ?? 0}</span>
            <span>In Progress: {s.byStatus.in_progress ?? 0}</span>
            <span>Blocked: {s.byStatus.blocked ?? 0}</span>
            <span>Done: {s.byStatus.done ?? 0}</span>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <BreakdownTable title="By project" rows={report.perProject} />
          <BreakdownTable title="By assignee" rows={report.perAssignee} />
        </div>
      </div>
    </>
  );
}
