import { z } from "zod";

export const checkoutSchema = z.object({
  plan_type: z.enum([
    "student_onetime",
    "student_monthly",
    "professional_onetime",
    "professional_monthly",
    "addon",
    "one_time", // legacy
  ]),
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
