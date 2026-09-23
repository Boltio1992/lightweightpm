"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { PriorityBadge } from "./Badges";
import { api, fmtDate, isOverdue } from "@/lib/api";
import { fadeScale, motionTransition } from "@/lib/motion";
import { TASK_STATUSES, type Task, type TaskStatus } from "@/types";

function Card({
  task,
  onEdit,
  dropped,
}: {
  task: Task;
  onEdit: (t: Task) => void;
  dropped?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const overdue = isOverdue(task);
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      layout
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onEdit(task)}
      className={`card cursor-grab p-3 active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
      whileDrag={
        reduceMotion
          ? undefined
          : { scale: 1.02, boxShadow: "0 10px 26px rgba(22, 22, 24, 0.16)", rotate: 0.2 }
      }
      animate={
        dropped && !reduceMotion
          ? { scale: [1, 1.02, 1], boxShadow: ["0 2px 10px rgba(12,12,13,0.06)", "0 8px 20px rgba(22,22,24,0.14)", "0 2px 10px rgba(12,12,13,0.06)"] }
          : undefined
      }
      transition={reduceMotion ? { duration: 0 } : motionTransition.fast}
    >
      <p className="mb-2 text-sm font-medium text-ink">{task.title}</p>
      
      {/* Progress bar if percent_complete > 0 */}
      {task.percent_complete > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted">Progress</span>
            <span className="text-xs font-medium text-muted">{task.percent_complete}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
            <div 
              className="h-full bg-accent" 
              style={{ width: `${task.percent_complete}%` }}
            />
          </div>
        </div>
      )}
      
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
<PriorityBadge priority={task.priority} />
{task.parent_task_id && <span className="chip bg-subtle text-muted">sub-task</span>}
{task.duration_days && (
  <span className="chip bg-blue-100 text-blue-600">{task.duration_days}d</span>
)}
      </div>
      
      <div className="mt-2 flex flex-col gap-1 text-xs">
        {task.start_date && (
          <span className="text-muted">
            Start: {new Date(task.start_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
        <div className="flex items-center justify-between">
          <span className={overdue ? "font-medium text-danger" : "text-muted"}>
            Due: {fmtDate(task.due_date)}
          </span>
          <span className="truncate text-muted">
            {task.assignee?.name || task.assignee?.username || ""}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function Column({
  status,
  label,
  tasks,
  onEdit,
  droppedId,
}: {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  onEdit: (t: Task) => void;
  droppedId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      layout
      ref={setNodeRef}
      className={`flex w-72 flex-none flex-col rounded-lg border p-2 transition ${
        isOver ? "border-accent bg-accentSoft/70" : "border-line bg-subtle"
      }`}
      animate={isOver && !reduceMotion ? { scale: 1.01 } : { scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : motionTransition.fast}
    >
      <div className="mb-2 flex items-center justify-between px-1 py-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        <span className="chip bg-white text-muted">{tasks.length}</span>
      </div>
      <div className="flex min-h-[120px] flex-col gap-2">
        <AnimatePresence initial={false}>
          {tasks.map((t) => (
            <Card key={t.id} task={t} onEdit={onEdit} dropped={droppedId === t.id} />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function KanbanBoard({
  tasks,
  onEdit,
  onChanged,
}: {
  tasks: Task[];
  onEdit: (t: Task) => void;
  onChanged: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [droppedId, setDroppedId] = useState<string | null>(null);
  const dropTimerRef = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();
  // Local optimistic copy so cards move instantly, before the API round-trip.
  const [optimistic, setOptimistic] = useState<Record<string, TaskStatus>>({});

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const resolved = tasks.map((t) => ({ ...t, status: optimistic[t.id] ?? t.status }));
  const activeTask = resolved.find((t) => t.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  useEffect(() => {
    return () => {
      if (dropTimerRef.current !== null) {
        window.clearTimeout(dropTimerRef.current);
      }
    };
  }, []);

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const taskId = String(e.active.id);
    const newStatus = e.over?.id as TaskStatus | undefined;
    if (!newStatus) return;

    const current = resolved.find((t) => t.id === taskId);
    if (!current || current.status === newStatus) return;

    setOptimistic((m) => ({ ...m, [taskId]: newStatus }));
    setDroppedId(taskId);
    try {
      await api(`/api/tasks/${taskId}`, { method: "PATCH", json: { status: newStatus } });
      onChanged();
    } catch {
      setOptimistic((m) => {
        const next = { ...m };
        delete next[taskId];
        return next;
      });
    } finally {
      if (dropTimerRef.current !== null) window.clearTimeout(dropTimerRef.current);
      dropTimerRef.current = window.setTimeout(() => {
        setDroppedId((id) => (id === taskId ? null : id));
        dropTimerRef.current = null;
      }, 220);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <LayoutGroup>
        <motion.div layout className="flex gap-3 overflow-x-auto pb-4">
          {TASK_STATUSES.map(({ key, label }) => (
            <Column
              key={key}
              status={key}
              label={label}
              tasks={resolved.filter((t) => t.status === key)}
              onEdit={onEdit}
              droppedId={droppedId}
            />
          ))}
        </motion.div>
      </LayoutGroup>
      <DragOverlay>
        {activeTask && (
          <motion.div
            className="card w-72 p-3 shadow-pop"
            initial={reduceMotion ? false : fadeScale.initial}
            animate={reduceMotion ? undefined : fadeScale.animate}
            transition={reduceMotion ? { duration: 0 } : motionTransition.fast}
          >
            <p className="text-sm text-ink">{activeTask.title}</p>
          </motion.div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
