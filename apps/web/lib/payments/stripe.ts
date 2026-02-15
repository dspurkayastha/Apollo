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
