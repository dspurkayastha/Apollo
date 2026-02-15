import { z } from "zod";

export const checkoutSchema = z.object({
  plan_type: z.enum(["student_monthly", "professional_monthly", "addon", "one_time"]),
  currency: z.enum(["INR", "USD"]).default("INR"),
  project_id: z.string().uuid().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const razorpayWebhookSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string(),
        order_id: z.string(),
        amount: z.number(),
        currency: z.string(),
        status: z.string(),
        notes: z.record(z.string()).optional(),
      }),
    }),
  }),
});

export type RazorpayWebhookPayload = z.infer<typeof razorpayWebhookSchema>;

/** Plan pricing in smallest currency unit (paise for INR, cents for USD) */
export const PLAN_PRICES: Record<string, { INR: number; USD: number; label: string }> = {
  student_monthly: { INR: 49900, USD: 999, label: "Student Plan" },
  professional_monthly: { INR: 99900, USD: 1999, label: "Professional Plan" },
  addon: { INR: 29900, USD: 599, label: "Additional Thesis" },
  one_time: { INR: 149900, USD: 2999, label: "One-Time Thesis" },
};
