import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpaySignature } from "@/lib/payments/razorpay";
import {
  provisionLicence,
  isEventProcessed,
  markEventProcessed,
} from "@/lib/payments/provision-licence";
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
    const eventId = event.payload?.payment?.entity?.id;
    const eventType = event.event;

    if (!eventId) {
      return NextResponse.json(
        { error: "Missing payment ID" },
        { status: 400 }
      );
    }

    // Idempotency check
    if (await isEventProcessed("razorpay", eventId)) {
      return NextResponse.json({ status: "already_processed" });
    }

    // Only process successful payments
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
      await markEventProcessed("razorpay", eventId, eventType);

      return NextResponse.json({ status: "licence_provisioned" });
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
