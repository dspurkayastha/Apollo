"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, CheckCircle2, CreditCard, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PlanCard {
  plan_type: string;
  label: string;
  priceINR: string;
  priceUSD: string;
  description: string;
  features: string[];
  recommended?: boolean;
}

const PLANS: PlanCard[] = [
  {
    plan_type: "student_monthly",
    label: "Student Plan",
    priceINR: "\u20B9499",
    priceUSD: "$9.99",
    description: "Ideal for individual PG students working on a single thesis.",
    features: [
      "1 thesis licence",
      "All 12 GOLD Standard phases",
      "AI generation for all sections",
      "Statistical analysis pipeline",
      "PDF + DOCX export",
      "30-day access",
    ],
    recommended: true,
  },
  {
    plan_type: "professional_monthly",
    label: "Professional Plan",
    priceINR: "\u20B9999",
    priceUSD: "$19.99",
    description: "For researchers managing multiple theses or publications.",
    features: [
      "3 thesis licences",
      "Everything in Student Plan",
      "Priority compile queue",
      "Supervisor collaboration links",
      "Source LaTeX export",
      "30-day access",
    ],
  },
  {
    plan_type: "one_time",
    label: "One-Time Thesis",
    priceINR: "\u20B91,499",
    priceUSD: "$29.99",
    description: "Pay once, complete one thesis at your own pace.",
    features: [
      "1 thesis licence",
      "No time limit",
      "All features included",
      "Supervisor collaboration",
      "All export formats",
    ],
  },
];

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: () => void) => void;
    };
  }
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="animate-pulse space-y-4 p-8"><div className="h-8 w-48 rounded bg-[#F0F0F0]" /><div className="h-64 rounded bg-[#F5F5F5]" /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const attachProjectId = searchParams.get("attach");
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [loading, setLoading] = useState<string | null>(null);

  async function handleCheckout(planType: string) {
    setLoading(planType);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_type: planType,
          currency,
          ...(attachProjectId ? { project_id: attachProjectId } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? "Checkout failed");
      }

      const { data } = await res.json();

      if (data.provider === "stripe" && data.redirect_url) {
        // Stripe — redirect to hosted checkout
        window.location.href = data.redirect_url;
        return;
      }

      if (data.provider === "razorpay" && data.order_id) {
        // Razorpay — open checkout modal
        await openRazorpayCheckout(data);
        return;
      }

      throw new Error("Unknown payment provider response");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Payment initiation failed"
      );
    } finally {
      setLoading(null);
    }
  }

  async function openRazorpayCheckout(data: {
    order_id: string;
    key_id: string;
    amount: number;
    currency: string;
    notes: Record<string, string>;
  }) {
    // Load Razorpay script if not already loaded
    if (!window.Razorpay) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Razorpay"));
        document.body.appendChild(script);
      });
    }

    const razorpay = new window.Razorpay!({
      key: data.key_id,
      amount: data.amount,
      currency: data.currency,
      name: "Apollo Thesis",
      description: data.notes.plan_label ?? "Thesis Licence",
      order_id: data.order_id,
      notes: data.notes,
      theme: { color: "#2F2F2F" },
      handler: () => {
        toast.success("Payment successful! Your licence is being provisioned.");
        // Redirect to dashboard after short delay to allow webhook processing
        setTimeout(() => {
          if (attachProjectId) {
            router.push(`/projects/${attachProjectId}`);
          } else {
            router.push("/dashboard?payment=success");
          }
        }, 2000);
      },
      modal: {
        ondismiss: () => {
          setLoading(null);
        },
      },
    });

    razorpay.open();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2">
        <Link
          href={attachProjectId ? `/projects/${attachProjectId}` : "/dashboard"}
          className="inline-flex items-center gap-1 text-sm text-[#6B6B6B] hover:text-[#2F2F2F] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <h1 className="font-serif text-2xl font-bold text-[#2F2F2F]">
          Choose a Plan
        </h1>
        <p className="text-sm text-[#6B6B6B]">
          Attach a thesis licence to continue generating your thesis beyond
          Phase 1.
          {attachProjectId && (
            <span className="ml-1 font-medium text-[#8B9D77]">
              The licence will be attached to your current project.
            </span>
          )}
        </p>
      </div>

      {/* Currency toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-[#6B6B6B]">Currency:</span>
        <div className="flex rounded-full border border-black/[0.06] bg-white p-0.5">
          <button
            onClick={() => setCurrency("INR")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              currency === "INR"
                ? "bg-[#2F2F2F] text-white"
                : "text-[#6B6B6B] hover:text-[#2F2F2F]"
            }`}
          >
            INR (\u20B9)
          </button>
          <button
            onClick={() => setCurrency("USD")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              currency === "USD"
                ? "bg-[#2F2F2F] text-white"
                : "text-[#6B6B6B] hover:text-[#2F2F2F]"
            }`}
          >
            USD ($)
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.plan_type}
            className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
              plan.recommended
                ? "border-[#8B9D77]/40 bg-[#8B9D77]/[0.03] shadow-[0_2px_12px_rgba(139,157,119,0.1)]"
                : "border-black/[0.06] bg-white"
            }`}
          >
            {plan.recommended && (
              <span className="absolute -top-2.5 left-4 rounded-full bg-[#8B9D77] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                Recommended
              </span>
            )}

            <h3 className="font-serif text-lg font-semibold text-[#2F2F2F]">
              {plan.label}
            </h3>

            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-[#2F2F2F]">
                {currency === "INR" ? plan.priceINR : plan.priceUSD}
              </span>
              {plan.plan_type.includes("monthly") && (
                <span className="text-sm text-[#6B6B6B]">/month</span>
              )}
            </div>

            <p className="mt-2 text-sm text-[#6B6B6B]">{plan.description}</p>

            <ul className="mt-4 flex-1 space-y-2">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-sm text-[#2F2F2F]/80"
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8B9D77]" />
                  {feature}
                </li>
              ))}
            </ul>

            <Button
              onClick={() => handleCheckout(plan.plan_type)}
              disabled={loading !== null}
              className="mt-6 gap-2"
              variant={plan.recommended ? "default" : "outline"}
            >
              {loading === plan.plan_type ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {loading === plan.plan_type ? "Processing..." : "Get Started"}
            </Button>
          </div>
        ))}
      </div>

      {/* Security note */}
      <div className="flex items-center justify-center gap-2 text-xs text-[#9CA3AF]">
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <span>
          Payments are processed securely via{" "}
          {currency === "INR" ? "Razorpay" : "Stripe"}. We never store your
          card details.
        </span>
      </div>
    </div>
  );
}
