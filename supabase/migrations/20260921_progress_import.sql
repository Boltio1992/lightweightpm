import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireUser } from "@/lib/requireUser";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function text(value: unknown) { return value == null ? "" : String(value).trim(); }
function dateValue(value: unknown) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : null;
  }
  const parsed = new Date(text(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}
function duration(value: unknown) {
  const match = text(value).match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const days = Number(match[0]);
  return Number.isFinite(days) && days >= 0 ? Math.round(days) : null;
}
function percent(value: unknown) {
  const raw = text(value).replace("%", "").trim();
  if (!raw) return 0;
  const n = Number(raw);
  const normalized = n <= 1 && !text(value).includes("%") ? n * 100 : n;
  return Number.isFinite(normalized) && normalized >= 0 && normalized <= 100 ? Math.round(normalized) : null;
}
function value(row: Record<string, unknown>, names: string[]) {
  const key = Object.keys(row).find((k) => names.some((name) => k.trim().toLowerCase() === name.toLowerCase()));
  return key ? row[key] : "";
}
function isMissingColumn(error: { message?: string } | null) {
  return /column .*does not exist|schema cache/i.test(error?.message ?? "");
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const form = await req.formData();
  const file = form.get("file");
  const projectId = text(form.get("project_id"));
  if (!(file instanceof File)) return NextResponse.json({ error: "A CSV or Excel file is required." }, { status: 400 });
  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) return NextResponse.json({ error: "Only CSV, XLSX, and XLS files are supported." }, { status: 400 });

  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (rows.length > 500) return NextResponse.json({ error: "Import is limited to 500 rows." }, { status: 400 });
  if (!rows.length) return NextResponse.json({ error: "The file contains no data rows." }, { status: 400 });

  const db = supabaseAdmin();

  if (!projectId) {
    const parsed = rows.map((row, index) => ({
      index: index + 2,
      name: text(value(row, ["name", "project", "project name", "project_name"])),
      description: text(value(row, ["description"])),
      status: text(value(row, ["status"])) || "active",
      start_date: dateValue(value(row, ["start_date", "start date", "start"])),
      end_date: dateValue(value(row, ["end_date", "end date", "end", "due"])),
    }));
    const invalid = parsed.filter((row) => !row.name);
    if (invalid.length) return NextResponse.json({ error: invalid.map((row) => `Row ${row.index}: Project name is required`).join("; ") }, { status: 400 });
    const { data: projects, error } = await db.from("projects").insert(parsed.map(({ name, description, status, start_date, end_date }) => ({ name, description, status, start_date, end_date, created_by: auth.id }))).select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (projects?.length) await db.from("project_members").insert(projects.map((project) => ({ project_id: project.id, user_id: auth.id, role: "owner" })));
    return NextResponse.json({ imported: projects?.length ?? 0, type: "projects" });
  }

  const { data: project } = await db.from("projects").select("id").eq("id", projectId).single();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const parsed = rows.map((row, index) => ({
    index: index + 2,
    title: text(value(row, ["Task Name", "task", "name", "title"])),
    start: dateValue(value(row, ["Start date", "start_date", "Start"])),
    due: dateValue(value(row, ["End date", "due_date", "Due"])),
    days: duration(value(row, ["Duration", "duration_days"])),
    complete: percent(value(row, ["% Complete", "percent_complete"])),
  }));

  const invalid = parsed.filter((row) => !row.title || row.complete == null);
  if (invalid.length) return NextResponse.json({ error: invalid.map((row) => `Row ${row.index}: ${!row.title ? "Task Name is required" : "% Complete must be between 0 and 100"}`).join("; ") }, { status: 400 });

  const modern = parsed.map((row) => ({
    title: row.title,
    project_id: projectId,
    start_date: row.start,
    due_date: row.due,
    duration_days: row.days,
    percent_complete: row.complete,
    status: row.complete === 100 ? "done" : row.complete === 0 ? "todo" : "in_progress",
    created_by: auth.id,
  }));

  let result = await db.from("tasks").insert(modern);

  if (result.error && isMissingColumn(result.error)) {
    const legacy = modern.map(({ title, project_id, start_date, due_date, status, created_by }) => ({
      title,
      project_id,
      start_date,
      due_date,
      status,
      created_by,
    }));
    result = await db.from("tasks").insert(legacy);
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ imported: modern.length, type: "tasks" });
}


