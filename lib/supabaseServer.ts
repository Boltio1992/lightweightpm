import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// This client is ONLY ever imported from server-side code (API routes,
// server components). It uses the service role key, which bypasses Row
// Level Security. Never import this file from a "use client" component.
// We don't generate Supabase types, so the client is intentionally loosely
// typed. Row shapes are enforced by the hand-written types in @/types.
type AdminClient = SupabaseClient<any, any, any>;

let cached: AdminClient | null = null;

export function supabaseAdmin(): AdminClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  cached = createClient<any, any, any>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
