import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { calculateDueDate } from "@/lib/api";
import {
  PROJECT_ICONS,
  PROJECT_SHEET,
  PROJECT_STATUSES,
  PROJECT_VIEWS,
  SAMPLE_PREFIX,
  TASK_PRIORITIES,
  TASK_SHEET,
  TASK_STATUS_KEYS,
} from "@/lib/importConfig";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const MAX_PROJECT_ROWS = 200;
const MAX_TASK_ROWS = 1000;

type Issue = { sheet: string; row: number; message: string };

type ParsedProject = {
  row: number;
  name: string;
  description: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  icon: string;
  accent_color: string;
  default_view: string;
};

type ParsedTask = {
  row: number;
  title: string;
  projectName: string;
  parentTitle: string;
  description: string;
  status: string;
  priority: string;
  assigneeName: string;
  start_date: string | null;
  due_date: string | null;
  duration_days: number | null;
  percent_complete: number;
  tags: string[];
};

/* ----------------------------- sheet reading ----------------------------- */

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\*+$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Reads a sheet as an array of string rows, locating columns by header name
 * (tolerant of column reordering and extra columns). Row numbers returned with
 * each record are the real Excel row numbers (header = row 1).
 */
function readSheet(
  wb: XLSX.WorkBook,
  sheetName: string,
  columns: Record<string, string[]>
): { records: Record<string, string>[]; rowNumbers: number[] } | null {
  const name = wb.SheetNames.find((n) => n.trim().toLowerCase() === sheetName.toLowerCase());
  if (!name) return null;

  const ws = wb.Sheets[name];
  const aoa = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    defval: "",
    raw: false,
    dateNF: "yyyy-mm-dd",
  }) as unknown as string[][];

  if (!aoa || aoa.length < 2) return { records: [], rowNumbers: [] };

  const headerRow = (aoa[0] ?? []).map(normalizeHeader);
  const colIndex = new Map<string, number>();
  for (const [key, aliases] of Object.entries(columns)) {
    for (const alias of aliases) {
      const idx = headerRow.indexOf(alias);
      if (idx >= 0) {
        colIndex.set(key, idx);
        break;
      }
    }
  }

  const records: Record<string, string>[] = [];
  const rowNumbers: number[] = [];

  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i] ?? [];
    const record: Record<string, string> = {};
    let hasValue = false;
    for (const [key, idx] of colIndex) {
      const value = String(row[idx] ?? "").trim();
      record[key] = value;
      if (value) hasValue = true;
    }
    if (!hasValue) continue; // skip blank rows
    records.push(record);
    rowNumbers.push(i + 1); // Excel row number (1-based, header is row 1)
  }

  return { records, rowNumbers };
}

/* ------------------------------ value parsing ---------------------------- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string): { date: string | null; error?: string } {
  if (!value) return { date: null };
  if (DATE_RE.test(value)) return { date: value };
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return { date: `${y}-${m}-${d}` };
  }
  return { date: null, error: `invalid date "${value}" (use YYYY-MM-DD)` };
}

function parseWholeNumber(value: string, min: number, max: number): number | null {
  if (!value) return null;
  const n = Number(value.replace(/[^\d.-]/g, ""));
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function isSample(value: string): boolean {
  return value.trim().toLowerCase().startsWith(SAMPLE_PREFIX.toLowerCase());
}

/* --------------------------------- route --------------------------------- */

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Attach the filled template as a 'file' upload." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File is too large (max 5 MB)." }, { status: 400 });
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json(
      { error: "Could not read the file. Upload the .xlsx template (not .csv or .numbers)." },
      { status: 400 }
    );
  }

  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const db = supabaseAdmin();

  /* ------------------------------- projects ------------------------------ */

  const projectSheet = readSheet(wb, PROJECT_SHEET, {
    name: ["name"],
    description: ["description"],
    status: ["status"],
    start_date: ["start date", "start"],
    end_date: ["end date", "end"],
    icon: ["icon"],
    accent_color: ["accent color", "accent", "color"],
    default_view: ["default view", "view"],
  });

  const taskSheet = readSheet(wb, TASK_SHEET, {
    title: ["title"],
    project: ["project", "project name"],
    parent: ["parent task", "parent"],
    description: ["description"],
    status: ["status"],
    priority: ["priority"],
    assignee: ["assignee", "owner"],
    start_date: ["start date", "start"],
    due_date: ["due date", "due", "end date", "deadline"],
    duration_days: ["duration days", "duration"],
    percent_complete: ["percent complete", "% complete", "percent", "progress"],
    tags: ["tags", "tag"],
  });

  if (!projectSheet && !taskSheet) {
    return NextResponse.json(
      { error: `The workbook needs a "${PROJECT_SHEET}" and/or "${TASK_SHEET}" sheet. Did you use the template?` },
      { status: 400 }
    );
  }

  const parsedProjects: ParsedProject[] = [];
  for (let i = 0; i < (projectSheet?.records.length ?? 0); i++) {
    const rec = projectSheet!.records[i];
    const row = projectSheet!.rowNumbers[i];
    if (isSample(rec.name)) continue;

    if (!rec.name) {
      errors.push({ sheet: PROJECT_SHEET, row, message: "Name is required — row skipped." });
      continue;
    }

    let status = normalizeKey(rec.status || "active");
    if (status === "complete" || status === "completed") status = "done";
    if (!PROJECT_STATUSES.includes(status)) {
      warnings.push({ sheet: PROJECT_SHEET, row, message: `Unknown status "${rec.status}" — using "active".` });
      status = "active";
    }

    const start = parseDate(rec.start_date);
    if (start.error) errors.push({ sheet: PROJECT_SHEET, row, message: `Start Date: ${start.error}.` });
    const end = parseDate(rec.end_date);
    if (end.error) errors.push({ sheet: PROJECT_SHEET, row, message: `End Date: ${end.error}.` });
    if (start.error || end.error) continue;

    let icon = (rec.icon || "folder").toLowerCase();
    if (!PROJECT_ICONS.includes(icon)) {
      warnings.push({ sheet: PROJECT_SHEET, row, message: `Unknown icon "${rec.icon}" — using "folder".` });
      icon = "folder";
    }

    let accent = rec.accent_color || "#12A594";
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent)) {
      warnings.push({ sheet: PROJECT_SHEET, row, message: `Invalid accent color "${rec.accent_color}" — using default.` });
      accent = "#12A594";
    }

    let view = (rec.default_view || "kanban").toLowerCase();
    if (!PROJECT_VIEWS.includes(view)) {
      warnings.push({ sheet: PROJECT_SHEET, row, message: `Unknown view "${rec.default_view}" — using "kanban".` });
      view = "kanban";
    }

    parsedProjects.push({
      row,
      name: rec.name,
      description: rec.description,
      status,
      start_date: start.date,
      end_date: end.date,
      icon,
      accent_color: accent,
      default_view: view,
    });
  }

  if (parsedProjects.length > MAX_PROJECT_ROWS) {
    return NextResponse.json(
      { error: `Too many project rows (${parsedProjects.length}). Max ${MAX_PROJECT_ROWS} per import.` },
      { status: 400 }
    );
  }

  // Resolve against existing projects; create the missing ones.
  const { data: existingProjects, error: projectsFetchError } = await db.from("projects").select("id, name");
  if (projectsFetchError) {
    return NextResponse.json({ error: projectsFetchError.message }, { status: 500 });
  }

  const projectIdByName = new Map<string, string>();
  for (const p of existingProjects ?? []) {
    projectIdByName.set(p.name.trim().toLowerCase(), p.id);
  }

  let projectsReused = 0;
  const toCreate = parsedProjects.filter((p) => {
    const existing = projectIdByName.get(p.name.trim().toLowerCase());
    if (existing) {
      projectsReused += 1;
      return false;
    }
    return true;
  });

  let projectsCreated = 0;
  if (toCreate.length > 0) {
    const { data: inserted, error: insertError } = await db
      .from("projects")
      .insert(
        toCreate.map((p) => ({
          name: p.name,
          description: p.description,
          status: p.status,
          start_date: p.start_date,
          end_date: p.end_date,
          percent_complete: 0,
          accent_color: p.accent_color,
          icon: p.icon,
          default_view: p.default_view,
          archived_at: p.status === "archived" ? new Date().toISOString() : null,
          owner_id: auth.id,
          created_by: auth.id,
        }))
      )
      .select("id, name");

    if (insertError) {
      return NextResponse.json({ error: `Project import failed: ${insertError.message}` }, { status: 500 });
    }

    for (const p of inserted ?? []) {
      projectIdByName.set(p.name.trim().toLowerCase(), p.id);
    }
    projectsCreated = inserted?.length ?? 0;
  }

  /* --------------------------------- users ------------------------------- */

  const parsedTasks: ParsedTask[] = [];
  for (let i = 0; i < (taskSheet?.records.length ?? 0); i++) {
    const rec = taskSheet!.records[i];
    const row = taskSheet!.rowNumbers[i];
    if (isSample(rec.title)) continue;

    if (!rec.title) {
      errors.push({ sheet: TASK_SHEET, row, message: "Title is required — row skipped." });
      continue;
    }

    const start = parseDate(rec.start_date);
    if (start.error) errors.push({ sheet: TASK_SHEET, row, message: `Start Date: ${start.error}.` });
    const due = parseDate(rec.due_date);
    if (due.error) errors.push({ sheet: TASK_SHEET, row, message: `Due Date: ${due.error}.` });
    if (start.error || due.error) continue;

    let duration: number | null = null;
    if (rec.duration_days) {
      duration = parseWholeNumber(rec.duration_days, 0, 100000);
      if (duration == null) {
        errors.push({ sheet: TASK_SHEET, row, message: `Duration Days "${rec.duration_days}" must be a whole number ≥ 0 — row skipped.` });
        continue;
      }
    }

    let percent = rec.percent_complete ? parseWholeNumber(rec.percent_complete, 0, 100) : null;
    if (rec.percent_complete && percent == null) {
      errors.push({ sheet: TASK_SHEET, row, message: `Percent Complete "${rec.percent_complete}" must be 0–100 — row skipped.` });
      continue;
    }

    let priority = (rec.priority || "medium").toLowerCase();
    if (!TASK_PRIORITIES.includes(priority)) {
      warnings.push({ sheet: TASK_SHEET, row, message: `Unknown priority "${rec.priority}" — using "medium".` });
      priority = "medium";
    }

    // Status resolution needs the target project's custom statuses; store the
    // raw value now and resolve after we know the project id.
    const statusRaw = rec.status.trim();

    const dueDate = due.date ?? calculateDueDate(start.date, duration);

    parsedTasks.push({
      row,
      title: rec.title,
      projectName: rec.project,
      parentTitle: rec.parent,
      description: rec.description,
      status: statusRaw,
      priority,
      assigneeName: rec.assignee,
      start_date: start.date,
      due_date: dueDate,
      duration_days: duration,
      percent_complete: percent ?? (normalizeKey(statusRaw) === "done" ? 100 : 0),
      tags: rec.tags
        ? rec.tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean)
        : [],
    });
  }

  if (parsedTasks.length > MAX_TASK_ROWS) {
    return NextResponse.json(
      { error: `Too many task rows (${parsedTasks.length}). Max ${MAX_TASK_ROWS} per import.` },
      { status: 400 }
    );
  }

  // Users for assignee resolution.
  const { data: users } = await db.from("users").select("id, username, name");
  const userIdByName = new Map<string, string>();
  for (const u of users ?? []) {
    userIdByName.set(u.username.trim().toLowerCase(), u.id);
    if (u.name) userIdByName.set(u.name.trim().toLowerCase(), u.id);
  }

  // Custom statuses for every referenced project (one query).
  const referencedProjectIds = new Set<string>();
  for (const t of parsedTasks) {
    if (!t.projectName) continue;
    const id = projectIdByName.get(t.projectName.trim().toLowerCase());
    if (!id) {
      errors.push({
        sheet: TASK_SHEET,
        row: t.row,
        message: `Project "${t.projectName}" not found — add it to the Projects sheet or create it first. Row skipped.`,
      });
      (t as ParsedTask & { skip?: boolean }).skip = true;
      continue;
    }
    referencedProjectIds.add(id);
  }

  const statusKeysByProject = new Map<string, Map<string, string>>(); // projectId -> normalized key/name -> key
  if (referencedProjectIds.size > 0) {
    const { data: statuses } = await db
      .from("project_statuses")
      .select("project_id, key, name")
      .in("project_id", [...referencedProjectIds]);
    for (const s of statuses ?? []) {
      const map = statusKeysByProject.get(s.project_id) ?? new Map<string, string>();
      map.set(normalizeKey(s.key), s.key);
      map.set(normalizeKey(s.name), s.key);
      statusKeysByProject.set(s.project_id, map);
    }
  }

  const defaultStatusKeys = new Map(TASK_STATUS_KEYS.map((k) => [normalizeKey(k), k]));
  defaultStatusKeys.set("to_do", "todo");

  const tasksToInsert: Array<Record<string, unknown>> = [];
  const taskMeta: Array<{ row: number; title: string; projectId: string | null; parentTitle: string }> = [];
  const sortCounter = new Map<string, number>();

  for (const t of parsedTasks as Array<ParsedTask & { skip?: boolean }>) {
    if (t.skip) continue;

    const projectId = t.projectName
      ? projectIdByName.get(t.projectName.trim().toLowerCase()) ?? null
      : null;

    // Resolve status: default keys/labels first, then project custom statuses.
    let status = "todo";
    if (t.status) {
      const normalized = normalizeKey(t.status);
      const custom = projectId ? statusKeysByProject.get(projectId) : undefined;
      if (defaultStatusKeys.has(normalized)) {
        status = defaultStatusKeys.get(normalized)!;
      } else if (custom?.has(normalized)) {
        status = custom.get(normalized)!;
      } else {
        warnings.push({ sheet: TASK_SHEET, row: t.row, message: `Unknown status "${t.status}" — using "todo".` });
      }
    }

    // Resolve assignee (soft-fail to unassigned).
    let assigneeId: string | null = null;
    if (t.assigneeName) {
      assigneeId = userIdByName.get(t.assigneeName.trim().toLowerCase()) ?? null;
      if (!assigneeId) {
        warnings.push({ sheet: TASK_SHEET, row: t.row, message: `Assignee "${t.assigneeName}" not found — left unassigned.` });
      }
    }

    const scopeKey = projectId ?? "";
    const sortOrder = sortCounter.get(scopeKey) ?? 0;
    sortCounter.set(scopeKey, sortOrder + 1);

    tasksToInsert.push({
      title: t.title,
      description: t.description,
      status,
      priority: t.priority,
      assignee_id: assigneeId,
      start_date: t.start_date,
      due_date: t.due_date,
      project_id: projectId,
      parent_task_id: null, // resolved in pass 2
      sort_order: sortOrder,
      tags: t.tags,
      duration_days: t.duration_days,
      percent_complete: status === "done" && t.percent_complete === 0 ? 100 : t.percent_complete,
      created_by: auth.id,
    });
    taskMeta.push({ row: t.row, title: t.title, projectId, parentTitle: t.parentTitle });
  }

  let tasksCreated = 0;
  const createdTaskIds: string[] = [];

  if (tasksToInsert.length > 0) {
    // Chunk inserts to stay well under PostgREST payload limits.
    const CHUNK = 200;
    for (let i = 0; i < tasksToInsert.length; i += CHUNK) {
      const chunk = tasksToInsert.slice(i, i + CHUNK);
      const { data: inserted, error: insertError } = await db
        .from("tasks")
        .insert(chunk)
        .select("id");

      if (insertError) {
        return NextResponse.json(
          {
            error: `Task import failed at rows ${i + 1}–${i + chunk.length}: ${insertError.message}`,
            summary: { projectsCreated, projectsReused, tasksCreated },
            errors,
            warnings,
          },
          { status: 500 }
        );
      }
      for (const row of inserted ?? []) createdTaskIds.push(row.id);
    }
    tasksCreated = createdTaskIds.length;
  }

  /* ---------------------- pass 2: parent resolution ---------------------- */

  const parentRequests = taskMeta
    .map((m, i) => ({ ...m, taskId: createdTaskIds[i] }))
    .filter((m) => m.taskId && m.parentTitle);

  if (parentRequests.length > 0) {
    // Existing tasks in the referenced scopes + the tasks we just created.
    const scopeProjectIds = [...new Set(parentRequests.map((m) => m.projectId).filter((v): v is string => !!v))];
    const needsStandalone = parentRequests.some((m) => !m.projectId);

    const existingTaskQueries = [];
    if (scopeProjectIds.length > 0) {
      existingTaskQueries.push(db.from("tasks").select("id, title, project_id").in("project_id", scopeProjectIds));
    }
    if (needsStandalone) {
      existingTaskQueries.push(db.from("tasks").select("id, title, project_id").is("project_id", null));
    }
    const existingResults = await Promise.all(existingTaskQueries);

    const taskIdByScopeAndTitle = new Map<string, string>();
    for (const res of existingResults) {
      for (const t of res.data ?? []) {
        const key = `${t.project_id ?? ""}::${String(t.title).trim().toLowerCase()}`;
        if (!taskIdByScopeAndTitle.has(key)) taskIdByScopeAndTitle.set(key, t.id);
      }
    }
    // Newly created tasks can be parents of rows below them.
    for (let i = 0; i < taskMeta.length; i++) {
      const id = createdTaskIds[i];
      if (!id) continue;
      const key = `${taskMeta[i].projectId ?? ""}::${taskMeta[i].title.trim().toLowerCase()}`;
      if (!taskIdByScopeAndTitle.has(key)) taskIdByScopeAndTitle.set(key, id);
    }

    const parentUpdates: Array<PromiseLike<unknown>> = [];
    for (const req of parentRequests) {
      const key = `${req.projectId ?? ""}::${req.parentTitle.trim().toLowerCase()}`;
      const parentId = taskIdByScopeAndTitle.get(key);
      if (!parentId) {
        warnings.push({ sheet: TASK_SHEET, row: req.row, message: `Parent task "${req.parentTitle}" not found — created as a top-level task.` });
        continue;
      }
      if (parentId === req.taskId) {
        warnings.push({ sheet: TASK_SHEET, row: req.row, message: "A task cannot be its own parent — created as a top-level task." });
        continue;
      }
      parentUpdates.push(db.from("tasks").update({ parent_task_id: parentId }).eq("id", req.taskId));
    }
    await Promise.all(parentUpdates);
  }

  // One batched activity entry per created task (mirrors the single-create flow).
  if (createdTaskIds.length > 0) {
    void db.from("task_activity").insert(
      createdTaskIds.map((id) => ({
        task_id: id,
        user_id: auth.id,
        action: "created",
        details: "imported the task from Excel",
      }))
    );
  }

  return NextResponse.json({
    summary: { projectsCreated, projectsReused, tasksCreated },
    errors,
    warnings,
  });
}
