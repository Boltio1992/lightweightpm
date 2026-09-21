"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import type { UserPublic } from "@/types";

function ProfilePageInner() {
  const search = useSearchParams();
  const [user, setUser] = useState<UserPublic | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          setName(data.user.name || "");
          setTitle(data.user.title || "");
          setRole(data.user.role || "");
        }
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, title, role }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setUser(data.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <>
      <PageHeader title="Your profile" subtitle="This is how you appear across projects." />
      <div className="mx-auto max-w-lg px-8 py-8">
        {search.get("welcome") && (
          <div className="mb-6 rounded-md border border-line bg-subtle px-4 py-3 text-sm text-ink">
            Welcome to LightPM! Fill in your name, title and role so teammates can find you.
          </div>
        )}
        {user && (
          <form onSubmit={save} className="card space-y-4 p-6">
            <div>
              <label className="label">Username</label>
              <input className="input bg-subtle" value={user.username} disabled />
            </div>
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="label">Title</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Product Designer"
              />
            </div>
            <div>
              <label className="label">Role</label>
              <input
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="admin, member…"
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button className="btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
              {saved && <span className="text-sm text-good">Saved</span>}
            </div>
          </form>
        )}
      </div>
    </>
  );
}

// useSearchParams requires a Suspense boundary so the rest of the page can be
// prerendered while the search params resolve on the client.
export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="px-8 py-8 text-sm text-muted">Loading…</div>}>
      <ProfilePageInner />
    </Suspense>
  );
}
