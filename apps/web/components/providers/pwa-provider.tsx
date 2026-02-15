"use client";

import { useEffect } from "react";

/**
 * PWA Provider — registers the service worker on mount.
 * Renders nothing visible.
 */
export function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("SW registered:", reg.scope);
      })
      .catch((err) => {
        console.warn("SW registration failed:", err);
      });
  }, []);

  return <>{children}</>;
}
