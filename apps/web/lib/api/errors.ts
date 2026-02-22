import { NextResponse } from "next/server";
import { ERROR_CODES, type ApiErrorResponse } from "@/lib/types/api";

function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export function unauthorised(message = "Authentication required") {
  return errorResponse(ERROR_CODES.UNAUTHORISED, message, 401);
}

export function forbidden(message = "Insufficient permissions") {
  return errorResponse(ERROR_CODES.FORBIDDEN, message, 403);
}

export function notFound(message = "Resource not found") {
  return errorResponse(ERROR_CODES.NOT_FOUND, message, 404);
}

export function licenceRequired(message = "Active licence required") {
  return errorResponse(ERROR_CODES.LICENCE_REQUIRED, message, 402);
}

export function validationError(
  message: string,
  details?: Record<string, unknown>
) {
  return errorResponse(ERROR_CODES.VALIDATION_ERROR, message, 400, details);
}

export function conflict(message: string) {
  return errorResponse(ERROR_CODES.CONFLICT, message, 409);
}

export function rateLimited(retryAfterSeconds: number) {
  return errorResponse(ERROR_CODES.RATE_LIMITED, "Rate limit exceeded", 429, {
    retry_after_seconds: retryAfterSeconds,
  });
}

export function badRequest(message: string) {
  return errorResponse(ERROR_CODES.BAD_REQUEST, message, 400);
}

export function queueFull(estimatedWaitSeconds?: number) {
  return errorResponse(ERROR_CODES.RATE_LIMITED, "Compute queue is full", 429, {
    ...(estimatedWaitSeconds !== undefined ? { estimated_wait_seconds: estimatedWaitSeconds } : {}),
  });
}

export function internalError(message = "Internal server error", cause?: unknown) {
  if (cause) {
    import("@sentry/nextjs")
      .then((Sentry) => {
        Sentry.captureException(cause, { extra: { message } });
      })
      .catch(() => {
        /* Sentry not available */
      });
  }
  return errorResponse(ERROR_CODES.INTERNAL_ERROR, message, 500);
}
