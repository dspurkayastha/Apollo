export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiError;
}

export type ApiResult<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError };

export const ERROR_CODES = {
  UNAUTHORISED: "UNAUTHORISED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  LICENCE_REQUIRED: "LICENCE_REQUIRED",
  RATE_LIMITED: "RATE_LIMITED",
  CONFLICT: "CONFLICT",
  PAYMENT_REQUIRED: "PAYMENT_REQUIRED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
