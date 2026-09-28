import { isDueSoon, isOverdue } from "@/lib/api";
import { daysFromToday } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabaseServer";

const DAY_MS = 24 * 60 * 60 * 1000;

export type AttentionReason = "overdue" | "blocked" | "due_soon" | "unassigned";

export type AttentionItem = {
  id: string;
  title: string;
  projectId: string | null;
  projectName: string;
  assigneeName: string | null;
  priority: string;
  status: string;
  reason: AttentionReason;
  /** Days past the due date (overdue only). */
  daysLate: number | null;
  /** Days until the due date (due_soon only). */
  daysLeft: number | null;
  /** How long the task has been sitting in its current state. */
  ageDays: number | null;
};

export type ProjectHealth = {
  id: string;
  name: string;
  status: string;
  total: number;
  done: number;
  overdue: number;
  percent: number;
  /** Progress the calendar expects by today; null when the project has no dates. */
  expectedPercent: number | null;
  health: "on_track" | "at_risk" | "off_track" | "done" | "unknown";
  endDate: string | null;
  daysLeft: number | null;
};

export type WorkloadRow = {
  id: string;
  name: string;
  open: number;
  inProgress: number;
  overdue: number;
  done: number;
};

export type TrendPoint = { date: string; label: string; count: number };

export type DashboardData = {
  summary: {
    totalProjects: number;
    activeProjects: number;
    totalTasks: number;
    openTasks: number;
    doneTasks: number;
    overdue: number;
    dueSoon: number;
    blocked: number;
    unassigned: number;
    unscheduled: number;
    byStatus: Record<string, number>;
    completedLast7: number;
    completedPrev7: number;
  };
  attention: { items: AttentionItem[]; counts: Record<AttentionReason, number> };
  health: ProjectHealth[];
  workload: WorkloadRow[];
  trend: TrendPoint[];
  trendSource: "activity" | "updated";
};

/* Loosely typed on purpose: the live database can be a migration behind the
   schema file, so anything newer than the core columns is optional. */
type RawTask = {
  id: string;
  project_id: string | null;
  title?: string;
  status: string;
  priority?: string;
  due_date: string | null;
  start_date?: string | null;
  assignee_id: string | null;
  percent_complete?: number;
  created_at?: string;
  updated_at?: string;
};

type RawProject = {
  id: string;
  name: string;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function ageInDays(from?: string | null) {
  if (!from) return null;
  const start = new Date(from.length > 10 ? from : `${from}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - start.getTime()) / DAY_MS));
}

export async function getDashboardData(): Promise<DashboardData> {
  const db = supabaseAdmin();

  // Plain selects + explicit lookups: embedded FK-hinted joins are brittle and
  // were silently falling back to slower paths.
  const [tasksRes, projectsRes] = await Promise.all([
    db.from("tasks").select("*"),
    db.from("projects").select("*"),
  ]);

  if (tasksRes.error) throw new Error(tasksRes.error.message);
  if (projectsRes.error) throw new Error(projectsRes.error.message);

  const tasks = (tasksRes.data ?? []) as RawTask[];
  const projects = (projectsRes.data ?? []) as RawProject[];

  const assigneeIds = [...new Set(tasks.map((t) => t.assignee_id).filter((v): v is string => !!v))];
  const usersRes = assigneeIds.length
    ? await db.from("users").select("id, name, username").in("id", assigneeIds)
    : { data: [] as Array<{ id: string; name: string; username: string }> };

  if (usersRes && "error" in usersRes && usersRes.error) {
    throw new Error((usersRes.error as { message: string }).message);
  }

  const usersById = new Map(
    ((usersRes?.data ?? []) as Array<{ id: string; name: string; username: string }>).map(
      (u) => [u.id, u.name || u.username] as const
    )
  );

  const projectNames = new Map(projects.map((p) => [p.id, p.name] as const));

  // ---------------------------------------------------------------- summary
  const byStatus: Record<string, number> = {};
  let overdue = 0;
  let dueSoon = 0;
  let blocked = 0;
  let unassigned = 0;
  let unscheduled = 0;
  let doneTasks = 0;

  for (const task of tasks) {
    byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
    if (task.status === "done") doneTasks += 1;
    if (isOverdue(task)) overdue += 1;
    if (isDueSoon(task)) dueSoon += 1;
    if (task.status === "blocked") blocked += 1;
    if (!task.assignee_id && task.status !== "done") unassigned += 1;
    if (!task.due_date && task.status !== "done") unscheduled += 1;
  }

  const activeProjects = projects.filter((p) => p.status === "active").length;

  // ------------------------------------------------------------ trend (14d)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowStart = new Date(today.getTime() - 13 * DAY_MS);

  const counts = new Map<string, number>();
  for (let i = 0; i < 14; i += 1) counts.set(dayKey(new Date(windowStart.getTime() + i * DAY_MS)), 0);

  let trendSource: "activity" | "updated" = "activity";
  let activityTotal = 0;

  try {
    const act = await db
      .from("task_activity")
      .select("created_at, details")
      .eq("action", "status_changed")
      .gte("created_at", windowStart.toISOString())
      .like("details", "%to done");

    if (!act.error && act.data) {
      for (const row of act.data as Array<{ created_at: string; details: string | null }>) {
        const key = dayKey(new Date(row.created_at));
        if (counts.has(key)) {
          counts.set(key, (counts.get(key) ?? 0) + 1);
          activityTotal += 1;
        }
      }
    }
  } catch {
    // No activity table (or an older shape) — fall through to the estimate below.
  }

  if (activityTotal === 0) {
    // Nothing logged yet: approximate with when done tasks were last touched.
    trendSource = "updated";
    for (const task of tasks) {
      if (task.status !== "done" || !task.updated_at) continue;
      const key = dayKey(new Date(task.updated_at));
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const trend: TrendPoint[] = [...counts.entries()].map(([date, count]) => {
    const d = new Date(`${date}T00:00:00`);
    return {
      date,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count,
    };
  });

  const sumRange = (from: number, to: number) =>
    trend.slice(from, to).reduce((total, point) => total + point.count, 0);
  const completedLast7 = sumRange(7, 14);
  const completedPrev7 = sumRange(0, 7);

  // -------------------------------------------------------------- attention
  const attention: AttentionItem[] = [];
  const counts2: Record<AttentionReason, number> = {
    overdue: 0,
    blocked: 0,
    due_soon: 0,
    unassigned: 0,
  };

  for (const task of tasks) {
    if (task.status === "done") continue;

    let reason: AttentionReason | null = null;
    if (isOverdue(task)) reason = "overdue";
    else if (task.status === "blocked") reason = "blocked";
    else if (isDueSoon(task)) reason = "due_soon";
    else if (!task.assignee_id) reason = "unassigned";

    if (!reason) continue;
    counts2[reason] += 1;

    attention.push({
      id: task.id,
      title: task.title ?? "Untitled task",
      projectId: task.project_id,
      projectName: (task.project_id ? projectNames.get(task.project_id) : null) ?? "No project",
      assigneeName: task.assignee_id ? usersById.get(task.assignee_id) ?? null : null,
      priority: task.priority ?? "medium",
      status: task.status,
      reason,
      daysLate: reason === "overdue" ? Math.abs(daysFromToday(task.due_date) ?? 0) : null,
      daysLeft: reason === "due_soon" ? daysFromToday(task.due_date) : null,
      ageDays: ageInDays(task.updated_at ?? task.created_at),
    });
  }

  const REASON_RANK: Record<AttentionReason, number> = {
    overdue: 0,
    blocked: 1,
    due_soon: 2,
    unassigned: 3,
  };

  attention.sort((a, b) => {
    if (REASON_RANK[a.reason] !== REASON_RANK[b.reason]) {
      return REASON_RANK[a.reason] - REASON_RANK[b.reason];
    }
    if (a.reason === "overdue") return (b.daysLate ?? 0) - (a.daysLate ?? 0);
    if (a.reason === "due_soon") return (a.daysLeft ?? 0) - (b.daysLeft ?? 0);
    return (b.ageDays ?? 0) - (a.ageDays ?? 0);
  });

  // ----------------------------------------------------------- project health
  const statsByProject = new Map<string, { total: number; done: number; overdue: number }>();
  for (const task of tasks) {
    if (!task.project_id) continue;
    const bucket = statsByProject.get(task.project_id) ?? { total: 0, done: 0, overdue: 0 };
    bucket.total += 1;
    if (task.status === "done") bucket.done += 1;
    if (isOverdue(task)) bucket.overdue += 1;
    statsByProject.set(task.project_id, bucket);
  }

  const health: ProjectHealth[] = projects.map((project) => {
    const stat = statsByProject.get(project.id) ?? { total: 0, done: 0, overdue: 0 };
    const percent = stat.total ? Math.round((stat.done / stat.total) * 100) : 0;

    // What the calendar expects today, so "60% done" can be read against it.
    let expectedPercent: number | null = null;
    if (project.start_date && project.end_date) {
      const start = new Date(`${project.start_date}T00:00:00`).getTime();
      const end = new Date(`${project.end_date}T00:00:00`).getTime();
      if (end > start) {
        const ratio = (today.getTime() - start) / (end - start);
        expectedPercent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
      }
    }

    const delta = expectedPercent === null ? null : percent - expectedPercent;
    let status: ProjectHealth["health"] = "on_track";
    if (project.status === "done" || project.status === "archived") status = "done";
    else if (stat.total === 0) status = "unknown";
    else if (stat.overdue >= 3 || (delta !== null && delta < -25)) status = "off_track";
    else if (stat.overdue > 0 || (delta !== null && delta < -10)) status = "at_risk";
    else if (expectedPercent === null) status = "unknown";

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      total: stat.total,
      done: stat.done,
      overdue: stat.overdue,
      percent,
      expectedPercent,
      health: status,
      endDate: project.end_date ?? null,
      daysLeft: daysFromToday(project.end_date),
    };
  });

  const HEALTH_RANK: Record<ProjectHealth["health"], number> = {
    off_track: 0,
    at_risk: 1,
    unknown: 2,
    on_track: 3,
    done: 4,
  };
  health.sort((a, b) => HEALTH_RANK[a.health] - HEALTH_RANK[b.health] || a.name.localeCompare(b.name));

  // ---------------------------------------------------------------- workload
  const workloadMap = new Map<string, WorkloadRow>();
  const bucketFor = (id: string, name: string) => {
    const existing = workloadMap.get(id);
    if (existing) return existing;
    const row: WorkloadRow = { id, name, open: 0, inProgress: 0, overdue: 0, done: 0 };
    workloadMap.set(id, row);
    return row;
  };

  for (const task of tasks) {
    const isDone = task.status === "done";
    const key = task.assignee_id ?? "unassigned";
    const name = task.assignee_id ? usersById.get(task.assignee_id) ?? "Unknown" : "Unassigned";
    const bucket = bucketFor(key, name);
    if (isDone) bucket.done += 1;
    else {
      bucket.open += 1;
      if (task.status === "in_progress") bucket.inProgress += 1;
      if (isOverdue(task)) bucket.overdue += 1;
    }
  }

  const workload = [...workloadMap.values()]
    .filter((row) => row.open + row.done > 0)
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name))
    .slice(0, 8);

  return {
    summary: {
      totalProjects: projects.length,
      activeProjects,
      totalTasks: tasks.length,
      openTasks: tasks.length - doneTasks,
      doneTasks,
      overdue,
      dueSoon,
      blocked,
      unassigned,
      unscheduled,
      byStatus,
      completedLast7,
      completedPrev7,
    },
    attention: { items: attention.slice(0, 10), counts: counts2 },
    health: health.slice(0, 6),
    workload,
    trend,
    trendSource,
  };
}
