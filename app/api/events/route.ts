import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { subscribeToChanges, type ChangeEvent } from "@/lib/events";

/**
 * Server-sent events: pushes a tick to every open browser whenever the local
 * store is written, so two windows (or you and your friend) stay in sync
 * without polling.
 *
 * Deliberately minimal: the event carries which table changed, and the client
 * decides what to refetch. It reuses the app's existing invalidation contract
 * (see components/LiveUpdates.tsx) rather than inventing a second one.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 25000;

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const send = (event: string, data: unknown) => {
        write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      // Tell the client it is connected before anything happens, so a broken
      // stream shows up immediately rather than on the first change.
      send("ready", { ok: true, at: new Date().toISOString() });

      const unsubscribe = subscribeToChanges((change: ChangeEvent) => {
        send("change", change);
      });

      // Comment frames keep proxies and idle timeouts from dropping the stream.
      const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the runtime.
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Stops nginx and friends from buffering the stream into uselessness.
      "X-Accel-Buffering": "no",
    },
  });
}
