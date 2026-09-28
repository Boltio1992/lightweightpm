import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireUser } from "@/lib/requireUser";
import {
  PROJECT_HEADERS,
  PROJECT_SHEET,
  REFERENCE_ROWS,
  REFERENCE_SHEET,
  SAMPLE_PROJECT_ROW,
  SAMPLE_TASK_ROWS,
  TASK_HEADERS,
  TASK_SHEET,
} from "@/lib/importConfig";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const wb = XLSX.utils.book_new();

  const projectsSheet = XLSX.utils.aoa_to_sheet([PROJECT_HEADERS, SAMPLE_PROJECT_ROW]);
  projectsSheet["!cols"] = PROJECT_HEADERS.map((h) => ({ wch: Math.max(16, h.length + 6) }));
  XLSX.utils.book_append_sheet(wb, projectsSheet, PROJECT_SHEET);

  const tasksSheet = XLSX.utils.aoa_to_sheet([TASK_HEADERS, ...SAMPLE_TASK_ROWS]);
  tasksSheet["!cols"] = TASK_HEADERS.map((h) => ({ wch: Math.max(16, h.length + 6) }));
  XLSX.utils.book_append_sheet(wb, tasksSheet, TASK_SHEET);

  const refSheet = XLSX.utils.aoa_to_sheet(REFERENCE_ROWS);
  refSheet["!cols"] = [{ wch: 26 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(wb, refSheet, REFERENCE_SHEET);

  const buffer: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="lightpm-import-template.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
