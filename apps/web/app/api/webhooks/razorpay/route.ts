import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpaySignature } from "@/lib/payments/razorpay";
import {
  provisionLicence,
  claimWebhookEvent,
} from "@/lib/payments/provision-licence";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { LicencePlanType } from "@/lib/types/database";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 }
      );
    }

    // Verify HMAC-SHA256 signature
    if (!verifyRazorpaySignature(body, signature)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const event = JSON.parse(body);
    const eventType = event.event as string;

    // Extract event ID based on event type
    const eventId =
      event.payload?.payment?.entity?.id ??
      event.payload?.subscription?.entity?.id;

    if (!eventId) {
      return NextResponse.json(
        { error: "Missing event ID" },
        { status: 400 }
      );
    }

    // Atomic idempotency: claim the event BEFORE processing.
    const claimed = await claimWebhookEvent("razorpay", eventId, eventType);
    if (!claimed) {
      return NextResponse.json({ status: "already_processed" });
    }

    // One-time payment captured
    if (eventType === "payment.captured") {
      const payment = event.payload.payment.entity;
      const notes = payment.notes ?? {};
      const userId = notes.user_id;
      const planType = notes.plan_type as LicencePlanType;
      const projectId = notes.project_id;

      if (!userId || !planType) {
        console.error("Razorpay webhook missing user_id or plan_type in notes");
        return NextResponse.json(
          { error: "Missing metadata" },
          { status: 400 }
        );
      }

      await provisionLicence(userId, planType, projectId);
      return NextResponse.json({ status: "licence_provisioned" });
    }

    // Subscription charged (renewal): extend expiry and reset monthly counters.
    // NOTE: Updates ALL active monthly licences for this user, not a specific one.
    // If a user has multiple active monthly licences (rare), all get renewed.
    // Future: store Razorpay subscription_id on the licence for precise targeting.
    if (eventType === "subscription.charged") {
      const subscription = event.payload.subscription.entity;
      const notes = subscription.notes ?? {};
      const userId = notes.user_id;

      if (userId) {
        const supabase = createAdminSupabaseClient();
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 30);

        await supabase
          .from("thesis_licenses")
          .update({
            expires_at: newExpiry.toISOString(),
            monthly_phases_advanced: 0,
            billing_period_start: new Date().toISOString(),
            status: "active",
          })
          .eq("user_id", userId)
          .eq("status", "active")
          .in("plan_type", ["student_monthly", "addon"]);
      }

      return NextResponse.json({ status: "subscription_renewed" });
    }

    // Subscription cancelled: log only (licence expires naturally)
    if (eventType === "subscription.cancelled") {
      console.log("Razorpay subscription cancelled:", eventId);
      return NextResponse.json({ status: "subscription_cancelled_logged" });
    }

    // Acknowledge other events without processing
    return NextResponse.json({ status: "ignored" });
  } catch (err) {
    console.error("Razorpay webhook error:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
