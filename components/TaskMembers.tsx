"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { TaskMember, UserPublic } from "@/types";

/**
 * People named on a task.
 *
 * Deliberately separate from the assignee: members answer "who is handling
 * this", the assignee answers "who owns it right now". A task can have members
 * and no assignee, which is the normal shape for project-less work.
 */
export default function TaskMembers({
  taskId,
  assignableUsers = [],
}: {
  taskId: string;
  assignableUsers?: UserPublic[];
}) {
  const [members, setMembers] = useState<TaskMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ members: TaskMember[] }>(`/api/tasks/${taskId}/members`);
      setMembers(data.members ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Could not load members");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const candidates = assignableUsers.filter((u) => !members.some((m) => m.user_id === u.id));

  async function add() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tasks/${taskId}/members`, {
        method: "POST",
        json: { user_id: picked, role: "member" },
      });
      setPicked("");
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Could not add that person");
    } finally {
      setBusy(false);
    }
  }

  async function setRole(memberId: string, role: string) {
    await api(`/api/tasks/${taskId}/members/${memberId}`, {
      method: "PATCH",
      json: { role },
    }).catch(() => {});
    await load();
  }

  async function remove(member: TaskMember) {
    const name = member.user?.name || member.user?.username || "this person";
    if (!confirm(`Remove ${name} from this task?`)) return;
    await api(`/api/tasks/${taskId}/members/${member.id}`, { method: "DELETE" }).catch(() => {});
    await load();
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-ink">
          Members{members.length > 0 ? ` (${members.length})` : ""}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Who is handling this. The assignee above is who owns it right now.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : members.length === 0 ? (
        <p className="text-xs text-muted italic">No members yet.</p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-md border border-line">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-3 py-2">
              <span className="avatar" aria-hidden="true">
                {(m.user?.name || m.user?.username || "?").slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-ink">
                {m.user?.name || m.user?.username || "Unknown"}
                {m.user?.title ? <span className="text-muted"> · {m.user.title}</span> : null}
              </span>
              <select
                value={m.role}
                onChange={(e) => setRole(m.id, e.target.value)}
                className="input w-auto flex-none py-1 text-xs"
                aria-label="Member role"
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={() => remove(m)}
                className="flex-none text-xs text-muted transition hover:text-danger"
                aria-label={`Remove ${m.user?.name || m.user?.username || "member"}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <select
          className="input flex-1 text-xs"
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          aria-label="Person to add"
        >
          <option value="">Add someone…</option>
          {candidates.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.username}
              {u.title ? ` — ${u.title}` : ""}
            </option>
          ))}
        </select>
        <button onClick={add} disabled={!picked || busy} className="btn tap flex-none text-xs">
          {busy ? "Adding…" : "Add"}
        </button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
