import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function GET() {
  const checks: Record<string, "ok" | "degraded" | "down"> = {};

  // Check R Plumber
  const rPlumberUrl = process.env.R_PLUMBER_URL ?? "http://localhost:8787";
  try {
    const res = await fetch(`${rPlumberUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    checks.r_plumber = res.ok ? "ok" : "down";
  } catch {
    checks.r_plumber = "down";
  }

  // Check Docker availability (for compile mode)
  if (process.env.LATEX_COMPILE_MODE === "docker") {
    try {
      await execFileAsync("docker", ["info"], { timeout: 5000 });
      checks.docker = "ok";
    } catch {
      checks.docker = "down";
    }
  }

  const overallStatus = Object.values(checks).some((v) => v === "down")
    ? "degraded"
    : "ok";

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "0.1.0",
    checks,
  });
}
