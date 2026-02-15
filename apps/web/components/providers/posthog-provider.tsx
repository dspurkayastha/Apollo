"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

/**
 * PostHog analytics provider — initialises on mount, tracks key events only.
 * PII fields are stripped via sanitize_properties.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_KEY) return;

    posthog.init(POSTHOG_KEY, {
      api_host: "https://eu.i.posthog.com",
      loaded: (ph) => {
        // Only track in production
        if (process.env.NODE_ENV !== "production") {
          ph.opt_out_capturing();
        }
      },
      capture_pageview: false, // We track manually
      sanitize_properties: (properties) => {
        // Strip PII fields
        const sanitised = { ...properties };
        delete sanitised.email;
        delete sanitised.name;
        delete sanitised.registration_no;
        delete sanitised.candidate_name;
        delete sanitised.guide_name;
        delete sanitised.$ip;
        return sanitised;
      },
    });
  }, []);

  return <>{children}</>;
}

/**
 * Track a key event. Only these events are captured per PLAN.md:
 * - project_created
 * - phase_approved
 * - compile_triggered
 * - export_downloaded
 */
export function trackEvent(
  event: string,
  properties?: Record<string, unknown>
): void {
  if (!POSTHOG_KEY) return;

  const allowedEvents = [
    "project_created",
    "phase_approved",
    "compile_triggered",
    "export_downloaded",
    "analysis_started",
    "compliance_checked",
    "dataset_uploaded",
  ];

  if (!allowedEvents.includes(event)) return;

  posthog.capture(event, properties);
}
