"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free Trial",
    monthlyPrice: "Free",
    onetimePrice: null,
    period: "7 days",
    description: "Explore the platform",
    features: [
      "Sandbox project",
      "Synopsis parsing",
      "Phase 1 preview",
      "Watermarked PDF",
    ],
    cta: "Start Free",
    href: "/sign-up",
    popular: false,
  },
  {
    name: "Student",
    monthlyPrice: "\u20B92,499",
    onetimePrice: "\u20B914,999",
    period: "/mo",
    onetimePeriod: "6-month access",
    description: "Complete your thesis",
    features: [
      "Everything in Free Trial",
      "Full 12-phase workflow",
      "LaTeX compilation",
      "Citation verification",
      "Statistical analysis",
    ],
    cta: "Get Started",
    href: "/sign-up",
    popular: true,
  },
  {
    name: "Professional",
    monthlyPrice: "\u20B94,999",
    onetimePrice: "\u20B924,999",
    period: "/mo",
    onetimePeriod: "6-month license",
    description: "For serious researchers",
    features: [
      "Everything in Student",
      "Supervisor dashboard",
      "Priority compilation",
      "DOCX export",
    ],
    cta: "Go Pro",
    href: "/sign-up",
    popular: false,
  },
];

export function PricingSection() {
  const [billing, setBilling] = useState<"monthly" | "onetime">("monthly");

  return (
    <section id="pricing" className="py-14 md:py-[102px]">
      <div className="container">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="font-serif text-3xl tracking-tight text-[#2F2F2F] sm:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-3 text-lg text-[#6B6B6B]">
            Choose the plan that fits your needs. No hidden fees.
          </p>
        </motion.div>

        <div className="mt-6 flex justify-center">
          <div className="inline-flex items-center rounded-full border border-black/[0.06] bg-white p-1">
            <button
              onClick={() => setBilling("monthly")}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-all",
                billing === "monthly"
                  ? "bg-[#2F2F2F] text-white shadow-sm"
                  : "text-[#6B6B6B] hover:text-[#2F2F2F]"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("onetime")}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-all",
                billing === "onetime"
                  ? "bg-[#2F2F2F] text-white shadow-sm"
                  : "text-[#6B6B6B] hover:text-[#2F2F2F]"
              )}
            >
              One-Time
            </button>
          </div>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              className={cn(
                "group relative flex flex-col rounded-2xl border border-black/[0.06] bg-white p-8 hover:border-[#C8964C]/30",
                plan.popular
                  ? "border-[#8B9D77] landing-card-elevated z-10 scale-[1.05]"
                  : "landing-card"
              )}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{
                scale: plan.popular ? 1.08 : 1.03,
              }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                e.currentTarget.style.setProperty("--mouse-x", `${x}%`);
                e.currentTarget.style.setProperty("--mouse-y", `${y}%`);
              }}
            >
              {/* Cursor-tracking amber glow on hover */}
              <div
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(200,150,76,0.15) 0%, rgba(200,150,76,0.12) 20%, rgba(200,150,76,0.06) 40%, transparent 80%)",
                }}
              />
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2F2F2F] px-3 py-1 text-xs font-semibold text-white">
                  Most Popular
                </span>
              )}
              <div className="relative mb-5">
                <h3 className="font-serif text-lg font-semibold text-[#2F2F2F]">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-[#6B6B6B]">
                  {plan.description}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={billing}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="text-4xl font-bold text-[#2F2F2F]"
                    >
                      {billing === "monthly"
                        ? plan.monthlyPrice
                        : (plan.onetimePrice ?? plan.monthlyPrice)}
                    </motion.span>
                  </AnimatePresence>
                  {plan.monthlyPrice !== "Free" && (
                    <span className="text-sm text-[#6B6B6B]">
                      {billing === "monthly"
                        ? plan.period
                        : plan.onetimePeriod}
                    </span>
                  )}
                </div>
                {plan.monthlyPrice === "Free" && (
                  <span className="text-sm text-[#6B6B6B]">
                    {plan.period}
                  </span>
                )}
              </div>
              <ul className="relative mb-6 flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#8B9D77]" />
                    <span className="text-sm text-[#6B6B6B]">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href={plan.href} className="relative">
                <button
                  className={cn(
                    "w-full rounded-full py-2.5 text-sm font-medium transition-colors",
                    plan.popular
                      ? "bg-[#2F2F2F] text-white hover:bg-[#2F2F2F]/90"
                      : "border border-black/[0.06] text-[#2F2F2F] hover:bg-black/[0.04]"
                  )}
                >
                  {plan.cta}
                </button>
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-[#6B6B6B]">
          Need departmental licensing?{" "}
          <a
            href="mailto:contact@apollo.dev"
            className="text-[#2F2F2F] hover:underline"
          >
            Contact us
          </a>{" "}
          for institutional pricing starting at ₹1,999/student/semester.
        </p>
      </div>
    </section>
  );
}
