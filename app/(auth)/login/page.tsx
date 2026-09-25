"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const DEMO_USERS = [
  {
    id: "admin",
    name: "Alex Rivera",
    role: "Lead Architect (Owner)",
    badge: "👑 Owner",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    id: "jane",
    name: "Jane Doe",
    role: "Product Designer",
    badge: "🎨 Admin",
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    id: "marcus",
    name: "Marcus Chen",
    role: "Frontend Engineer",
    badge: "💻 Member",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
];

function LoginPageInner() {
  const search = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeDemo, setActiveDemo] = useState<string | null>(null);

  const redirectUrl = search.get("next") || "/dashboard";

  async function performLogin(creds: { username: string; password?: string; demo?: boolean }) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Login failed. Please check credentials.");
      }

      // Use window.location.href to guarantee full document reload with freshly set cookie
      window.location.href = redirectUrl;
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
      setActiveDemo(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await performLogin({ username, password });
  }

  async function handleDemoLogin(userKey: string = "admin") {
    setActiveDemo(userKey);
    await performLogin({ username: userKey, password: "password123", demo: true });
  }

  function fillCredentials(u: string = "admin", p: string = "password123") {
    setUsername(u);
    setPassword(p);
    setError(null);
  }

  return (
    <>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-ink">Welcome to LightPM</h1>
        <p className="text-sm text-muted">Sign in to your project management workspace.</p>
      </div>

      {/* Primary 1-Click Demo Login Box */}
      <div className="mb-5 rounded-lg border border-accent/30 bg-accent/5 p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">
            ⚡ Quick Demo Access
          </span>
          <span className="text-[11px] text-muted">No setup needed</span>
        </div>

        <button
          type="button"
          onClick={() => handleDemoLogin("admin")}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          {loading && activeDemo === "admin" ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Logging in as Alex Rivera…</span>
            </>
          ) : (
            <>
              <span>Instant Demo Login (Alex Rivera)</span>
              <span className="text-xs opacity-75">→</span>
            </>
          )}
        </button>

        {/* Role Quick Selection */}
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-medium text-muted">Or switch to a demo role:</p>
          <div className="grid grid-cols-3 gap-1.5">
            {DEMO_USERS.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleDemoLogin(user.id)}
                disabled={loading}
                className="flex flex-col items-start rounded border border-line bg-card p-1.5 text-left text-xs transition hover:border-accent hover:bg-subtle disabled:opacity-50"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-medium text-ink">{user.name.split(" ")[0]}</span>
                  <span className="text-[10px]">{user.badge.split(" ")[0]}</span>
                </div>
                <span className="text-[10px] text-muted truncate w-full">{user.role.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mb-4 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-line" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted">Or log in with username</span>
        </div>
      </div>

      {/* Manual Login Form */}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">Username</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin, demo, or registered username"
            autoFocus
            required
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password123 or demo"
            required
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
            <p className="font-medium">{error}</p>
            <button
              type="button"
              onClick={() => handleDemoLogin("admin")}
              className="mt-1 font-semibold underline hover:text-red-900"
            >
              Click here to log in as Alex Rivera (Demo)
            </button>
          </div>
        )}

        <button className="btn-primary w-full" disabled={loading}>
          {loading && !activeDemo ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        No account?{" "}
        <Link href="/register" className="text-accent hover:underline">
          Register new account
        </Link>
      </p>

      {/* Fill Helper Badge */}
      <div className="mt-4 flex items-center justify-between rounded-md border border-line bg-subtle px-3 py-2 text-xs text-muted">
        <span>
          Demo creds: <strong className="font-mono text-ink">admin</strong> / <strong className="font-mono text-ink">password123</strong>
        </span>
        <button
          type="button"
          onClick={() => fillCredentials("admin", "password123")}
          className="text-accent hover:underline text-[11px] font-medium"
        >
          Auto-fill
        </button>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="px-8 py-8 text-sm text-muted">Loading workspace…</div>}>
      <LoginPageInner />
    </Suspense>
  );
}
