import crypto from "crypto";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID!;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!;

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * Create a Razorpay order.
 */
export async function createRazorpayOrder(
  amountInPaise: number,
  currency: string,
  notes: Record<string, string>
): Promise<RazorpayOrder> {
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency,
      notes,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Razorpay order creation failed: ${res.status} ${body}`);
  }

  return res.json() as Promise<RazorpayOrder>;
}

/**
 * Verify Razorpay webhook signature (HMAC-SHA256).
 */
export function verifyRazorpaySignature(
  body: string,
  signature: string
): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET not configured");
  }

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(body)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}

/** Env var mapping for Razorpay subscription plan IDs */
const RAZORPAY_PLAN_ENV: Record<string, string> = {
  student_monthly: "RAZORPAY_PLAN_ID_STUDENT_MONTHLY",
  addon: "RAZORPAY_PLAN_ID_ADDON",
};

/**
 * Create a Razorpay subscription for monthly plans.
 */
export async function createRazorpaySubscription(
  planType: string,
  notes: Record<string, string>
): Promise<{ subscriptionId: string; shortUrl: string }> {
  const envKey = RAZORPAY_PLAN_ENV[planType];
  if (!envKey) {
    throw new Error(`No Razorpay plan ID mapping for plan type: ${planType}`);
  }

  const razorpayPlanId = process.env[envKey];
  if (!razorpayPlanId) {
    throw new Error(
      `${envKey} is not configured. Create a plan in the Razorpay Dashboard and add the plan ID to your environment variables.`
    );
  }

  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

  const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: razorpayPlanId,
      total_count: 12, // max 12 billing cycles
      notes,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Razorpay subscription creation failed: ${res.status} ${body}`);
  }

  const data = await res.json() as { id: string; short_url: string };
  return { subscriptionId: data.id, shortUrl: data.short_url };
}

export { RAZORPAY_KEY_ID };
