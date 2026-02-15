import { cookies } from "next/headers";
import { GlassSidebarProvider, SidebarSpacer } from "@/components/layout/glass-sidebar-provider";
import { GlassSidebar } from "@/components/layout/glass-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultExpanded = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <GlassSidebarProvider defaultExpanded={defaultExpanded}>
      <div className="relative h-screen overflow-hidden">
        <GlassSidebar />
        <div className="grid h-screen grid-cols-[auto_1fr] overflow-hidden">
          <SidebarSpacer />
          <div className="flex flex-col overflow-hidden">
            <DashboardHeader />
            <main className="flex-1 overflow-y-auto dashboard-dot-grid p-4 md:p-6">
              <div className="mx-auto w-full max-w-screen-2xl">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </GlassSidebarProvider>
  );
}
