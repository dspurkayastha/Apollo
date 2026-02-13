import { describe, it, expect } from "vitest";

/**
 * Auth Tests
 *
 * These tests verify that unauthenticated requests to protected API routes
 * return appropriate error responses. They test the Clerk middleware
 * protection layer.
 *
 * Note: These tests require a running dev server. In CI, they run
 * against the built app. Locally, start `pnpm dev` first.
 */

const BASE_URL = process.env.BASE_URL ?? "";

// Skip if no BASE_URL — these tests require a running dev server
const describeWithServer =
  BASE_URL ? describe : describe.skip;

describeWithServer("Auth Tests", () => {
  describe("Unauthenticated requests return 401", () => {
    const protectedRoutes = [
      { method: "GET", path: "/api/projects" },
      { method: "POST", path: "/api/projects" },
      { method: "GET", path: "/api/licenses" },
      {
        method: "POST",
        path: "/api/upload/signed-url",
      },
    ];

    for (const route of protectedRoutes) {
      it(`${route.method} ${route.path} returns 401`, async () => {
        const res = await fetch(`${BASE_URL}${route.path}`, {
          method: route.method,
          headers: { "Content-Type": "application/json" },
          body:
            route.method === "POST" ? JSON.stringify({ test: true }) : undefined,
        });

        // Clerk middleware returns 401 for unauthenticated API requests
        expect(res.status).toBe(401);
      });
    }
  });

  describe("Webhook endpoint does not require auth", () => {
    it("POST /api/webhooks/clerk returns 400 (bad signature, not 401)", async () => {
      const res = await fetch(`${BASE_URL}/api/webhooks/clerk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "svix-id": "msg_test",
          "svix-timestamp": "1234567890",
          "svix-signature": "invalid",
        },
        body: JSON.stringify({ type: "user.created", data: {} }),
      });

      // Should fail signature verification (400), not auth (401)
      expect(res.status).toBe(400);
    });
  });
});
