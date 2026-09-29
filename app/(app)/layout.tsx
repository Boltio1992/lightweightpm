import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      {/* Runs before first paint: a collapsed sidebar must never flash open on
          reload. AppShell reads the same key on mount and takes over. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{if(localStorage.getItem('lightpm:sidebar-collapsed')==='1')document.documentElement.classList.add('sidebar-collapsed')}catch(e){}",
        }}
      />
      <AppShell user={user}>{children}</AppShell>
    </>
  );
}
