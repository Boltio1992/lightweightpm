import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      <Sidebar user={user} />
      <main className="h-screen flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
