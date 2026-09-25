"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ProjectStatusBadge, PriorityBadge } from "./Badges";
import type { Project, Task } from "@/types";

export default function CommandPalette({
  open,
  onClose,
  onOpenNewTask,
  onOpenNewProject,
}: {
  open: boolean;
  onClose: () => void;
  onOpenNewTask?: () => void;
  onOpenNewProject?: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose();
        else {
          // open command palette
          onClose(); // trigger toggle in parent
        }
      }
      if (e.key === "Escape" && open) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      fetchResults("");
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchResults(query);
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  async function fetchResults(q: string) {
    setLoading(true);
    try {
      const res = await api<{ projects: Project[]; tasks: Task[] }>(
        `/api/search?q=${encodeURIComponent(q.trim())}`
      );
      setProjects(res.projects ?? []);
      setTasks(res.tasks ?? []);
      setSelectedIndex(0);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }

  const actions = [
    {
      id: "action-new-task",
      title: "Create new task",
      category: "Action",
      run: () => {
        onClose();
        onOpenNewTask?.();
      },
    },
    {
      id: "action-new-project",
      title: "Create new project",
      category: "Action",
      run: () => {
        onClose();
        onOpenNewProject?.();
      },
    },
    {
      id: "action-dashboard",
      title: "Go to Dashboard",
      category: "Navigation",
      run: () => {
        onClose();
        router.push("/dashboard");
      },
    },
    {
      id: "action-projects",
      title: "Go to Projects",
      category: "Navigation",
      run: () => {
        onClose();
        router.push("/projects");
      },
    },
    {
      id: "action-tasks",
      title: "Go to My Tasks",
      category: "Navigation",
      run: () => {
        onClose();
        router.push("/tasks");
      },
    },
  ];

  const filteredActions = query.trim()
    ? actions.filter((a) => a.title.toLowerCase().includes(query.toLowerCase()))
    : actions;

  const totalItems = filteredActions.length + projects.length + tasks.length;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, totalItems));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalItems) % Math.max(1, totalItems));
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeCurrentSelection();
    }
  }

  function executeCurrentSelection() {
    let index = 0;
    for (const a of filteredActions) {
      if (index === selectedIndex) {
        a.run();
        return;
      }
      index++;
    }
    for (const p of projects) {
      if (index === selectedIndex) {
        onClose();
        router.push(`/projects/${p.id}`);
        return;
      }
      index++;
    }
    for (const t of tasks) {
      if (index === selectedIndex) {
        onClose();
        if (t.project_id) {
          router.push(`/projects/${t.project_id}`);
        } else {
          router.push("/tasks");
        }
        return;
      }
      index++;
    }
  }

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-xs pt-20 px-4">
      <div
        className="w-full max-w-xl rounded-xl border border-line bg-white shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 bg-subtle/30">
          <svg className="h-5 w-5 text-muted flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search projects & tasks…"
            className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
          />
          {loading && <span className="text-xs text-muted">Searching…</span>}
          <kbd className="hidden sm:inline-block rounded border border-line bg-white px-1.5 py-0.5 text-[10px] font-mono text-muted">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {/* Actions */}
          {filteredActions.length > 0 && (
            <div>
              <p className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                Quick Actions
              </p>
              <div className="space-y-0.5">
                {filteredActions.map((action) => {
                  const isSelected = flatIndex === selectedIndex;
                  const currentIndex = flatIndex;
                  flatIndex++;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={action.run}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition ${
                        isSelected ? "bg-ink text-white" : "text-ink hover:bg-subtle"
                      }`}
                    >
                      <span className="font-medium">{action.title}</span>
                      <span className={`text-[10px] ${isSelected ? "text-white/80" : "text-muted"}`}>
                        {action.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Projects */}
          {projects.length > 0 && (
            <div>
              <p className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                Projects
              </p>
              <div className="space-y-0.5">
                {projects.map((p) => {
                  const isSelected = flatIndex === selectedIndex;
                  const currentIndex = flatIndex;
                  flatIndex++;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(`/projects/${p.id}`);
                      }}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition ${
                        isSelected ? "bg-ink text-white" : "text-ink hover:bg-subtle"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full flex-none"
                          style={{ backgroundColor: p.accent_color || "#12A594" }}
                        />
                        <span className="font-medium truncate">{p.name}</span>
                      </div>
                      <ProjectStatusBadge status={p.status} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tasks */}
          {tasks.length > 0 && (
            <div>
              <p className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                Tasks
              </p>
              <div className="space-y-0.5">
                {tasks.map((t) => {
                  const isSelected = flatIndex === selectedIndex;
                  const currentIndex = flatIndex;
                  flatIndex++;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        if (t.project_id) {
                          router.push(`/projects/${t.project_id}`);
                        } else {
                          router.push("/tasks");
                        }
                      }}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition ${
                        isSelected ? "bg-ink text-white" : "text-ink hover:bg-subtle"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{t.title}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-none">
                        <PriorityBadge priority={t.priority} />
                        <span className={`text-[10px] capitalize ${isSelected ? "text-white/80" : "text-muted"}`}>
                          {t.status.replace(/_/g, " ")}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {totalItems === 0 && !loading && (
            <p className="py-8 text-center text-xs text-muted">
              No results found for &ldquo;{query}&rdquo;
            </p>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-line px-4 py-2 bg-subtle/50 text-[11px] text-muted">
          <span>Navigate with <kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd></span>
          <span>Select with <kbd className="font-mono">Enter</kbd></span>
        </div>
      </div>
    </div>
  );
}
