"use client";

import { useMemo } from "react";
import { fmtDate, isOverdue } from "@/lib/api";
import type { Task } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(s?: string | null) {
  return s ? new Date(s + "T00:00:00") : null;
}

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

// Derives a [start, end] window for a task. Falls back sensibly when only one
// date is set so partially-filled tasks still appear on the timeline.
function taskRange(t: Task): { start: Date; end: Date } | null {
  const s = toDate(t.start_date);
  const e = toDate(t.due_date);
  if (!s && !e) return null;
  if (s && e) return { start: s, end: e < s ? s : e };
  if (s) return { start: s, end: new Date(s.getTime() + DAY_MS) };
  return { start: new Date(e!.getTime() - DAY_MS), end: e! };
}

export default function GanttTimeline({
  tasks,
  onEdit,
}: {
  tasks: Task[];
  onEdit: (t: Task) => void;
}) {
  const rows = useMemo(
    () =>
      tasks
        .map((t) => ({ task: t, range: taskRange(t) }))
        .filter((r): r is { task: Task; range: { start: Date; end: Date } } => r.range !== null)
        .sort((a, b) => a.range.start.getTime() - b.range.start.getTime()),
    [tasks]
  );

  const bounds = useMemo(() => {
    if (rows.length === 0) return null;
    let min = rows[0].range.start;
    let max = rows[0].range.end;
    for (const r of rows) {
      if (r.range.start < min) min = r.range.start;
      if (r.range.end > max) max = r.range.end;
    }
    // pad by 2 days either side so bars aren't flush against the edges
    const start = startOfDay(new Date(min.getTime() - 2 * DAY_MS));
    const end = startOfDay(new Date(max.getTime() + 2 * DAY_MS));
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
    return { start, end, days };
  }, [rows]);

  if (!bounds) {
    return (
      <div className="card px-4 py-12 text-center text-sm text-muted">
        No tasks have dates yet. Add a start or due date to see them on the timeline.
      </div>
    );
  }

  // Column width scales down as the range grows, so long projects stay readable.
  const dayWidth = bounds.days > 120 ? 6 : bounds.days > 60 ? 12 : bounds.days > 30 ? 20 : 32;
  const chartWidth = bounds.days * dayWidth;

  const ticks: { left: number; label: string }[] = [];
  const tickEvery = bounds.days > 90 ? 14 : bounds.days > 30 ? 7 : bounds.days > 14 ? 2 : 1;
  for (let i = 0; i <= bounds.days; i += tickEvery) {
    const d = new Date(bounds.start.getTime() + i * DAY_MS);
    ticks.push({
      left: i * dayWidth,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    });
  }

  const today = startOfDay(new Date());
  const todayOffset =
    today >= bounds.start && today <= bounds.end
      ? ((today.getTime() - bounds.start.getTime()) / DAY_MS) * dayWidth
      : null;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <div className="flex min-w-max">
          {/* Fixed label column */}
          <div className="sticky left-0 z-10 w-56 flex-none border-r border-line bg-white">
            <div className="h-9 border-b border-line bg-subtle px-3 py-2 text-xs font-medium text-muted">
              Task
            </div>
            {rows.map(({ task }) => (
              <button
                key={task.id}
                onClick={() => onEdit(task)}
                className="block h-10 w-full truncate border-b border-line px-3 text-left text-sm text-ink hover:bg-subtle"
                title={task.title}
              >
                {task.parent_task_id && <span className="mr-1 text-muted">↳</span>}
                {task.title}
              </button>
            ))}
          </div>

          {/* Scrollable chart area */}
          <div className="relative flex-none" style={{ width: chartWidth }}>
            <div className="relative h-9 border-b border-line bg-subtle">
              {ticks.map((t, i) => (
                <span
                  key={i}
                  className="absolute top-2 whitespace-nowrap border-l border-line pl-1 text-[10px] text-muted"
                  style={{ left: t.left }}
                >
                  {t.label}
                </span>
              ))}
            </div>

            {todayOffset !== null && (
              <div
                className="pointer-events-none absolute bottom-0 top-9 z-10 w-px bg-danger/60"
                style={{ left: todayOffset }}
              >
                <span className="absolute -top-0 left-1 text-[10px] font-medium text-danger">today</span>
              </div>
            )}

            {rows.map(({ task, range }) => {
              const offset = ((range.start.getTime() - bounds.start.getTime()) / DAY_MS) * dayWidth;
              const width = Math.max(
                dayWidth * 0.75,
                ((range.end.getTime() - range.start.getTime()) / DAY_MS) * dayWidth
              );
              const overdue = isOverdue(task);
              const color =
                task.status === "done"
                  ? "bg-good"
                  : overdue
                  ? "bg-danger"
                  : task.status === "blocked"
                  ? "bg-danger/60"
                  : task.status === "in_progress"
                  ? "bg-accent"
                  : "bg-gray-300";

              return (
                <div key={task.id} className="relative h-10 border-b border-line">
                  <button
                    onClick={() => onEdit(task)}
                    className={`absolute top-2.5 h-5 rounded ${color} transition hover:opacity-80`}
                    style={{ left: offset, width }}
                    title={`${task.title} · ${fmtDate(task.start_date)} → ${fmtDate(task.due_date)}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 border-t border-line px-4 py-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded bg-gray-300" /> To Do
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded bg-accent" /> In Progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded bg-good" /> Done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded bg-danger" /> Overdue / Blocked
        </span>
      </div>
    </div>
  );
}
