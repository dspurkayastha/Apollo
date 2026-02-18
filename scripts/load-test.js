/**
 * k6 Load Test — Apollo Platform
 *
 * Referenced by docs/governance/release-gates.md as a hard pre-launch gate.
 * Scenarios from PLAN.md capacity model.
 *
 * Usage:
 *   k6 run scripts/load-test.js \
 *     -e BASE_URL=https://apollo.example.com \
 *     -e AUTH_TOKEN=<valid-jwt>
 *
 * Requires: k6 (https://k6.io/docs/get-started/installation/)
 */

import http from "k6/http";
import exec from "k6/execution";
import { check, group, sleep } from "k6";
import { Trend, Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = __ENV.AUTH_TOKEN;
const TEST_PROJECT_ID = __ENV.TEST_PROJECT_ID || "00000000-0000-0000-0000-000000000000";

// Custom metrics
const compileDuration = new Trend("compile_duration", true);
const analysisDuration = new Trend("analysis_duration", true);
const aiGenerationDuration = new Trend("ai_generation_duration", true);
const compileErrors = new Counter("compile_errors");

function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (AUTH_TOKEN) {
    headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
  }
  return headers;
}

// ─── Scenarios ───

export const options = {
  scenarios: {
    // Scenario 1: Sequential compiles (3 sequential + 2 queued)
    sequential_compiles: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 5,
      startTime: "0s",
      maxDuration: "10m",
      tags: { scenario: "sequential_compiles" },
    },

    // Scenario 2: Concurrent R analyses (2 concurrent)
    concurrent_analyses: {
      executor: "constant-vus",
      vus: 2,
      duration: "3m",
      startTime: "0s",
      tags: { scenario: "concurrent_analyses" },
    },

    // Scenario 3: Mixed load (1 compile + 1 analysis concurrent)
    mixed_load: {
      executor: "constant-vus",
      vus: 2,
      duration: "3m",
      startTime: "5m",
      tags: { scenario: "mixed_load" },
    },

    // Scenario 4: AI generation load (10 concurrent)
    ai_generation_load: {
      executor: "constant-vus",
      vus: 10,
      duration: "2m",
      startTime: "0s",
      tags: { scenario: "ai_generation" },
    },

    // Scenario 5: No-contention single compile (for p95 baseline)
    no_contention_compile: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 3,
      startTime: "10m",
      maxDuration: "5m",
      tags: { scenario: "no_contention" },
    },
  },

  thresholds: {
    // p95 < 60s for no-contention single compile
    "compile_duration{scenario:no_contention}": ["p(95)<60000"],
    // p95 < 90s for mixed load compile
    "compile_duration{scenario:mixed_load}": ["p(95)<90000"],
    // No more than 10% compile errors
    compile_errors: ["count<3"],
  },
};

// ─── Scenario Handlers ───

export default function () {
  const scenario = __ENV.K6_SCENARIO || exec.scenario.name;

  switch (scenario) {
    case "sequential_compiles":
    case "no_contention_compile":
      runCompile();
      break;
    case "concurrent_analyses":
      runAnalysis();
      break;
    case "mixed_load":
      // Even VU IDs do compile, odd do analysis
      if (__VU % 2 === 0) {
        runCompile();
      } else {
        runAnalysis();
      }
      break;
    case "ai_generation_load":
      runAIGeneration();
      break;
    default:
      runCompile();
  }
}

// ─── Workload Functions ───

function runCompile() {
  group("LaTeX Compilation", function () {
    const start = Date.now();

    const res = http.post(
      `${BASE_URL}/api/projects/${TEST_PROJECT_ID}/compile`,
      JSON.stringify({ force: true }),
      { headers: authHeaders(), timeout: "120s" }
    );

    const duration = Date.now() - start;
    compileDuration.add(duration);

    const ok = check(res, {
      "compile status 200": (r) => r.status === 200,
      "compile has pdf_url": (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!body.pdf_url || !!body.pdfUrl;
        } catch {
          return false;
        }
      },
    });

    if (!ok) {
      compileErrors.add(1);
    }

    // Brief pause between sequential compiles
    sleep(2);
  });
}

function runAnalysis() {
  group("R Analysis", function () {
    const start = Date.now();

    const res = http.post(
      `${BASE_URL}/api/projects/${TEST_PROJECT_ID}/analyses/execute`,
      JSON.stringify({ analysisType: "descriptive" }),
      { headers: authHeaders(), timeout: "180s" }
    );

    const duration = Date.now() - start;
    analysisDuration.add(duration);

    check(res, {
      "analysis status 200": (r) => r.status === 200,
      "analysis completed": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status === "completed" || body.status === "success";
        } catch {
          return false;
        }
      },
    });

    sleep(5);
  });
}

function runAIGeneration() {
  group("AI Generation", function () {
    const start = Date.now();

    const res = http.post(
      `${BASE_URL}/api/projects/${TEST_PROJECT_ID}/sections/introduction/generate`,
      JSON.stringify({ prompt: "Generate a test introduction" }),
      { headers: authHeaders(), timeout: "60s" }
    );

    const duration = Date.now() - start;
    aiGenerationDuration.add(duration);

    check(res, {
      "ai gen status 200": (r) => r.status === 200,
      "ai gen has content": (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!body.content || !!body.latex_content;
        } catch {
          return false;
        }
      },
    });

    sleep(1);
  });
}

// ─── Lifecycle Hooks ───

export function setup() {
  // Verify base URL is reachable
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, {
    "health endpoint reachable": (r) => r.status === 200,
  });

  if (res.status !== 200) {
    console.error(`Health check failed: ${res.status} ${res.body}`);
    return { abort: true };
  }

  console.log(`Load test targeting: ${BASE_URL}`);
  console.log(`Test project ID: ${TEST_PROJECT_ID}`);
  return {};
}

export function teardown(data) {
  if (data && data.abort) {
    console.error("Test aborted due to health check failure");
  }
}
