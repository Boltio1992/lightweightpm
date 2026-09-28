"use client";

import Link from "next/link";
import { useState } from "react";
import { ProjectStatusBadge } from "@/components/Badges";
import { countdownLabel, initials } from "@/lib/format";
import type { AttentionItem, AttentionReason, DashboardData, ProjectHealth } from "@/lib/dashboard";
import type { TaskPriority } from "@/types";

const REASON_CHIP: Record<AttentionReason, { label: string; chip: string }> = {
  overdue: { label: "Overdue", chip: "bg-dangerSoft text-danger" },
  blocked: { label: "Blocked", chip: "bg-dangerSoft text-danger" },
  due_soon: { label: "Due soon", chip: "bg-warnSoft text-warn" },
  unassigned: { label: "Unassigned", chip: "bg-subtle text-ink" },
};

const HEALTH_CHIP: Record<ProjectHealth["health"], { label: string; chip: string }> = {
  on_track: { label: "On track", chip: "bg-goodSoft text-good" },
  at_risk: { label: "At risk", chip: "bg-warnSoft text-warn" },
  off_track: { label: "Off track", chip: "bg-dangerSoft text-danger" },
  unknown: { label: "No dates", chip: "bg-subtle text-ink" },
  done: { label: "Closed", chip: "bg-subtle text-ink" },
};

const PRIORITY_MARK: Record<TaskPriority | string, string> = {
  urgent: "‼",
  high: "!",
  medium: "·",
  low: "·",
};

/** Attention list is paginated so the dashboard never grows into a wall of rows. */
const ATTENTION_PAGE_SIZE = 10;

function Metric({
  label,
  value,
  hint,
  tone = "text-ink",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="metric">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function SectionHeader({ title, hint, href, linkLabel }: { title: string; hint?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {hint && <p className="truncate text-xs text-muted">{hint}</p>}
      </div>
      {href && (
        <Link href={href} className="flex-none text-xs font-medium text-accent hover:underline">
          {linkLabel ?? "View all"}
        </Link>
      )}
    </div>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const reason = REASON_CHIP[item.reason];
  const meta =
    item.reason === "overdue"
      ? { text: `${item.daysLate}d late`, tone: "font-medium text-danger" }
      : item.reason === "due_soon"
      ? { text: `in ${item.daysLeft}d`, tone: "font-medium text-warn" }
      : item.reason === "blocked"
      ? { text: item.ageDays !== null ? `blocked ${item.ageDays}d` : "blocked", tone: "text-muted" }
      : { text: item.ageDays !== null ? `open ${item.ageDays}d` : "no owner", tone: "text-muted" };

  return (
    <li className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
      <span className={`chip ${reason.chip} w-[86px] flex-none justify-center`}>{reason.label}</span>
      <span className="w-3 flex-none text-center text-xs text-muted" aria-hidden="true">
        {PRIORITY_MARK[item.priority] ?? "·"}
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href={item.projectId ? `/projects/${item.projectId}` : "/tasks"}
          className="block truncate text-sm font-medium text-ink hover:underline"
        >
          {item.title}
        </Link>
        <p className="truncate text-xs text-muted">
          {item.projectName} · {item.assigneeName ?? "Unassigned"}
        </p>
      </div>
      <span className={`flex-none text-xs ${meta.tone}`}>{meta.text}</span>
    </li>
  );
}

export default function DashboardView({ data, todayLabel }: { data: DashboardData; todayLabel: string }) {
  const { summary, attention, health, workload, trend } = data;

  const attentionTotal = attention.items.length;
  const attentionPages = Math.max(1, Math.ceil(attentionTotal / ATTENTION_PAGE_SIZE));
  const [attentionPage, setAttentionPage] = useState(0);
  // Clamped while rendering so a shrinking list can never strand us on a blank page.
  const page = Math.min(attentionPage, attentionPages - 1);
  const pageStart = page * ATTENTION_PAGE_SIZE;
  const pageItems = attention.items.slice(pageStart, pageStart + ATTENTION_PAGE_SIZE);

  const maxOpen = Math.max(1, ...workload.map((w) => w.open));
  const maxTrend = Math.max(1, ...trend.map((t) => t.count));
  const trendDelta = summary.completedLast7 - summary.completedPrev7;

  return (
    <>
      <div className="page-x border-b border-line bg-white py-4 sm:py-5">
        <h1 className="text-xl font-bold text-ink">Dashboard</h1>
        <p className="mt-0.5 text-sm text-muted">
          {todayLabel} · {summary.activeProjects} active project{summary.activeProjects === 1 ? "" : "s"},{" "}
          {summary.openTasks} open tasks
        </p>
      </div>

      <div className="page-x space-y-4 py-5 sm:space-y-5 sm:py-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric label="Open tasks" value={summary.openTasks} hint={`${summary.totalTasks} total`} />
          <Metric
            label="Completed · 7 days"
            value={summary.completedLast7}
            hint={
              trendDelta === 0
                ? "Same as the week before"
                : `${trendDelta > 0 ? "+" : "−"}${Math.abs(trendDelta)} vs previous week`
            }
          />
          <Metric
            label="Overdue"
            value={summary.overdue}
            tone={summary.overdue > 0 ? "text-danger" : "text-ink"}
            hint={summary.overdue > 0 ? "Past their due date" : "Nothing past due"}
          />
          <Metric
            label="Blocked"
            value={summary.blocked}
            tone={summary.blocked > 0 ? "text-danger" : "text-ink"}
            hint={summary.dueSoon > 0 ? `${summary.dueSoon} due within 3 days` : "None due soon"}
          />
          <Metric
            label="Unassigned"
            value={summary.unassigned}
            hint={summary.unscheduled > 0 ? `${summary.unscheduled} without a date` : "Every task has a date"}
          />
        </div>

        {/* Project health */}
        <section className="card overflow-hidden">
          <SectionHeader
            title="Project health"
            hint="Actual progress against what the calendar expects"
            href="/projects"
            linkLabel="All projects"
          />
          {health.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No projects yet — create one to see it here.</p>
          ) : (
            <>
              <div className="health-grid border-b border-line bg-subtle px-4 py-2 text-xs font-medium text-muted">
                <span>Project</span>
                <span className="hidden lg:block">Status</span>
                <span>Health</span>
                <span>Progress</span>
                <span>Tasks</span>
                <span>Deadline</span>
              </div>
              {health.map((p) => {
                const chip = HEALTH_CHIP[p.health];
                const expected = p.expectedPercent;
                return (
                  <div key={p.id} className="health-grid border-b border-line px-4 py-2.5 last:border-0">
                    <Link href={`/projects/${p.id}`} className="truncate text-sm font-medium text-ink hover:underline">
                      {p.name}
                    </Link>
                    <span className="hidden lg:block">
                      <ProjectStatusBadge status={p.status} />
                    </span>
                    <span className={`chip ${chip.chip} justify-center`}>{chip.label}</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="relative h-1.5 min-w-0 flex-1 overflow-visible rounded-full bg-subtle"
                        title={
                          expected === null
                            ? `${p.percent}% done`
                            : `${p.percent}% done · ${expected}% expected by today`
                        }
                      >
                        <div
                          className={`h-full rounded-full ${p.percent >= 100 ? "bg-good" : "bg-accent"}`}
                          style={{ width: `${p.percent}%` }}
                        />
                        {expected !== null && (
                          <span
                            aria-hidden="true"
                            className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-ink/70"
                            style={{ left: `${expected}%` }}
                          />
                        )}
                      </div>
                      <span className="w-9 flex-none text-right text-xs font-medium text-ink">{p.percent}%</span>
                    </div>
                    <span className="text-xs text-muted">
                      {p.done}/{p.total}
                      {p.overdue > 0 && <span className="ml-1 font-medium text-danger">· {p.overdue} late</span>}
                    </span>
                    <span className="truncate text-xs text-muted">
                      {countdownLabel(p.endDate, p.status) ?? "No deadline"}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Workload */}
          <section className="card overflow-hidden">
            <SectionHeader title="Workload" hint="Open tasks per person" />
            {workload.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">No tasks assigned yet.</p>
            ) : (
              <ul>
                {workload.map((row) => {
                  const overdueWidth = (row.overdue / maxOpen) * 100;
                  const inProgressWidth = (row.inProgress / maxOpen) * 100;
                  return (
                    <li key={row.id} className="border-b border-line px-4 py-2.5 last:border-0">
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="avatar">{initials(row.id === "unassigned" ? "?" : row.name)}</span>
                          <span className="truncate text-sm text-ink">{row.name}</span>
                        </span>
                        <span className="flex-none text-xs text-muted">
                          {row.open} open
                          {row.overdue > 0 && <span className="ml-1 font-medium text-danger">· {row.overdue} late</span>}
                        </span>
                      </div>
                      <div className="flex h-1.5 overflow-hidden rounded-full bg-subtle">
                        <span className="bg-danger" style={{ width: `${overdueWidth}%` }} />
                        <span className="bg-accent" style={{ width: `${inProgressWidth}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Completion trend */}
          <section className="card overflow-hidden">
            <SectionHeader
              title="Completion trend"
              hint={`${summary.completedLast7} completed in the last 7 days`}
            />
            <div className="px-4 pb-3 pt-4">
              <div className="flex h-28 items-end gap-1">
                {trend.map((point) => (
                  <div key={point.date} className="flex flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-xs text-muted">{point.count || ""}</span>
                    <span
                      className={`w-full rounded-t ${point.count ? "bg-accent" : "bg-subtle"}`}
                      style={{ height: `${Math.max(3, (point.count / maxTrend) * 100)}%` }}
                      title={`${point.label}: ${point.count} completed`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-1">
                {trend.map((point, index) => (
                  <span key={point.date} className="flex-1 text-center text-xs text-muted">
                    {index % 2 === 0 ? point.label.split(" ")[1] ?? point.label : ""}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">
                {data.trendSource === "activity"
                  ? "Counted from the task activity log."
                  : "No activity log yet — estimated from when tasks were last updated."}
              </p>
            </div>
          </section>
        </div>

        {/* What needs a decision — kept last: read the numbers first, then act. */}
        <section className="card overflow-hidden">
          <SectionHeader
            title="Needs attention"
            hint={
              attentionTotal > 0
                ? `${attentionTotal} task${attentionTotal === 1 ? "" : "s"} to look at first`
                : undefined
            }
            href="/tasks"
            linkLabel="All tasks"
          />
          {attentionTotal === 0 ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted">
              <span aria-hidden="true">✅</span>
              Nothing is overdue, blocked or unassigned. Nice.
            </div>
          ) : (
            <>
              <ul>
                {pageItems.map((item) => (
                  <AttentionRow key={item.id} item={item} />
                ))}
              </ul>
              {attentionPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2">
                  <p className="text-xs text-muted">
                    {pageStart + 1}–{pageStart + pageItems.length} of {attentionTotal}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn px-2.5 text-xs disabled:opacity-40"
                      disabled={page === 0}
                      onClick={() => setAttentionPage(page - 1)}
                    >
                      Prev
                    </button>
                    <span className="text-xs text-muted">
                      Page {page + 1} / {attentionPages}
                    </span>
                    <button
                      type="button"
                      className="btn px-2.5 text-xs disabled:opacity-40"
                      disabled={page >= attentionPages - 1}
                      onClick={() => setAttentionPage(page + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
