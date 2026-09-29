"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StatusDot, STATUS_COLOR, STATUS_LABEL } from "@/components/Badges";
import { fmtDate, initials, startOfDay } from "@/lib/format";
import { isOverdue } from "@/lib/api";
import type { Task } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

// Row and bar heights live in globals.css as .gantt-row / .gantt-group /
// .gantt-bar so the coarse-pointer rule there can grow them to 44px. Only the
// header is sized here, because the chart's weekend bands and today marker are
// positioned from it.
// Header sizes live in globals.css as .gantt-month-band / the row after it, so
// the coarse-pointer rule there can grow them on touch. Only the combined height
// is computed here, because the weekend bands and today marker are positioned
// from it. Keep these in sync with the CSS.
const MONTH_H = 26;
const TICK_H = 26;
// +2 for the two 1px borders under the header rows, so the label column and
// the chart lanes start on exactly the same line.
const HEADER_H = MONTH_H + TICK_H + 2;

type Zoom = "day" | "week" | "month";
type GroupBy = "none" | "status" | "assignee";

const ZOOM_DAY_WIDTH: Record<Zoom, number> = { day: 34, week: 14, month: 5 };

const STATUS_ORDER = ["todo", "in_progress", "review", "blocked", "done"];

function toDate(s?: string | null) {
  return s ? new Date(`${s.slice(0, 10)}T00:00:00`) : null;
}

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * DAY_MS);
}

/* Derives a [start, end] window for a task. Falls back sensibly when only one
   date is set so partially-filled tasks still appear on the timeline. */
function taskRange(t: Task): { start: Date; end: Date } | null {
  const s = toDate(t.start_date);
  const e = toDate(t.due_date);
  if (!s && !e) return null;
  if (s && e) return { start: s, end: e < s ? s : e };
  if (s) return { start: s, end: addDays(s, 1) };
  return { start: addDays(toDate(t.due_date)!, -1), end: toDate(t.due_date)! };
}

type Entry =
  | { kind: "group"; key: string; label: string; count: number }
  | { kind: "task"; task: Task; range: { start: Date; end: Date }; depth: number };

export default function GanttTimeline({
  tasks,
  onEdit,
}: {
  tasks: Task[];
  onEdit: (t: Task) => void;
}) {
  const [zoom, setZoom] = useState<Zoom>("week");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [hideDone, setHideDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dayWidth = ZOOM_DAY_WIDTH[zoom];

  // Depth of each task in its parent chain, so sub-tasks read as sub-tasks.
  const depthById = useMemo(() => {
    const byId = new Map(tasks.map((t) => [t.id, t] as const));
    const depths = new Map<string, number>();
    const depthOf = (task: Task, seen: Set<string>): number => {
      const cached = depths.get(task.id);
      if (cached !== undefined) return cached;
      if (!task.parent_task_id || seen.has(task.id)) return 0;
      const parent = byId.get(task.parent_task_id);
      if (!parent) return 0;
      seen.add(task.id);
      const depth = Math.min(3, depthOf(parent, seen) + 1);
      seen.delete(task.id);
      depths.set(task.id, depth);
      return depth;
    };
    for (const task of tasks) depthOf(task, new Set());
    return depths;
  }, [tasks]);

  const dated = useMemo(
    () =>
      tasks
        .filter((t) => !hideDone || t.status !== "done")
        .map((t) => ({ task: t, range: taskRange(t) }))
        .filter((r): r is { task: Task; range: { start: Date; end: Date } } => r.range !== null),
    [tasks, hideDone]
  );

  const undatedCount = useMemo(
    () => tasks.filter((t) => !taskRange(t)).length,
    [tasks]
  );

  const bounds = useMemo(() => {
    const today = startOfDay(new Date());
    if (dated.length === 0) {
      return { start: addDays(today, -14), end: addDays(today, 14), days: 28 };
    }
    let min = dated[0].range.start;
    let max = dated[0].range.end;
    for (const r of dated) {
      if (r.range.start < min) min = r.range.start;
      if (r.range.end > max) max = r.range.end;
    }
    // Today always has to be on screen, otherwise the "today" line is a lie.
    if (today < min) min = today;
    if (today > max) max = today;
    const start = addDays(startOfDay(min), -2);
    const end = addDays(startOfDay(max), 3);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
    return { start, end, days };
  }, [dated]);

  const entries = useMemo<Entry[]>(() => {
    const sorted = [...dated].sort((a, b) => a.range.start.getTime() - b.range.start.getTime());
    if (groupBy === "none") {
      return sorted.map((r) => ({
        kind: "task" as const,
        task: r.task,
        range: r.range,
        depth: depthById.get(r.task.id) ?? 0,
      }));
    }

    const labelOf = (task: Task) =>
      groupBy === "status"
        ? STATUS_LABEL[task.status as keyof typeof STATUS_LABEL] ?? task.status
        : task.assignee?.name || task.assignee?.username || "Unassigned";

    const groups = new Map<string, { task: Task; range: { start: Date; end: Date } }[]>();
    for (const row of sorted) {
      const key = groupBy === "status" ? row.task.status : labelOf(row.task);
      const bucket = groups.get(key);
      if (bucket) bucket.push(row);
      else groups.set(key, [row]);
    }

    const keys =
      groupBy === "status"
        ? STATUS_ORDER.filter((k) => groups.has(k)).concat(
            [...groups.keys()].filter((k) => !STATUS_ORDER.includes(k))
          )
        : [...groups.keys()].sort((a, b) => a.localeCompare(b));

    const out: Entry[] = [];
    for (const key of keys) {
      const rows = groups.get(key) ?? [];
      out.push({
        kind: "group",
        key,
        label: groupBy === "status" ? STATUS_LABEL[key as keyof typeof STATUS_LABEL] ?? key : key,
        count: rows.length,
      });
      for (const row of rows) {
        out.push({ kind: "task", task: row.task, range: row.range, depth: depthById.get(row.task.id) ?? 0 });
      }
    }
    return out;
  }, [dated, groupBy, depthById]);

  const chartWidth = bounds.days * dayWidth;

  /* Header bands are cut on real calendar boundaries, not every N days from the
     window start — otherwise a "1 Sep" label sits on 3 Sep and nothing lines up
     with the bars underneath. */
  const months = useMemo(() => {
    const out: { left: number; width: number; label: string; partial: boolean }[] = [];
    let i = 0;
    const first = bounds.start;
    // Leading partial month: from the window start to the end of that month.
    if (!(first.getDate() === 1 && first.getHours() === 0 && first.getMinutes() === 0)) {
      const monthEnd = new Date(first.getFullYear(), first.getMonth() + 1, 1);
      const span = Math.max(1, Math.round((monthEnd.getTime() - startOfDay(first).getTime()) / DAY_MS));
      out.push({
        left: 0,
        width: Math.min(span, bounds.days) * dayWidth,
        label: first.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
        partial: true,
      });
      i = Math.min(span, bounds.days);
    }
    while (i < bounds.days) {
      const d = addDays(bounds.start, i);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const span = Math.round((monthEnd.getTime() - d.getTime()) / DAY_MS);
      const width = Math.max(1, Math.min(span, bounds.days - i)) * dayWidth;
      out.push({
        left: i * dayWidth,
        width,
        label:
          width < 72
            ? d.toLocaleDateString(undefined, { month: "short" })
            : d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
        partial: false,
      });
      i += Math.max(1, Math.min(span, bounds.days - i));
    }
    return out;
  }, [bounds, dayWidth]);

  /* Three header densities. Each tick lands on a real boundary — the 1st of a
     month, a Monday, or a day — and carries its own left offset, so labels can
     never drift away from the gridlines below them. */
  const ticks = useMemo(() => {
    const out: { left: number; width: number; label: string; strong: boolean }[] = [];

    if (zoom === "month") {
      for (let i = 0; i < bounds.days; ) {
        const d = addDays(bounds.start, i);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const span = Math.max(1, Math.min(
          Math.round((monthEnd.getTime() - d.getTime()) / DAY_MS),
          bounds.days - i
        ));
        out.push({
          left: i * dayWidth,
          width: span * dayWidth,
          label: d.toLocaleDateString(undefined, { month: "short" }),
          strong: false,
        });
        i += span;
      }
      return out;
    }

    for (let i = 0; i < bounds.days; i += 1) {
      const d = addDays(bounds.start, i);
      const isMonday = d.getDay() === 1;
      const isFirst = d.getDate() === 1;

      if (zoom === "week") {
        // Mondays only, and never on top of a month label.
        if (!isMonday) continue;
        out.push({
          left: i * dayWidth,
          width: 7 * dayWidth,
          label: isFirst
            ? d.toLocaleDateString(undefined, { month: "short" })
            : String(d.getDate()),
          strong: isFirst,
        });
        continue;
      }

      // Day zoom: one cell per day, weekday initials above the date.
      out.push({
        left: i * dayWidth,
        width: dayWidth,
        label: String(d.getDate()),
        strong: isFirst,
      });
    }
    return out;
  }, [bounds, dayWidth, zoom]);

  // Weekend shading: one band per weekend, skipped when the range is huge.
  const weekends = useMemo(() => {
    if (zoom === "month" || bounds.days > 400) return [];
    const out: { left: number; width: number }[] = [];
    for (let i = 0; i <= bounds.days; i += 1) {
      const d = addDays(bounds.start, i);
      const day = d.getDay();
      if (day === 6) out.push({ left: i * dayWidth, width: dayWidth * 2 });
    }
    return out;
  }, [bounds, dayWidth, zoom]);

  /* Gridlines, positioned from the same tick data as the labels — one line per
     week (or per month at month zoom), running the full height of the chart. */
  const gridlines = useMemo(() => {
    if (zoom === "day") {
      return ticks.map((t) => ({ left: t.left, strong: t.strong, thin: true }));
    }
    if (zoom === "week") {
      return ticks.map((t) => ({ left: t.left, strong: true, thin: false }));
    }
    return ticks.map((t) => ({ left: t.left, strong: true, thin: false }));
  }, [ticks, zoom]);

  const today = startOfDay(new Date());
  const todayOffset =
    today >= bounds.start && today <= bounds.end
      ? ((today.getTime() - bounds.start.getTime()) / DAY_MS) * dayWidth
      : null;

  function jumpToToday() {
    const el = scrollRef.current;
    if (!el || todayOffset === null) return;
    el.scrollTo({ left: Math.max(0, todayOffset - el.clientWidth / 3), behavior: "smooth" });
  }

  // Land on today the first time the timeline is opened.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || todayOffset === null) return;
    el.scrollLeft = Math.max(0, todayOffset - el.clientWidth / 3);
    // Intentionally runs once: later zoom changes should keep the user's position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (dated.length === 0) {
    return (
      <div className="card px-4 py-12 text-center">
        <p className="text-sm text-muted">
          {tasks.length === 0
            ? "No tasks yet — add one to see it on the timeline."
            : "No tasks have dates yet. Add a start or due date to see them here."}
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg" role="group" aria-label="Timeline zoom">
            {(["day", "week", "month"] as Zoom[]).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                aria-pressed={zoom === z}
                className={`seg-item capitalize ${zoom === z ? "seg-item-on" : ""}`}
              >
                {z}
              </button>
            ))}
          </div>

          <label className="sr-only" htmlFor="gantt-group">
            Group rows by
          </label>
          <select
            id="gantt-group"
            className="input w-auto flex-none py-1 text-xs"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          >
            <option value="none">No grouping</option>
            <option value="status">Group by status</option>
            <option value="assignee">Group by assignee</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              className="task-check"
              checked={hideDone}
              onChange={(e) => setHideDone(e.target.checked)}
            />
            Hide completed
          </label>
        </div>

        <button type="button" onClick={jumpToToday} className="btn tap px-2.5 py-1 text-xs">
          Jump to today
        </button>
      </div>

      <div ref={scrollRef} className="relative overflow-x-auto">
        <div className="flex min-w-max">
          {/* Fixed label column. Narrow on a phone: at 360px a 240px column
              would leave nothing but a sliver of chart. */}
          <div className="sticky left-0 z-20 w-36 flex-none border-r border-line bg-surface sm:w-52 lg:w-60">
            <div
              className="flex items-center border-b border-line bg-subtle px-3 text-xs font-medium text-muted"
              style={{ height: HEADER_H }}
            >
              Task
            </div>
            {entries.map((entry) =>
              entry.kind === "group" ? (
                <div
                  key={`g-${entry.key}`}
                  className="gantt-group flex items-center gap-2 border-b border-line bg-subtle px-3 text-xs font-semibold text-ink"
                >
                  <span className="truncate">{entry.label}</span>
                  <span className="text-muted">{entry.count}</span>
                </div>
              ) : (
                <button
                  key={entry.task.id}
                  type="button"
                  onClick={() => onEdit(entry.task)}
                  className="gantt-row flex w-full items-center gap-2 border-b border-line px-3 text-left text-sm text-ink transition hover:bg-subtle"
                  style={{ paddingLeft: 12 + entry.depth * 14 }}
                  title={entry.task.title}
                >
                  <StatusDot status={entry.task.status} />
                  <span className="min-w-0 flex-1 truncate">{entry.task.title}</span>
                  {entry.task.assignee && (
                    <span className="avatar" style={{ width: 20, height: 20, fontSize: 10 }}>
                      {initials(entry.task.assignee.name || entry.task.assignee.username)}
                    </span>
                  )}
                </button>
              )
            )}
          </div>

          {/* Chart area */}
          <div
            className="relative flex-none"
            style={{ width: chartWidth, background: "var(--gantt-canvas)" }}
          >
            {/* Month + tick header */}
            <div className="sticky top-0 z-10" style={{ background: "var(--color-surface)" }}>
              <div className="gantt-month-band relative border-b border-line">
                {months.map((m, i) => (
                  <span
                    key={i}
                    className={`absolute top-0 flex h-full items-center overflow-hidden border-l border-line px-2 text-xs font-semibold text-ink ${
                      m.partial ? "opacity-70" : ""
                    }`}
                    style={{ left: m.left, width: m.width }}
                  >
                    <span className="truncate">{m.label}</span>
                  </span>
                ))}
              </div>
              <div className="relative border-b border-line" style={{ height: TICK_H }}>
                {zoom === "day" &&
                  ticks.map((t, i) => {
                    const d = addDays(bounds.start, i);
                    const weekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <span
                        key={i}
                        className="absolute top-0 flex flex-col items-center justify-center text-xs leading-tight"
                        style={{ left: t.left, width: t.width }}
                      >
                        <span className={weekend ? "text-muted" : t.strong ? "font-semibold text-ink" : "text-muted"}>
                          {d.toLocaleDateString(undefined, { weekday: "narrow" })}
                        </span>
                        <span className={t.strong ? "font-semibold text-ink" : "text-muted"}>{t.label}</span>
                      </span>
                    );
                  })}
                {zoom !== "day" &&
                  ticks.map((t, i) => (
                    <span
                      key={i}
                      className={`absolute top-0 flex h-full items-center justify-center overflow-hidden border-l border-line text-xs ${
                        t.strong ? "font-semibold text-ink" : "text-muted"
                      }`}
                      style={{ left: t.left, width: t.width }}
                    >
                      {t.label}
                    </span>
                  ))}
              </div>
            </div>

            {/* Gridlines — drawn from the same tick offsets as the labels, so a
                label can never sit between two lines. */}
            {gridlines.map((g, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`pointer-events-none absolute bottom-0 top-0 ${
                  g.strong ? "border-l border-line" : "border-l border-line"
                }`}
                style={{ left: g.left }}
              />
            ))}

            {/* Weekend shading */}
            {weekends.map((w, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 bg-subtle"
                style={{ left: w.left, width: w.width, top: HEADER_H }}
              />
            ))}

            {/* Today marker */}
            {todayOffset !== null && (
              <div
                className="pointer-events-none absolute bottom-0 z-10 w-0 border-l border-accent"
                style={{ left: todayOffset, top: HEADER_H }}
              >
                <span className="absolute -top-6 -translate-x-1/2 whitespace-nowrap rounded bg-accent px-1.5 py-0.5 text-xs font-semibold text-white">
                  Today
                </span>
              </div>
            )}

            {/* Rows */}
            {entries.map((entry) => {
              if (entry.kind === "group") {
                return (
                  <div
                    key={`gr-${entry.key}`}
                    className="gantt-group border-b border-line bg-subtle"
                  />
                );
              }

              const { task, range } = entry;
              const left = ((range.start.getTime() - bounds.start.getTime()) / DAY_MS) * dayWidth;
              const spanDays = (range.end.getTime() - range.start.getTime()) / DAY_MS;
              const width = Math.max(dayWidth * 0.8, spanDays * dayWidth);
              const color = STATUS_COLOR[task.status as keyof typeof STATUS_COLOR] ?? "var(--color-muted)";
              const overdue = isOverdue(task);
              const progress = task.status === "done" ? 100 : task.percent_complete ?? 0;
              // One day at day/month zoom is only a few pixels wide, so a
              // text label inside the bar would be clipped mid-word. Below this
              // threshold the bar is drawn as a shape only.
              const showLabel = width >= 96;
              const showProgress = progress > 0 && progress < 100;

              return (
                <div key={task.id} className="gantt-row relative border-b border-line">
                  <button
                    type="button"
                    onClick={() => onEdit(task)}
                    className="gantt-bar absolute overflow-hidden rounded transition hover:brightness-110"
                    style={{
                      left,
                      width,
                      // Solid body in the status colour, with the unfinished
                      // remainder drawn as a lighter overlay. A translucent body
                      // with a solid progress fill made a 0% bar look empty.
                      background: progress >= 100 ? color : `color-mix(in srgb, ${color} 38%, var(--color-surface))`,
                      border: `1px solid ${overdue ? "var(--color-danger)" : color}`,
                    }}
                    title={`${task.title} · ${fmtDate(task.start_date, { year: false })} → ${fmtDate(
                      task.due_date,
                      { year: false }
                    )} · ${progress}%`}
                    aria-label={`${task.title}, ${STATUS_LABEL[task.status as keyof typeof STATUS_LABEL] ?? task.status}, ${progress}% complete`}
                  >
                    {/* Unfinished portion, drawn from the right edge. */}
                    {showProgress && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 right-0"
                        style={{ width: `${100 - progress}%`, background: "var(--color-surface)", opacity: 0.55 }}
                      />
                    )}
                    {showLabel && (
                      <span className="relative z-10 block truncate px-1.5 text-xs font-medium leading-[18px] text-white">
                        {task.title}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2">
        <div className="flex flex-wrap gap-3 text-xs text-muted">
          {STATUS_ORDER.map((key) => (
            <span key={key} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-4 rounded"
                style={{ background: `${STATUS_COLOR[key as keyof typeof STATUS_COLOR]}26`, border: `1px solid ${STATUS_COLOR[key as keyof typeof STATUS_COLOR]}` }}
              />
              {STATUS_LABEL[key as keyof typeof STATUS_LABEL]}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted">
          {undatedCount > 0
            ? `${undatedCount} task${undatedCount === 1 ? "" : "s"} without dates are not shown.`
            : `${dated.length} task${dated.length === 1 ? "" : "s"} on the timeline.`}
        </p>
      </div>
    </div>
  );
}
