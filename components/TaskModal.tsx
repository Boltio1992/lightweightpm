"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import { api, calculateDueDate } from "@/lib/api";
import type { Task, UserPublic } from "@/types";

export default function TaskModal({ open, onClose, onSaved, task, projectId, parentTaskId, assignableUsers }: { open: boolean; onClose: () => void; onSaved: () => void; task?: Task | null; projectId?: string | null; parentTaskId?: string | null; assignableUsers: UserPublic[]; }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [percentComplete, setPercentComplete] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calculatedDueDate, setCalculatedDueDate] = useState<string | null>(null);

  useEffect(() => {
    const calculated = calculateDueDate(startDate, durationDays ? Number(durationDays) : null);
    setCalculatedDueDate(calculated);
  }, [startDate, durationDays]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setStatus(task?.status ?? "todo");
    setPriority(task?.priority ?? "medium");
    setAssigneeId(task?.assignee_id ?? "");
    setStartDate(task?.start_date ?? "");
    setDueDate(task?.due_date ?? "");
    setDurationDays(task?.duration_days == null ? "" : String(task.duration_days));
    setPercentComplete(String(task?.percent_complete ?? 0));
  }, [open, task]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      title,
      description,
      status,
      priority,
      assignee_id: assigneeId || null,
      start_date: startDate || null,
      due_date: dueDate || null,
      duration_days: durationDays === "" ? null : Number(durationDays),
      percent_complete: Number(percentComplete),
      project_id: task ? task.project_id : projectId ?? null,
      parent_task_id: task ? task.parent_task_id : parentTaskId ?? null,
    };

    try {
      await api(task ? `/api/tasks/${task.id}` : "/api/tasks", {
        method: task ? "PATCH" : "POST",
        json: payload,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const heading = task ? "Edit task" : parentTaskId ? "New sub-task" : projectId ? "New project task" : "New task";
  return (
    <Modal open={open} onClose={onClose} title={heading}>
      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" autoFocus required />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[72px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Assignee</label>
          <select className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Unassigned</option>
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.username}
                {u.title ? ` · ${u.title}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Duration (days)</label>
            <input type="number" min="0" step="1" className="input" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
          </div>
          <div>
            <label className="label">% Complete</label>
            <input type="number" min="0" max="100" step="1" className="input" value={percentComplete} onChange={(e) => setPercentComplete(e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start</label>
            <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Due</label>
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            {calculatedDueDate && !dueDate && (
              <p className="mt-1 text-xs text-muted">Auto-calculated: {new Date(calculatedDueDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
            )}
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn">Cancel</button>
          <button className="btn-primary" disabled={saving}>{saving ? "Saving…" : task ? "Save changes" : "Create task"}</button>
        </div>
      </form>
    </Modal>
  );
}
