"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  KeyRound,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { useGlassSidebar } from "./glass-sidebar-provider";

const navItems = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { id: "projects", label: "Projects", href: "/projects", icon: FolderOpen },
  { id: "licences", label: "Licences", href: "/licences", icon: KeyRound },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings },
];

/** Collapsed frosted-glass strip width (px) */
export const SIDEBAR_COLLAPSED_WIDTH = 80;
/** Expanded sidebar width (px) */
export const SIDEBAR_EXPANDED_WIDTH = 240;

export function GlassSidebar() {
  const pathname = usePathname();
  const { isExpanded, isMobile, mobileOpen, setMobileOpen, toggleSidebar } =
    useGlassSidebar();

  // ── Mobile: overlay ──
  if (isMobile) {
    if (!mobileOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex">
        <div
          className="absolute inset-0 bg-black/20"
          onClick={() => setMobileOpen(false)}
        />
        <div className="relative z-10 flex h-full w-[240px] flex-col bg-white/90 backdrop-blur-[20px] border-r border-black/[0.06] p-4">
          <div className="flex items-center justify-center mb-6">
            <Link
              href="/dashboard"
              className="font-brand text-3xl font-medium text-[#2F2F2F]"
              onClick={() => setMobileOpen(false)}
            >
              Apollo
            </Link>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "bg-black/[0.08] text-[#2F2F2F] font-medium"
                      : "text-[#9CA3AF] hover:bg-black/[0.04] hover:text-[#2F2F2F]"
                  }`}
                >
                  <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto flex items-center gap-3 pt-4 border-t border-black/[0.06]">
            <UserButton afterSignOutUrl="/" />
            <span className="text-sm text-[#6B6B6B]">Account</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Desktop ──
  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 transition-[width] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{ width: isExpanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH }}
    >
      {/* Full-height frosted glass backdrop */}
      <div
        className={[
          "absolute inset-0 backdrop-blur-[20px] transition-[background-color,border-color,box-shadow] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          isExpanded
            ? "bg-white/70 border-r border-black/[0.06]"
            : "bg-white/40 border-r border-black/[0.04]",
        ].join(" ")}
        style={{
          boxShadow: isExpanded
            ? "none"
            : "4px 0 30px rgba(0,0,0,0.03), 1px 0 0 rgba(0,0,0,0.04)",
        }}
      />

      {/* Content wrapper — clips content during width transition */}
      <div className="relative h-full overflow-hidden">
        {isExpanded ? (
          <div className="flex h-full flex-col">
            {/* Branding — centred, large */}
            <div className="flex h-20 items-center justify-center">
              <Link
                href="/dashboard"
                className="font-brand text-4xl font-medium text-[#2F2F2F]"
              >
                Apollo
              </Link>
            </div>

            {/* Nav */}
            <nav className="flex flex-1 flex-col gap-1 px-2 pt-1">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    title={item.label}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                      isActive
                        ? "bg-black/[0.08] text-[#2F2F2F] font-medium"
                        : "text-[#9CA3AF] hover:bg-black/[0.04] hover:text-[#2F2F2F]"
                    }`}
                  >
                    <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="border-t border-black/[0.06] p-3">
              <div className="flex items-center gap-3">
                <UserButton afterSignOutUrl="/" />
                <span className="text-sm text-[#6B6B6B]">Account</span>
              </div>
            </div>
          </div>
        ) : (
          /* ── Collapsed: pill centred on frosted strip ── */
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-black/[0.12] bg-white/90 px-2 py-3 shadow-[0_2px_20px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
              {/* "A" branding — large */}
              <Link
                href="/dashboard"
                className="font-brand text-3xl font-medium text-[#2F2F2F] mb-1"
              >
                A
              </Link>

              {/* Nav icons */}
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    title={item.label}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                      isActive
                        ? "bg-black/[0.08] text-[#2F2F2F]"
                        : "text-[#9CA3AF] hover:bg-black/[0.04] hover:text-[#2F2F2F]"
                    }`}
                  >
                    <item.icon className="h-5 w-5" strokeWidth={1.5} />
                  </Link>
                );
              })}

              {/* User avatar */}
              <div className="mt-1">
                <UserButton afterSignOutUrl="/" />
              </div>

              {/* Expand button */}
              <button
                onClick={toggleSidebar}
                className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-[#9CA3AF] transition-colors hover:bg-black/[0.04] hover:text-[#2F2F2F]"
                aria-label="Expand sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Collapse button — OUTSIDE overflow-hidden wrapper so it isn't clipped */}
      {isExpanded && (
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-black/[0.06] bg-white text-[#9CA3AF] shadow-sm transition-colors hover:text-[#2F2F2F]"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
      )}
    </aside>
  );
}
