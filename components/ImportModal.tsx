"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { emitTasksChanged } from "@/lib/api";

type ImportIssue = { sheet: string; row: number; message: string };

type ImportResult = {
  summary: { projectsCreated: number; projectsReused: number; tasksCreated: number };
  errors: ImportIssue[];
  warnings: ImportIssue[];
};

export default function ImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state every time the modal opens.
  useEffect(() => {
    if (open) {
      setFile(null);
      setUploading(false);
      setFatal(null);
      setResult(null);
    }
  }, [open]);

  async function upload() {
    if (!file || uploading) return;
    setUploading(true);
    setFatal(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!res.ok) {
        // Partial results may still be present (e.g. tasks failed after projects imported).
        if (data.summary) setResult(data as ImportResult);
        setFatal(data.error || "Import failed.");
        return;
      }

      const importResult = data as ImportResult;
      setResult(importResult);
      if (importResult.summary.tasksCreated > 0) emitTasksChanged();
      onImported?.();
    } catch {
      setFatal("Network error while uploading. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const imported =
    result && (result.summary.projectsCreated > 0 || result.summary.tasksCreated > 0);

  return (
    <Modal open={open} onClose={onClose} title="Import from Excel" width="max-w-lg">
      <div className="space-y-4">
        {/* Step 1: template */}
        <div className="rounded-lg border border-line bg-subtle/50 p-3.5">
          <p className="text-sm font-semibold text-ink">1 · Download the template</p>
          <p className="mt-1 text-xs text-muted">
            One sheet for projects, one for tasks, plus a reference sheet explaining every column.
            Rows starting with <code className="rounded bg-subtle px-1">SAMPLE -</code> are ignored.
          </p>
          <a href="/api/import/template" download className="btn mt-2.5">
            ⬇ Download template (.xlsx)
          </a>
        </div>

        {/* Step 2: upload */}
        <div className="rounded-lg border border-line bg-subtle/50 p-3.5">
          <p className="text-sm font-semibold text-ink">2 · Upload the filled file</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setFatal(null);
              setResult(null);
            }}
            className="mt-2.5 block w-full text-xs text-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-subtle"
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={upload}
              disabled={!file || uploading}
              className="btn-primary tap flex-1 sm:flex-none"
            >
              {uploading ? "Importing…" : "Import"}
            </button>
            {file && !uploading && (
              <span className="truncate text-xs text-muted">{file.name}</span>
            )}
          </div>
        </div>

        {fatal && <p className="text-sm text-danger">{fatal}</p>}

        {/* Result */}
        {result && (
          <div className="space-y-3">
            <div
              className={`rounded-lg border p-3.5 text-sm ${
                result.errors.length > 0
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-900"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-900"
              }`}
            >
              {imported ? (
                <p className="font-medium">
                  Imported {result.summary.projectsCreated} new project
                  {result.summary.projectsCreated === 1 ? "" : "s"}
                  {result.summary.projectsReused > 0 &&
                    ` (matched ${result.summary.projectsReused} existing)`}
                  {" and "}
                  {result.summary.tasksCreated} task{result.summary.tasksCreated === 1 ? "" : "s"}.
                </p>
              ) : (
                <p className="font-medium">Nothing was imported.</p>
              )}
              {result.errors.length > 0 && (
                <p className="mt-0.5 text-xs">
                  {result.errors.length} row{result.errors.length === 1 ? "" : "s"} had errors and
                  were skipped — fix them and import again.
                </p>
              )}
            </div>

            {result.errors.length > 0 && (
              <IssueList title="Errors" tone="danger" issues={result.errors} />
            )}
            {result.warnings.length > 0 && (
              <IssueList title="Warnings" tone="warning" issues={result.warnings} />
            )}

            <div className="sheet-actions">
              <button type="button" onClick={onClose} className="btn-primary tap w-full sm:w-auto">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function IssueList({
  title,
  tone,
  issues,
}: {
  title: string;
  tone: "danger" | "warning";
  issues: ImportIssue[];
}) {
  const color = tone === "danger" ? "text-danger" : "text-amber-700";
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide ${color}`}>
        {title} ({issues.length})
      </p>
      <ul className="mt-1.5 max-h-44 space-y-1 overflow-y-auto rounded-md border border-line bg-white p-2.5 text-xs text-ink">
        {issues.map((issue, i) => (
          <li key={i}>
            <span className="font-medium text-muted">
              {issue.sheet} · row {issue.row}
            </span>{" "}
            — {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
