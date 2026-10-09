import { supabaseAdmin } from "@/lib/supabaseServer";

export type MembershipRole = "owner" | "admin" | "member" | "viewer";

/**
 * Returns the current user's role within a project (workspace), or null if they
 * are not a member at all. Works against both the real Supabase backend and the
 * in-memory mock client.
 */
export async function getProjectMembership(
  userId: string,
  projectId: string
): Promise<MembershipRole | null> {
  if (!userId || !projectId) return null;

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return (data.role as MembershipRole) ?? null;
}

/** True when the user belongs to the project in any capacity. */
export async function isProjectMember(
  userId: string,
  projectId: string
): Promise<boolean> {
  return (await getProjectMembership(userId, projectId)) !== null;
}

/**
 * True when the user can administer the project: project owner/admin in
 * project_members, or the platform-level admin user.
 */
export async function isProjectAdmin(
  userId: string,
  projectId: string
): Promise<boolean> {
  const role = await getProjectMembership(userId, projectId);
  return role === "owner" || role === "admin";
}
