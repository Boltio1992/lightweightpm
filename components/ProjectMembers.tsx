"use client";

import { useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/api";
import type { ProjectMember, UserPublic } from "@/types";

export default function ProjectMembers({
  projectId,
  onChanged,
}: {
  projectId: string;
  onChanged?: () => void;
}) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserPublic[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // manual "data member" form (name/title/role typed in directly)
  const [mName, setMName] = useState("");
  const [mTitle, setMTitle] = useState("");
  const [mRole, setMRole] = useState("member");
  const [adding, setAdding] = useState(false);

  async function load() {
    const data = await api<{ members: ProjectMember[] }>(`/api/projects/${projectId}/members`);
    setMembers(data.members ?? []);
    onChanged?.();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // debounced user search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const data = await api<{ users: UserPublic[] }>(
          `/api/users?q=${encodeURIComponent(query.trim())}`
        );
        const existing = new Set(members.map((m) => m.user_id));
        setResults((data.users ?? []).filter((u) => !existing.has(u.id)));
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, members]);

  async function addRegistered(user: UserPublic) {
    setError(null);
    try {
      await api(`/api/projects/${projectId}/members`, {
        method: "POST",
        json: { user_id: user.id, role: user.role || "member" },
      });
      setQuery("");
      setResults([]);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  // "Data member": creates a placeholder user record from typed-in details so
  // the person can be assigned tasks even if they never log in themselves.
  async function addDataMember(e: React.FormEvent) {
    e.preventDefault();
    if (!mName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await api(`/api/projects/${projectId}/members/manual`, {
        method: "POST",
        json: { name: mName.trim(), title: mTitle.trim(), role: mRole.trim() || "member" },
      });
      setMName("");
      setMTitle("");
      setMRole("member");
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function remove(memberId: string) {
    if (!confirm("Remove this member from the project?")) return;
    await api(`/api/projects/${projectId}/members/${memberId}`, { method: "DELETE" }).catch(() => {});
    await load();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card overflow-hidden">
        <div className="border-b border-line bg-subtle px-4 py-2 text-xs font-medium text-muted">
          Members ({members.length})
        </div>
        {members.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted">No members yet.</p>
        )}
        {members.map((m) => (
          <div
            key={m.id}
            className="group flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 hover:bg-subtle"
          >
            <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
              {(m.user?.name || m.user?.username || "?").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">{m.user?.name || m.user?.username}</p>
              <p className="truncate text-xs text-muted">
                {m.user?.title || "—"} · {m.role}
              </p>
            </div>
            <span className="hidden text-xs text-muted sm:block">{fmtDate(m.added_at)}</span>
            <button
              onClick={() => remove(m.id)}
              className="flex-none rounded px-1.5 py-0.5 text-xs text-muted opacity-0 transition hover:text-danger group-hover:opacity-100"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-5">
        <div className="card p-4">
          <p className="mb-2 text-sm font-medium text-ink">Add a registered member</p>
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or username…"
          />
          {searching && <p className="mt-2 text-xs text-muted">Searching…</p>}
          {results.length > 0 && (
            <div className="mt-2 divide-y divide-line rounded-md border border-line">
              {results.map((u) => (
                <button
                  key={u.id}
                  onClick={() => addRegistered(u)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-subtle"
                >
                  <div className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-ink text-[10px] font-semibold text-white">
                    {(u.name || u.username).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{u.name || u.username}</p>
                    <p className="truncate text-xs text-muted">
                      @{u.username}
                      {u.title ? ` · ${u.title}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-accent">Add</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={addDataMember} className="card space-y-3 p-4">
          <div>
            <p className="text-sm font-medium text-ink">Add a data member</p>
            <p className="mt-0.5 text-xs text-muted">
              For people who don&apos;t log in. They can still be assigned tasks.
            </p>
          </div>
          <div>
            <label className="label">Name</label>
            <input className="input" value={mName} onChange={(e) => setMName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Title</label>
              <input className="input" value={mTitle} onChange={(e) => setMTitle(e.target.value)} />
            </div>
            <div>
              <label className="label">Role</label>
              <input className="input" value={mRole} onChange={(e) => setMRole(e.target.value)} />
            </div>
          </div>
          <button className="btn-primary w-full" disabled={adding}>
            {adding ? "Adding…" : "Add data member"}
          </button>
        </form>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
