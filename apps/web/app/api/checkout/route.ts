import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, validationError, internalError } from "@/lib/api/errors";
import { checkoutSchema, PLAN_PRICES } from "@/lib/validation/payment-schemas";
import { createRazorpayOrder, RAZORPAY_KEY_ID } from "@/lib/payments/razorpay";
import { createStripeSession } from "@/lib/payments/stripe";

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("Invalid checkout data", {
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const { plan_type, currency, project_id } = parsed.data;
    const pricing = PLAN_PRICES[plan_type];
    if (!pricing) {
      return validationError("Invalid plan type");
    }

    const amount = currency === "INR" ? pricing.INR : pricing.USD;
    const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const metadata = {
      user_id: authResult.user.id,
      plan_type,
      plan_label: pricing.label,
      ...(project_id ? { project_id } : {}),
    };

    if (currency === "INR") {
      // Razorpay for INR payments
      const order = await createRazorpayOrder(amount, "INR", metadata);

      return NextResponse.json({
        data: {
          provider: "razorpay",
          order_id: order.id,
          key_id: RAZORPAY_KEY_ID,
          amount: order.amount,
          currency: order.currency,
          notes: metadata,
        },
      });
    } else {
      // Stripe for USD payments
      const session = await createStripeSession(
        amount,
        "USD",
        metadata,
        `${origin}/dashboard?payment=success`,
        `${origin}/dashboard?payment=cancelled`
      );

      return NextResponse.json({
        data: {
          provider: "stripe",
          redirect_url: session.url,
          session_id: session.sessionId,
        },
      });
    }
  } catch (err) {
    console.error("Checkout error:", err);
    return internalError();
  }
}
