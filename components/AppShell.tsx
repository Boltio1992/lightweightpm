"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import CommandPalette from "@/components/CommandPalette";
import TaskModal from "@/components/TaskModal";
import type { UserPublic } from "@/types";

export default function AppShell({
  user,
  children,
}: {
  user: UserPublic;
  children: React.ReactNode;
}) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      <Sidebar user={user} onOpenSearch={() => setCommandPaletteOpen(true)} />
      <main className="h-screen flex-1 overflow-y-auto">{children}</main>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenNewTask={() => setNewTaskModalOpen(true)}
      />

      <TaskModal
        open={newTaskModalOpen}
        onClose={() => setNewTaskModalOpen(false)}
        onSaved={() => {
          // If on a page that listens to storage or url change, can reload
          window.location.reload();
        }}
        assignableUsers={[user]}
      />
    </div>
  );
}
