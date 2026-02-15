const R_PLUMBER_URL =
  process.env.R_PLUMBER_URL ?? "http://localhost:8787";

export interface RPlumberResult<T> {
  data: T;
  warnings: string[];
}

export class RPlumberError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly rError?: string
  ) {
    super(message);
    this.name = "RPlumberError";
  }
}

/**
 * Call an R Plumber API endpoint with timeout enforcement.
 */
export async function callRPlumber<T>(
  endpoint: string,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<RPlumberResult<T>> {
  const url = `${R_PLUMBER_URL}${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new RPlumberError(
        `R Plumber returned ${response.status}: ${text}`,
        response.status,
        text
      );
    }

    const result = (await response.json()) as Record<string, unknown>;

    // R Plumber returns error field when R code throws
    if (result.error) {
      throw new RPlumberError(
        `R analysis error: ${String(result.error)}`,
        undefined,
        String(result.error)
      );
    }

    return {
      data: result as T,
      warnings: Array.isArray(result.warnings)
        ? (result.warnings as string[])
        : [],
    };
  } catch (err) {
    if (err instanceof RPlumberError) throw err;

    if (err instanceof DOMException && err.name === "AbortError") {
      throw new RPlumberError(
        `R analysis timed out after ${timeoutMs}ms`,
        undefined,
        "timeout"
      );
    }

    throw new RPlumberError(
      `Failed to connect to R Plumber: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Health check — verify the R Plumber service is available.
 */
export async function checkRPlumberHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${R_PLUMBER_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
