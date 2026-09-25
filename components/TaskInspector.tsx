"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, fmtDate, isOverdue } from "@/lib/api";
import { PriorityBadge } from "./Badges";
import type { ProjectMember, ProjectStatus, Task, TaskActivity, TaskComment, TaskPriority, UserPublic } from "@/types";

export default function TaskInspector({
  task,
  projectId,
  projectStatuses = [],
  members = [],
  assignableUsers = [],
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: {
  task: Task | null;
  projectId?: string | null;
  projectStatuses?: ProjectStatus[];
  members?: ProjectMember[];
  assignableUsers?: UserPublic[];
  onClose: () => void;
  onTaskUpdated: () => void;
  onTaskDeleted: (taskId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"details" | "comments" | "activity">("details");

  // Editable fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [percentComplete, setPercentComplete] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  // Subtasks
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);

  // Comments
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  // Activity
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadSubtasks = useCallback(async (taskId: string) => {
    try {
      const res = await api<{ tasks: Task[] }>(`/api/tasks?project_id=${projectId || ""}`);
      const subs = (res.tasks || []).filter((t) => t.parent_task_id === taskId);
      setSubtasks(subs);
    } catch {
      // fallback
    }
  }, [projectId]);

  const loadComments = useCallback(async (taskId: string) => {
    setLoadingComments(true);
    try {
      const res = await api<{ comments: TaskComment[] }>(`/api/tasks/${taskId}/comments`);
      setComments(res.comments || []);
    } catch {
      // fallback
    } finally {
      setLoadingComments(false);
    }
  }, []);

  const loadActivity = useCallback(async (taskId: string) => {
    setLoadingActivity(true);
    try {
      const res = await api<{ activity: TaskActivity[] }>(`/api/tasks/${taskId}/activity`);
      setActivities(res.activity || []);
    } catch {
      // fallback
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  // Reset when selected task changes
  useEffect(() => {
    if (!task) return;
    setTitle(task.title || "");
    setDescription(task.description || "");
    setStatus(task.status || "todo");
    setPriority(task.priority || "medium");
    setAssigneeId(task.assignee_id || "");
    setStartDate(task.start_date || "");
    setDueDate(task.due_date || "");
    setDurationDays(task.duration_days == null ? "" : String(task.duration_days));
    setPercentComplete(task.percent_complete ?? 0);
    setTags(task.tags || []);
    setShowTagInput(false);

    loadSubtasks(task.id);
    loadComments(task.id);
    loadActivity(task.id);
  }, [task, loadSubtasks, loadComments, loadActivity]);

  async function saveField(fieldName: string, value: any) {
    if (!task) return;
    setSaving(true);
    try {
      await api(`/api/tasks/${task.id}`, {
        method: "PATCH",
        json: { [fieldName]: value },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1200);
      onTaskUpdated();
      loadActivity(task.id);
    } catch (err: any) {
      alert(err.message || "Failed to update task");
    } finally {
      setSaving(false);
    }
  }

  async function saveAll() {
    if (!task) return;
    setSaving(true);
    try {
      await api(`/api/tasks/${task.id}`, {
        method: "PATCH",
        json: {
          title: title.trim(),
          description,
          status,
          priority,
          assignee_id: assigneeId || null,
          start_date: startDate || null,
          due_date: dueDate || null,
          duration_days: durationDays ? Number(durationDays) : null,
          percent_complete: percentComplete,
          tags,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1200);
      onTaskUpdated();
      loadActivity(task.id);
    } catch (err: any) {
      alert(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSubtask(e: React.FormEvent) {
    e.preventDefault();
    if (!task || !newSubtaskTitle.trim()) return;
    setAddingSubtask(true);
    try {
      await api("/api/tasks", {
        method: "POST",
        json: {
          title: newSubtaskTitle.trim(),
          project_id: task.project_id,
          parent_task_id: task.id,
          status: "todo",
          priority: "medium",
        },
      });
      setNewSubtaskTitle("");
      await loadSubtasks(task.id);
      onTaskUpdated();
      loadActivity(task.id);
    } catch (err: any) {
      alert(err.message || "Failed to add subtask");
    } finally {
      setAddingSubtask(false);
    }
  }

  async function toggleSubtask(sub: Task) {
    const nextStatus = sub.status === "done" ? "todo" : "done";
    const nextPct = nextStatus === "done" ? 100 : 0;
    try {
      await api(`/api/tasks/${sub.id}`, {
        method: "PATCH",
        json: { status: nextStatus, percent_complete: nextPct },
      });
      if (task) await loadSubtasks(task.id);
      onTaskUpdated();
    } catch {
      // fallback
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!task || !newComment.trim()) return;
    setSubmittingComment(true);
    try {
      await api(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        json: { content: newComment.trim() },
      });
      setNewComment("");
      await loadComments(task.id);
      await loadActivity(task.id);
    } catch (err: any) {
      alert(err.message || "Failed to post comment");
    } finally {
      setSubmittingComment(false);
    }
  }

  function addTag(e: React.KeyboardEvent | React.MouseEvent) {
    if ("key" in e && e.key !== "Enter") return;
    e.preventDefault();
    const clean = newTagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!clean || tags.includes(clean)) return;
    const next = [...tags, clean];
    setTags(next);
    setNewTagInput("");
    setShowTagInput(false);
    saveField("tags", next);
  }

  function removeTag(tagToRemove: string) {
    const next = tags.filter((t) => t !== tagToRemove);
    setTags(next);
    saveField("tags", next);
  }

  async function deleteTask() {
    if (!task) return;
    if (!confirm(`Delete "${task.title}" and its subtasks?`)) return;
    try {
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      onTaskDeleted(task.id);
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to delete task");
    }
  }

  if (!task) return null;

  const currentStatusObj = projectStatuses.find((s) => s.key === status);
  const statusColor = currentStatusObj?.color || (status === "done" ? "#10B981" : status === "in_progress" ? "#12A594" : status === "blocked" ? "#EF4444" : "#94A3B8");
  const overdue = isOverdue(task);
  const doneSubtasksCount = subtasks.filter((s) => s.status === "done").length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/25 backdrop-blur-xs transition">
        <motion.div
          initial={{ x: "100%", opacity: 0.8 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 350 }}
          className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between border-b border-line px-6 py-3.5 bg-subtle/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted font-mono">
                {task.parent_task_id ? "Sub-Task" : "Task Inspector"}
              </span>
              {saveSuccess && (
                <span className="rounded bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium animate-pulse">
                  Saved
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={deleteTask}
                className="text-xs text-muted hover:text-danger p-1 rounded"
                title="Delete task"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-muted hover:bg-subtle hover:text-ink transition"
                aria-label="Close inspector"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Quick Header Controls */}
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-3 bg-white">
            {/* Status Select */}
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full flex-none" style={{ backgroundColor: statusColor }} />
              <select
                className="text-xs font-medium bg-transparent border-0 text-ink cursor-pointer focus:ring-0 p-0"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  saveField("status", e.target.value);
                }}
              >
                {projectStatuses.length > 0
                  ? projectStatuses.map((s) => (
                      <option key={s.id} value={s.key}>
                        {s.name}
                      </option>
                    ))
                  : [
                      <option key="todo" value="todo">To Do</option>,
                      <option key="in_progress" value="in_progress">In Progress</option>,
                      <option key="review" value="review">Review</option>,
                      <option key="blocked" value="blocked">Blocked</option>,
                      <option key="done" value="done">Done</option>,
                    ]}
              </select>
            </div>

            <div className="h-4 w-px bg-line" />

            {/* Priority Select */}
            <div className="flex items-center gap-1">
              <PriorityBadge priority={priority} />
              <select
                className="text-xs bg-transparent border-0 text-muted cursor-pointer focus:ring-0 p-0 capitalize"
                value={priority}
                onChange={(e) => {
                  const p = e.target.value as TaskPriority;
                  setPriority(p);
                  saveField("priority", p);
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="h-4 w-px bg-line" />

            {/* Assignee Avatar / Select */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted">Assignee:</span>
              <select
                className="text-xs bg-transparent border-0 text-ink cursor-pointer focus:ring-0 p-0 font-medium"
                value={assigneeId}
                onChange={(e) => {
                  setAssigneeId(e.target.value);
                  saveField("assignee_id", e.target.value || null);
                }}
              >
                <option value="">Unassigned</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.username} {u.title ? `(${u.title})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-line px-6 bg-white">
            <button
              onClick={() => setActiveTab("details")}
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition ${
                activeTab === "details" ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              Task Details
            </button>
            <button
              onClick={() => setActiveTab("comments")}
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition ${
                activeTab === "comments" ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              Comments ({comments.length})
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition ${
                activeTab === "activity" ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              Activity Log ({activities.length})
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {activeTab === "details" && (
              <>
                {/* Editable Title */}
                <div>
                  <textarea
                    rows={1}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => saveField("title", title.trim())}
                    placeholder="Task title…"
                    className="w-full text-lg font-semibold text-ink resize-none border-0 focus:outline-none focus:ring-0 p-0 placeholder:text-muted"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted">Description</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={() => saveField("description", description)}
                    placeholder="Add details, requirements or context…"
                    className="mt-1 w-full rounded-md border border-line p-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                </div>

                {/* Progress bar + slider */}
                <div className="card p-3.5 space-y-2 bg-subtle/30">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-ink">Completion Progress</span>
                    <span className="font-semibold text-accent">{percentComplete}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-300"
                      style={{ width: `${percentComplete}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={percentComplete}
                    onChange={(e) => setPercentComplete(Number(e.target.value))}
                    onMouseUp={() => saveField("percent_complete", percentComplete)}
                    onTouchEnd={() => saveField("percent_complete", percentComplete)}
                    className="w-full accent-accent cursor-pointer"
                  />
                </div>

                {/* Date Fields & Duration */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Start date</label>
                    <input
                      type="date"
                      className="input text-xs"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        saveField("start_date", e.target.value || null);
                      }}
                    />
                  </div>
                  <div>
                    <label className="label">
                      Due date {overdue && <span className="text-danger font-semibold">(Overdue)</span>}
                    </label>
                    <input
                      type="date"
                      className="input text-xs"
                      value={dueDate}
                      onChange={(e) => {
                        setDueDate(e.target.value);
                        saveField("due_date", e.target.value || null);
                      }}
                    />
                  </div>
                </div>

                {/* Tags / Labels */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted">Tags & Labels</label>
                    {!showTagInput && (
                      <button
                        type="button"
                        onClick={() => setShowTagInput(true)}
                        className="text-xs text-accent hover:underline"
                      >
                        + Add Tag
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-md bg-subtle px-2 py-0.5 text-xs font-medium text-ink border border-line"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => removeTag(t)}
                          className="text-muted hover:text-danger ml-0.5"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {showTagInput && (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={addTag}
                          placeholder="tag name…"
                          className="h-6 w-24 rounded border border-line px-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                        />
                        <button type="button" onClick={addTag} className="text-xs text-accent font-medium">
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowTagInput(false)}
                          className="text-xs text-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {tags.length === 0 && !showTagInput && (
                      <span className="text-xs text-muted italic">No tags assigned</span>
                    )}
                  </div>
                </div>

                {/* Subtasks Checklist */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Sub-Tasks</h4>
                      {subtasks.length > 0 && (
                        <p className="text-xs text-muted mt-0.5">
                          {doneSubtasksCount} of {subtasks.length} completed
                        </p>
                      )}
                    </div>
                  </div>

                  {subtasks.length > 0 && (
                    <div className="divide-y divide-line rounded-lg border border-line bg-subtle/30">
                      {subtasks.map((sub) => (
                        <div key={sub.id} className="flex items-center gap-2.5 p-2.5 hover:bg-white transition">
                          <input
                            type="checkbox"
                            checked={sub.status === "done"}
                            onChange={() => toggleSubtask(sub)}
                            className="h-4 w-4 rounded border-line text-accent cursor-pointer"
                          />
                          <span
                            className={`flex-1 text-xs truncate ${
                              sub.status === "done" ? "line-through text-muted" : "text-ink font-medium"
                            }`}
                          >
                            {sub.title}
                          </span>
                          <PriorityBadge priority={sub.priority} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick Add Subtask Input */}
                  <form onSubmit={handleAddSubtask} className="flex gap-2">
                    <input
                      className="input text-xs py-1.5 flex-1"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="+ Add a subtask (press Enter)"
                      disabled={addingSubtask}
                    />
                    <button
                      type="submit"
                      disabled={addingSubtask || !newSubtaskTitle.trim()}
                      className="btn text-xs py-1.5 px-3"
                    >
                      {addingSubtask ? "Adding…" : "Add"}
                    </button>
                  </form>
                </div>
              </>
            )}

            {/* TAB: COMMENTS */}
            {activeTab === "comments" && (
              <div className="space-y-4">
                <div className="space-y-3">
                  {loadingComments ? (
                    <p className="text-xs text-muted">Loading comments…</p>
                  ) : comments.length === 0 ? (
                    <p className="text-xs text-muted italic text-center py-6">
                      No comments yet. Start the discussion below!
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="p-3 rounded-lg border border-line bg-subtle/30 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-ink">
                            {c.user?.name || c.user?.username || "Collaborator"}
                          </span>
                          <span className="text-muted text-[11px]">{fmtDate(c.created_at)}</span>
                        </div>
                        <p className="text-xs text-ink whitespace-pre-wrap">{c.content}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddComment} className="space-y-2 pt-2 border-t border-line">
                  <textarea
                    rows={2}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment or update…"
                    className="w-full rounded-md border border-line p-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingComment || !newComment.trim()}
                      className="btn-primary text-xs py-1.5 px-3"
                    >
                      {submittingComment ? "Posting…" : "Post Comment"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB: ACTIVITY */}
            {activeTab === "activity" && (
              <div className="space-y-3">
                {loadingActivity ? (
                  <p className="text-xs text-muted">Loading activity log…</p>
                ) : activities.length === 0 ? (
                  <p className="text-xs text-muted italic text-center py-6">No recorded activity yet.</p>
                ) : (
                  <div className="space-y-3 border-l-2 border-line ml-2 pl-3">
                    {activities.map((a) => (
                      <div key={a.id} className="text-xs space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-ink">
                            {a.user?.name || a.user?.username || "Teammate"}
                          </span>
                          <span className="text-muted text-[11px]">{fmtDate(a.created_at)}</span>
                        </div>
                        <p className="text-muted">
                          {a.details || a.action.replace(/_/g, " ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Save Button */}
          <div className="border-t border-line px-6 py-3 bg-subtle/50 flex items-center justify-between">
            <span className="text-xs text-muted">
              {saving ? "Saving changes…" : "Auto-saving on blur"}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="btn text-xs">
                Close
              </button>
              <button
                type="button"
                onClick={saveAll}
                disabled={saving}
                className="btn-primary text-xs"
              >
                {saving ? "Saving…" : "Save all changes"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
