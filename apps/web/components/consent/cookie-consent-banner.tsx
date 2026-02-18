"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { updateAnalyticsConsent } from "@/components/providers/posthog-provider";

const STORAGE_KEY = "analytics-consent";

export function CookieConsentBanner() {
  const [shouldRender, setShouldRender] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      setShouldRender(true);
      // Trigger slide-in after mount + small delay
      const timer = setTimeout(() => setAnimateIn(true), 100);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = (accepted: boolean) => {
    updateAnalyticsConsent(accepted);
    setAnimateIn(false);
    // Remove from DOM after slide-out animation completes
    setTimeout(() => setShouldRender(false), 500);
  };

  if (!shouldRender) return null;

  return (
    <div
      className={[
        "fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-border/60",
        "bg-white/90 p-5 shadow-[0_4px_40px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)]",
        "backdrop-blur-md transition-transform duration-500 ease-out",
        animateIn ? "translate-y-0" : "translate-y-[calc(100%+2rem)]",
      ].join(" ")}
    >
      <p className="mb-4 text-sm leading-relaxed text-foreground">
        We use essential cookies for authentication and optional analytics to
        improve Apollo.{" "}
        <Link
          href="/privacy"
          className="text-primary underline underline-offset-2"
        >
          Privacy Policy
        </Link>
      </p>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => dismiss(false)}>
          Reject
        </Button>
        <Button size="sm" onClick={() => dismiss(true)}>
          Accept All
        </Button>
      </div>
    </div>
  );
}
