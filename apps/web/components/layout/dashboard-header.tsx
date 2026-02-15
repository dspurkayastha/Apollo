"use client";

import { usePathname } from "next/navigation";
import { useGlassSidebar } from "@/components/layout/glass-sidebar-provider";
import { PanelLeft } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function DashboardHeader() {
  const pathname = usePathname();
  const { toggleSidebar } = useGlassSidebar();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-black/[0.06] bg-white/70 backdrop-blur-[20px] px-4">
      <button
        onClick={toggleSidebar}
        className="flex h-7 w-7 items-center justify-center rounded-md text-[#9CA3AF] transition-colors hover:text-[#2F2F2F] md:hidden"
        aria-label="Toggle sidebar"
      >
        <PanelLeft className="h-4 w-4" />
      </button>
      <Breadcrumb>
        <BreadcrumbList>
          {segments.map((segment, index) => {
            const href = "/" + segments.slice(0, index + 1).join("/");
            const isLast = index === segments.length - 1;
            const label =
              segment.charAt(0).toUpperCase() + segment.slice(1);

            return (
              <span key={href} className="flex items-center gap-1.5">
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="text-[#2F2F2F]">{label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={href} className="text-[#9CA3AF] hover:text-[#2F2F2F]">
                      {label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </span>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
