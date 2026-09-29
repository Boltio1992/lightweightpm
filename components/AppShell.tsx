"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import CommandPalette from "@/components/CommandPalette";
import TaskModal from "@/components/TaskModal";
import ThemeToggle from "@/components/ThemeToggle";
import { emitTasksChanged } from "@/lib/api";
import { motionTransition } from "@/lib/motion";
import type { UserPublic } from "@/types";

/** Persisted so the sidebar stays where you left it between visits. */
const SIDEBAR_COLLAPSED_KEY = "lightpm:sidebar-collapsed";

export default function AppShell({
  user,
  children,
}: {
  user: UserPublic;
  children: React.ReactNode;
}) {
  // Primary destinations for the mobile tab bar — everything else lives in the
  // drawer, which needs a second hand to reach on a big phone.
  const MOBILE_TABS = [
    { href: "/dashboard", label: "Home", icon: "M4 11.5 12 4l8 7.5M6.5 10v9h11v-9" },
    { href: "/projects", label: "Projects", icon: "M4 7h16M4 12h16M4 17h10" },
    { href: "/tasks", label: "Tasks", icon: "M5 6h14M5 12h14M5 18h9" },
  ];
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Starts false so server and client render the same markup; the stored value
  // (already applied to <html> by the inline script in the layout) is picked up
  // on mount so there is no flash of an expanded sidebar.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* Private mode — the preference just won't persist. */
      }
      document.documentElement.classList.toggle("sidebar-collapsed", next);
      return next;
    });
  }

  useEffect(() => {
    try {
      if (window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") setSidebarCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      // Ctrl/⌘ + B hides or shows the sidebar — same muscle memory as an editor.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
      if (e.key === "Escape") setMobileNavOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Lock background scrolling while the drawer is open.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileNavOpen]);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-surface">
      {/* Desktop sidebar */}
      <Sidebar
        user={user}
        onOpenSearch={() => setCommandPaletteOpen(true)}
        onCollapse={toggleSidebar}
        className={`app-sidebar ${sidebarCollapsed ? "hidden" : "hidden md:flex"}`}
      />

      {/* Collapsed: an edge tab brings it back without eating any content width. */}
      {sidebarCollapsed && (
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Show sidebar"
          aria-expanded={false}
          title="Show sidebar (Ctrl/⌘ + B)"
          className="fixed left-0 top-1/2 z-30 hidden h-14 w-6 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-line bg-surface text-muted shadow-card transition hover:w-7 hover:text-ink md:flex"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex flex-none items-center gap-2 border-b border-line px-3 py-2.5 md:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            className="tap-icon -ml-1 rounded-md p-2 text-ink hover:bg-subtle active:bg-subtle transition"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>

          <span className="flex-1 text-sm font-semibold text-ink">LightPM</span>

          <ThemeToggle compact />

          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Search"
            className="tap-icon rounded-md p-2 text-muted hover:bg-subtle hover:text-ink transition"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4.3-4.3" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* pb-nav keeps content clear of the tab bar. From md up the tab bar is
            gone (the sidebar takes over), so the reserve is dropped. */}
        <main className="scroll-area h-full flex-1 overflow-y-auto pb-nav md:pb-0">
          {/* Keyed on the route so each page fades in on navigation. */}
          <motion.div
            key={pathname}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : motionTransition.fast}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/45 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : motionTransition.fast}
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.div
              className="fixed inset-y-0 left-0 z-50 w-[78%] max-w-xs md:hidden"
              initial={{ x: reduceMotion ? 0 : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: reduceMotion ? 0 : "-100%" }}
              transition={reduceMotion ? { duration: 0 } : motionTransition.normal}
              style={{ willChange: "transform" }}
            >
              <Sidebar
                user={user}
                onOpenSearch={() => setCommandPaletteOpen(true)}
                onNavigate={() => setMobileNavOpen(false)}
                className="shadow-pop"
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile tab bar — thumb-reachable primary navigation. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface backdrop-blur md:hidden">
        {MOBILE_TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition ${
                active ? "text-accent" : "text-muted"
              }`}
              style={{ minHeight: 56, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4px)" }}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d={t.icon} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setNewTaskModalOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-accent"
          style={{ minHeight: 56, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4px)" }}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-lg leading-none text-white">
            +
          </span>
          New
        </button>
      </nav>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenNewTask={() => setNewTaskModalOpen(true)}
        onToggleSidebar={toggleSidebar}
      />

      <TaskModal
        open={newTaskModalOpen}
        onClose={() => setNewTaskModalOpen(false)}
        onSaved={() => {
          setNewTaskModalOpen(false);
          emitTasksChanged();
        }}
        assignableUsers={[user]}
      />
    </div>
  );
}
