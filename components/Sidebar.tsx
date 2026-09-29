"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import type { UserPublic } from "@/types";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/projects", label: "Projects", icon: "folder" },
  { href: "/tasks", label: "My Tasks", icon: "check" },
];

function Icon({ name }: { name: string }) {
  const common = "h-4 w-4 flex-none";
  switch (name) {
    case "home":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "folder":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path
            d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "check":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="m8 12 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

export default function Sidebar({
  user,
  onOpenSearch,
  onNavigate,
  onCollapse,
  className = "",
}: {
  user: UserPublic;
  onOpenSearch?: () => void;
  /** Called after any navigation — used to auto-close the mobile drawer. */
  onNavigate?: () => void;
  /** When provided, the header shows a collapse button (desktop rail only). */
  onCollapse?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function go() {
    onNavigate?.();
  }

  async function logout() {
    go();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initials = (user.name || user.username).slice(0, 2).toUpperCase();

  return (
    <aside
      className={`flex h-full w-56 flex-none flex-col border-r border-line bg-subtle ${className}`}
    >
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs font-semibold text-white">
          L
        </div>
        <span className="flex-1 truncate text-sm font-semibold text-ink">LightPM</span>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Hide sidebar"
            title="Hide sidebar (Ctrl/⌘ + B)"
            className="-mr-1 rounded-md p-1 text-muted transition hover:bg-surface hover:text-ink"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="16" rx="2.5" />
              <path d="M10 4v16" strokeLinecap="round" />
              <path d="m7.5 9.5-2 2.5 2 2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      {onOpenSearch && (
        <button
          type="button"
          onClick={() => {
            go();
            onOpenSearch?.();
          }}
          className="tap-row mx-3 mb-2 flex items-center justify-between rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-muted hover:border-ink hover:text-ink transition shadow-2xs"
        >
          <div className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span>Search…</span>
          </div>
          <kbd className="rounded border border-line bg-subtle px-1 py-0.2 text-xs font-mono text-muted">⌘K</kbd>
        </button>
      )}

      <nav className="flex-1 space-y-0.5 px-2">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={go}
              className={`tap-row w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition ${
                active ? "bg-surface font-medium text-ink shadow-card" : "text-muted hover:bg-surface hover:text-ink"
              }`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-2">
        <div className="mb-2 px-1">
          <ThemeToggle />
        </div>
        <Link
          href="/profile"
          onClick={go}
          className="tap-row flex items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-surface"
        >
          <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">{user.name || user.username}</p>
            <p className="truncate text-xs text-muted">{user.title || "@" + user.username}</p>
          </div>
        </Link>
        <button
          onClick={logout}
          className="tap-row mt-1 w-full rounded-md px-2.5 py-1.5 text-left text-sm text-muted hover:bg-surface hover:text-danger"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
