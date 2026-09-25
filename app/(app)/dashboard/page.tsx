import DashboardView from "@/components/DashboardView";
import { DashboardSkeleton } from "@/components/LoadingSkeletons";
import { getDashboardData } from "@/lib/dashboard";
import { getCurrentUser } from "@/lib/auth";

// Rendered on the server: the numbers arrive with the first byte of HTML
// instead of waiting for hydration + a client fetch round trip.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return <DashboardSkeleton />;

  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  try {
    data = await getDashboardData();
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="px-4 py-8 text-sm text-muted sm:px-8">
        Could not load dashboard data. Check your Supabase configuration.
      </div>
    );
  }

  return (
    <DashboardView
      summary={data.summary}
      projects={data.projects}
      perProject={data.perProject}
      perAssignee={data.perAssignee}
    />
  );
}
