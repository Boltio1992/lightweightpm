"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { emitTasksChanged } from "@/lib/api";

/**
 * Keeps the UI in sync with the server without polling.
 *
 * Subscribes to /api/events (SSE) and, when a write lands, re-runs the data the
 * page already knows how to fetch:
 *
 *   - emitTasksChanged() drives the Tasks page and the project detail page,
 *     which already subscribe to that existing event contract.
 *   - router.refresh() re-renders server components (dashboard, projects list).
 *
 * Mounted once in the app layout. Renders nothing.
 */
export default function LiveUpdates() {
  const router = useRouter();
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let source: EventSource | null = null;

    const flush = () => {
      pending.current = null;
      emitTasksChanged();
      router.refresh();
    };

    try {
      source = new EventSource("/api/events");

      source.addEventListener("change", () => {
        // Collapse a burst of writes (an import, a reorder) into one refresh.
        if (pending.current) return;
        pending.current = setTimeout(flush, 200);
      });
    } catch {
      // Live updates are a convenience: if the stream cannot be opened the app
      // keeps working exactly as before, just without them.
    }

    return () => {
      if (pending.current) clearTimeout(pending.current);
      pending.current = null;
      source?.close();
    };
  }, [router]);

  return null;
}
