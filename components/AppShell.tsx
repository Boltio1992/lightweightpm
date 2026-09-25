"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import CommandPalette from "@/components/CommandPalette";
import TaskModal from "@/components/TaskModal";
import { emitTasksChanged } from "@/lib/api";
import { motionTransition } from "@/lib/motion";
import type { UserPublic } from "@/types";

export default function AppShell({
  user,
  children,
}: {
  user: UserPublic;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
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
    <div className="flex h-[100dvh] w-full overflow-hidden bg-white">
      {/* Desktop sidebar */}
      <Sidebar
        user={user}
        onOpenSearch={() => setCommandPaletteOpen(true)}
        className="hidden md:flex"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex flex-none items-center gap-2 border-b border-line px-3 py-2.5 md:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            className="-ml-1 rounded-md p-2 text-ink hover:bg-subtle active:bg-subtle/80 transition"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>

          <span className="flex-1 text-sm font-semibold text-ink">LightPM</span>

          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Search"
            className="rounded-md p-2 text-muted hover:bg-subtle hover:text-ink transition"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4.3-4.3" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <main className="scroll-area h-full flex-1 overflow-y-auto">
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
              className="fixed inset-0 z-40 bg-ink/40 md:hidden"
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

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenNewTask={() => setNewTaskModalOpen(true)}
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
