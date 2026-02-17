import Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    _stripe = new Stripe(key, { apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion });
  }
  return _stripe;
}

/**
 * Create a Stripe Checkout session.
 */
export async function createStripeSession(
  amountInCents: number,
  currency: string,
  metadata: Record<string, string>,
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: metadata.plan_label ?? "Apollo Thesis Licence",
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      },
    ],
    metadata,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return {
    url: session.url!,
    sessionId: session.id,
  };
}

/** Env var mapping for Stripe subscription price IDs (monthly plans only) */
const STRIPE_PRICE_ENV: Record<string, string> = {
  student_monthly: "STRIPE_PRICE_ID_STUDENT_MONTHLY",
  addon: "STRIPE_PRICE_ID_ADDON",
};

/**
 * Create a Stripe Checkout session for subscriptions.
 */
export async function createStripeSubscriptionSession(
  planType: string,
  metadata: Record<string, string>,
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();

  const envKey = STRIPE_PRICE_ENV[planType];
  if (!envKey) {
    throw new Error(`No Stripe price ID mapping for plan type: ${planType}`);
  }

  const priceId = process.env[envKey];
  if (!priceId) {
    throw new Error(
      `${envKey} is not configured. Create a price in the Stripe Dashboard and add the price ID to your environment variables.`
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    metadata,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return {
    url: session.url!,
    sessionId: session.id,
  };
}

/**
 * Construct and verify a Stripe webhook event.
 */
export function constructStripeEvent(
  body: string,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET not configured");
  }

  return stripe.webhooks.constructEvent(body, signature, webhookSecret);
}
