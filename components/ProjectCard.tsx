"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProjectStatusBadge } from "@/components/Badges";
import { countdownLabel, daysFromToday, percent } from "@/lib/format";
import { projectEmoji } from "@/lib/projectIcon";
import type { ProjectWithStats } from "@/types";

/* Per-card menu. Kept out of the surrounding <Link> so the markup stays valid
   and the menu still works with a keyboard. */
export function CardMenu({
  archived,
  onSettings,
  onArchive,
  onDelete,
}: {
  archived: boolean;
  onSettings: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-ink hover:bg-subtle sm:py-1.5 sm:text-xs";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="tap-icon h-8 w-8 rounded-md text-muted hover:bg-subtle hover:text-ink"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Project actions"
      >
        •••
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-line bg-white p-1.5 shadow-pop"
        >
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onSettings(); }}>
            ✏️ Settings
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onArchive(); }}>
            📁 {archived ? "Restore" : "Archive"}
          </button>
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            className={`${item} text-danger hover:bg-rose-50`}
            onClick={() => { setOpen(false); onDelete(); }}
          >
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function ProjectAttentionChip({ project }: { project: ProjectWithStats }) {
  const overdue = project.stats.overdue ?? 0;
  if (project.status === "archived") return null;
  if (overdue > 0) {
    return <span className="chip bg-dangerSoft text-danger">{overdue} overdue</span>;
  }
  const days = daysFromToday(project.end_date);
  if (project.status !== "done" && days !== null && days < 0) {
    return <span className="chip bg-warnSoft text-warn">Past deadline</span>;
  }
  if (project.status === "active" && days !== null && days <= 3 && days >= 0) {
    return <span className="chip bg-warnSoft text-warn">Due soon</span>;
  }
  return null;
}

export function ProjectDeadline({ project }: { project: ProjectWithStats }) {
  const label = countdownLabel(project.end_date, project.status) ?? "No deadline";
  const days = daysFromToday(project.end_date);
  const tone =
    project.status === "done" || project.status === "archived"
      ? "text-muted"
      : days === null
      ? "text-muted"
      : days < 0
      ? "font-medium text-danger"
      : days <= 3
      ? "font-medium text-warn"
      : "text-muted";
  return <span className={tone}>{label}</span>;
}

export function ProjectProgress({ project, size = "sm" }: { project: ProjectWithStats; size?: "sm" | "lg" }) {
  const pct = project.calculated_percent_complete ?? project.percent_complete ?? percent(project.stats.done, project.stats.total);
  const done = project.status === "done" || pct >= 100;
  return (
    <div className={size === "lg" ? "h-2.5 w-full overflow-hidden rounded-full bg-subtle" : "h-1.5 w-full overflow-hidden rounded-full bg-subtle"}>
      <div
        className={`h-full rounded-full transition-all ${done ? "bg-good" : "bg-accent"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function projectPercent(project: ProjectWithStats) {
  return (
    project.calculated_percent_complete ??
    project.percent_complete ??
    percent(project.stats.done, project.stats.total)
  );
}

export default function ProjectCard({
  project,
  onSettings,
  onArchive,
  onDelete,
}: {
  project: ProjectWithStats;
  onSettings: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const pct = projectPercent(project);
  const ownerName = project.owner?.name || project.owner?.username;

  return (
    <div className="relative">
      <Link
        href={`/projects/${project.id}`}
        className="card flex h-full flex-col gap-3 p-4 pr-12 transition hover:shadow-pop"
      >
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-line bg-subtle text-lg">
            {projectEmoji(project.icon)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">{project.name}</p>
            <p className="truncate text-xs text-muted">{ownerName ? `Owner: ${ownerName}` : "No owner"}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <ProjectStatusBadge status={project.status} />
          <ProjectAttentionChip project={project} />
        </div>

        <p className="line-clamp-2 text-xs text-muted">
          {project.description || "No description yet."}
        </p>

        <div className="mt-auto space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Progress</span>
            <span className="font-semibold text-ink">{pct}%</span>
          </div>
          <ProjectProgress project={project} size="lg" />
          <div className="flex items-center justify-between gap-2 text-xs text-muted">
            <span>
              {project.stats.done}/{project.stats.total} tasks
            </span>
            <ProjectDeadline project={project} />
          </div>
        </div>
      </Link>

      <div className="absolute right-2 top-2">
        <CardMenu
          archived={project.status === "archived"}
          onSettings={onSettings}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
