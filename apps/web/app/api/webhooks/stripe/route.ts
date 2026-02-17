import { NextRequest, NextResponse } from "next/server";
import { constructStripeEvent } from "@/lib/payments/stripe";
import {
  provisionLicence,
  claimWebhookEvent,
} from "@/lib/payments/provision-licence";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { LicencePlanType } from "@/lib/types/database";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 }
      );
    }

    let event;
    try {
      event = constructStripeEvent(body, signature);
    } catch (err) {
      console.error("Stripe signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Atomic idempotency: claim the event BEFORE processing.
    const claimed = await claimWebhookEvent("stripe", event.id, event.type);
    if (!claimed) {
      return NextResponse.json({ status: "already_processed" });
    }

    // One-time checkout completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as {
        metadata?: Record<string, string>;
        payment_status?: string;
      };

      if (session.payment_status !== "paid") {
        return NextResponse.json({ status: "not_paid" });
      }

      const metadata = session.metadata ?? {};
      const userId = metadata.user_id;
      const planType = metadata.plan_type as LicencePlanType;
      const projectId = metadata.project_id;

      if (!userId || !planType) {
        console.error("Stripe webhook missing user_id or plan_type in metadata");
        return NextResponse.json(
          { error: "Missing metadata" },
          { status: 400 }
        );
      }

      await provisionLicence(userId, planType, projectId);
      return NextResponse.json({ status: "licence_provisioned" });
    }

    // Subscription renewal: extend expiry and reset monthly counters.
    // NOTE: Updates ALL active monthly licences for this user, not a specific one.
    // If a user has multiple active monthly licences (rare), all get renewed.
    // Future: store Stripe subscription_id on the licence for precise targeting.
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as {
        subscription_details?: { metadata?: Record<string, string> };
        metadata?: Record<string, string>;
      };

      const metadata =
        invoice.subscription_details?.metadata ?? invoice.metadata ?? {};
      const userId = metadata.user_id;

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

    // Subscription deleted: log only (licence expires naturally)
    if (event.type === "customer.subscription.deleted") {
      console.log("Stripe subscription deleted:", event.id);
      return NextResponse.json({ status: "subscription_deleted_logged" });
    }

    // Acknowledge other events without processing
    return NextResponse.json({ status: "ignored" });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
