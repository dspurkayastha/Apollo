"use client";

import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

interface GlassSidebarContextProps {
  isExpanded: boolean;
  setExpanded: (expanded: boolean) => void;
  isMobile: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const GlassSidebarContext =
  React.createContext<GlassSidebarContextProps | null>(null);

export function useGlassSidebar() {
  const context = React.useContext(GlassSidebarContext);
  if (!context) {
    throw new Error(
      "useGlassSidebar must be used within a GlassSidebarProvider."
    );
  }
  return context;
}

interface GlassSidebarProviderProps {
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

/** Must match the constants in glass-sidebar.tsx */
const SPACER_EXPANDED = 240;
const SPACER_COLLAPSED = 80;

export function SidebarSpacer() {
  const { isExpanded, isMobile } = useGlassSidebar();
  if (isMobile) return null;
  return (
    <div
      className="shrink-0 transition-[width] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{ width: isExpanded ? SPACER_EXPANDED : SPACER_COLLAPSED }}
    />
  );
}

export function GlassSidebarProvider({
  children,
  defaultExpanded = true,
}: GlassSidebarProviderProps) {
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const setExpanded = React.useCallback((expanded: boolean) => {
    setIsExpanded(expanded);
    document.cookie = `${SIDEBAR_COOKIE_NAME}=${expanded}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
  }, []);

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setMobileOpen((prev) => !prev);
    } else {
      setExpanded(!isExpanded);
    }
  }, [isMobile, isExpanded, setExpanded]);

  // Keyboard shortcut: Cmd/Ctrl+B
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const value = React.useMemo<GlassSidebarContextProps>(
    () => ({
      isExpanded,
      setExpanded,
      isMobile,
      mobileOpen,
      setMobileOpen,
      toggleSidebar,
    }),
    [isExpanded, setExpanded, isMobile, mobileOpen, setMobileOpen, toggleSidebar]
  );

  return (
    <GlassSidebarContext.Provider value={value}>
      {children}
    </GlassSidebarContext.Provider>
  );
}
