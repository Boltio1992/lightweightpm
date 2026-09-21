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
  const raw = text(value);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}
function duration(value: unknown) {
  const raw = text(value).toLowerCase();
  if (!raw) return null;
  const match = raw.match(/-?\d+(?:\.\d+)?/);
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

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const form = await req.formData();
  const file = form.get("file");
  const projectId = text(form.get("project_id"));
  if (!(file instanceof File)) return NextResponse.json({ error: "A CSV or Excel file is required." }, { status: 400 });
  if (!projectId) return NextResponse.json({ error: "Choose a project before importing." }, { status: 400 });
  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) return NextResponse.json({ error: "Only CSV, XLSX, and XLS files are supported." }, { status: 400 });

  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (rows.length > 500) return NextResponse.json({ error: "Import is limited to 500 tasks." }, { status: 400 });
  if (!rows.length) return NextResponse.json({ error: "The file contains no data rows." }, { status: 400 });

  const aliases: Record<string, string[]> = {
    title: ["Task Name", "task", "name"], duration: ["Duration"], start: ["Start date", "Start"], due: ["End date", "Due"], complete: ["% Complete", "percent_complete"]
  };
  const key = (row: Record<string, unknown>, names: string[]) => {
    const found = Object.keys(row).find(k => names.some(n => k.trim().toLowerCase() === n.toLowerCase()));
    return found ? row[found] : "";
  };
  const parsed = rows.map((row, index) => {
    const title = text(key(row, aliases.title));
    const start = dateValue(key(row, aliases.start));
    const due = dateValue(key(row, aliases.due));
    const days = duration(key(row, aliases.duration));
    const complete = percent(key(row, aliases.complete));
    const errors = [] as string[];
    if (!title) errors.push("Task Name is required");
    if (key(row, aliases.start) && !start) errors.push("invalid Start date");
    if (key(row, aliases.due) && !due) errors.push("invalid End date");
    if (key(row, aliases.duration) && days == null) errors.push("invalid Duration");
    if (complete == null) errors.push("% Complete must be between 0 and 100");
    return { index: index + 2, title, start, due, days, complete: complete ?? 0, errors };
  });
  const invalid = parsed.filter(r => r.errors.length);
  if (invalid.length) return NextResponse.json({ error: invalid.map(r => `Row ${r.index}: ${r.errors.join(", ")}`).join("; ") }, { status: 400 });

  const db = supabaseAdmin();
  const { data: project } = await db.from("projects").select("id").eq("id", projectId).single();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const inserts = parsed.map(r => ({ title: r.title, project_id: projectId, start_date: r.start, due_date: r.due, duration_days: r.days, percent_complete: r.complete, status: r.complete === 100 ? "done" : r.complete === 0 ? "todo" : "in_progress", created_by: auth.id }));
  const { error } = await db.from("tasks").insert(inserts);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: inserts.length });
}
