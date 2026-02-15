import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  beforeSend(event) {
    // Strip PII from error context
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete (event.user as Record<string, unknown>).name;
      delete (event.user as Record<string, unknown>).registration_no;
    }
    return event;
  },
});
