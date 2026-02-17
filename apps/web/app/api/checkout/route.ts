import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, validationError, notFound, internalError } from "@/lib/api/errors";
import { checkoutSchema } from "@/lib/validation/payment-schemas";
import { getPlanConfig, getPlanPrice } from "@/lib/pricing/config";
import { createRazorpayOrder, createRazorpaySubscription, RAZORPAY_KEY_ID } from "@/lib/payments/razorpay";
import { createStripeSession, createStripeSubscriptionSession } from "@/lib/payments/stripe";
import { checkVelocity } from "@/lib/payments/velocity-check";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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

    // Reject professional_monthly (coming soon)
    if (plan_type === "professional_monthly") {
      return validationError(
        "Professional Monthly plan is coming soon. Please choose a different plan."
      );
    }

    // Velocity check
    const velocity = await checkVelocity(authResult.user.id);
    if (!velocity.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "VELOCITY_LIMIT",
            message: `You have purchased ${velocity.count} licences in the last 30 days (limit: ${velocity.limit}). Please contact support if you need more.`,
          },
        },
        { status: 429 }
      );
    }

    // Verify project ownership if project_id provided
    if (project_id) {
      const adminDb = createAdminSupabaseClient();
      const { data: project } = await adminDb
        .from("projects")
        .select("id")
        .eq("id", project_id)
        .eq("user_id", authResult.user.id)
        .single();

      if (!project) return notFound("Project not found");
    }

    let planConfig;
    try {
      planConfig = getPlanConfig(plan_type);
    } catch {
      return validationError("Invalid plan type");
    }

    const amount = getPlanPrice(plan_type, currency);
    const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const metadata = {
      user_id: authResult.user.id,
      plan_type,
      plan_label: planConfig.label,
      ...(project_id ? { project_id } : {}),
    };

    const isSubscription = planConfig.billingType === "monthly";

    if (currency === "INR") {
      if (isSubscription) {
        // Razorpay subscription for monthly INR plans
        const sub = await createRazorpaySubscription(plan_type, metadata);
        return NextResponse.json({
          data: {
            provider: "razorpay_subscription",
            subscription_id: sub.subscriptionId,
            short_url: sub.shortUrl,
            key_id: RAZORPAY_KEY_ID,
            notes: metadata,
          },
        });
      }

      // Razorpay one-time order for INR
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
      if (isSubscription) {
        // Stripe subscription for monthly USD plans
        const session = await createStripeSubscriptionSession(
          plan_type,
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

      // Stripe one-time for USD
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
