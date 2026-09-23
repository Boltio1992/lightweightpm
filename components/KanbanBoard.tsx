"use client";

import { useState } from "react";
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
import { TASK_STATUSES, type Task, type TaskStatus } from "@/types";

function Card({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const overdue = isOverdue(task);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onEdit(task)}
      className={`card cursor-grab p-3 active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
    >
      <p className="mb-2 text-sm text-ink">{task.title}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        {task.parent_task_id && <span className="chip bg-gray-100 text-gray-500">sub-task</span>}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={overdue ? "font-medium text-danger" : "text-muted"}>
          {fmtDate(task.due_date)}
        </span>
        <span className="truncate text-muted">
          {task.assignee?.name || task.assignee?.username || ""}
        </span>
      </div>
    </div>
  );
}

function Column({
  status,
  label,
  tasks,
  onEdit,
}: {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  onEdit: (t: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 flex-none flex-col rounded-lg border p-2 transition ${
        isOver ? "border-accent bg-blue-50/40" : "border-line bg-subtle"
      }`}
    >
      <div className="mb-2 flex items-center justify-between px-1 py-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        <span className="chip bg-white text-muted">{tasks.length}</span>
      </div>
      <div className="flex min-h-[120px] flex-col gap-2">
        {tasks.map((t) => (
          <Card key={t.id} task={t} onEdit={onEdit} />
        ))}
      </div>
    </div>
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
  // Local optimistic copy so cards move instantly, before the API round-trip.
  const [optimistic, setOptimistic] = useState<Record<string, TaskStatus>>({});

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const resolved = tasks.map((t) => ({ ...t, status: optimistic[t.id] ?? t.status }));
  const activeTask = resolved.find((t) => t.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const taskId = String(e.active.id);
    const newStatus = e.over?.id as TaskStatus | undefined;
    if (!newStatus) return;

    const current = resolved.find((t) => t.id === taskId);
    if (!current || current.status === newStatus) return;

    setOptimistic((m) => ({ ...m, [taskId]: newStatus }));
    try {
      await api(`/api/tasks/${taskId}`, { method: "PATCH", json: { status: newStatus } });
      onChanged();
    } catch {
      setOptimistic((m) => {
        const next = { ...m };
        delete next[taskId];
        return next;
      });
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {TASK_STATUSES.map(({ key, label }) => (
          <Column
            key={key}
            status={key}
            label={label}
            tasks={resolved.filter((t) => t.status === key)}
            onEdit={onEdit}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <div className="card w-72 p-3 shadow-pop">
            <p className="text-sm text-ink">{activeTask.title}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
