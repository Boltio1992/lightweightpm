/**
 * In-process change bus for live updates.
 *
 * The app writes through a single choke point (`persistStore` in
 * lib/supabaseServer.ts), so that is where changes are announced. The SSE route
 * in app/api/events/route.ts turns them into a stream the browser can follow,
 * which is what makes open boards and dashboards update without polling.
 *
 * Scope: one process. That is exactly right for local-first use and for a single
 * Node process on your own server. If LightPM is ever run as several processes
 * behind a load balancer, this needs swapping for a real pub/sub (Redis,
 * Postgres LISTEN/NOTIFY) - the subscribe/publish shape below is the seam.
 *
 * The listener set lives on globalThis so Next's dev-mode module reloading does
 * not silently orphan existing subscribers.
 */

export interface ChangeEvent {
  table: string;
  at: string;
}

type ChangeListener = (change: ChangeEvent) => void;

const LISTENERS_KEY = "__lightpm_change_listeners";

function listeners(): Set<ChangeListener> {
  const g = globalThis as any;
  if (!g[LISTENERS_KEY]) g[LISTENERS_KEY] = new Set<ChangeListener>();
  return g[LISTENERS_KEY] as Set<ChangeListener>;
}

export function subscribeToChanges(listener: ChangeListener): () => void {
  const set = listeners();
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

export function publishChange(table: string): void {
  const event: ChangeEvent = { table, at: new Date().toISOString() };
  for (const listener of Array.from(listeners())) {
    try {
      listener(event);
    } catch {
      // A misbehaving subscriber must never break the write that triggered it.
    }
  }
}

export function changeSubscriberCount(): number {
  return listeners().size;
}
