import { NextRequest, NextResponse } from "next/server";
import { constructStripeEvent } from "@/lib/payments/stripe";
import {
  provisionLicence,
  isEventProcessed,
  markEventProcessed,
} from "@/lib/payments/provision-licence";
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

    // Idempotency check
    if (await isEventProcessed("stripe", event.id)) {
      return NextResponse.json({ status: "already_processed" });
    }

    // Only process completed checkout sessions
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
      await markEventProcessed("stripe", event.id, event.type);

      return NextResponse.json({ status: "licence_provisioned" });
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
