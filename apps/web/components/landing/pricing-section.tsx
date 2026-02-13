"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export function PricingSection() {
  const [billing, setBilling] = useState<"monthly" | "onetime">("monthly");

  return (
    <section id="pricing" className="py-20 sm:py-28">
      <div className="container">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Choose the plan that fits your needs. No hidden fees.
          </p>
        </motion.div>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex items-center rounded-full border bg-muted p-1">
            <button
              onClick={() => setBilling("monthly")}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-all",
                billing === "monthly"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("onetime")}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-all",
                billing === "onetime"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              One-Time
            </button>
          </div>
        </div>

        <motion.div
          className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
        >
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              className={cn(
                "relative flex flex-col rounded-xl border bg-card p-8",
                plan.popular && "glow-border shadow-xl relative z-10 scale-[1.05]"
              )}
              variants={itemVariants}
              whileHover={{
                scale: plan.popular ? 1.08 : 1.03,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Most Popular
                </span>
              )}
              <div className="mb-6">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.description}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={billing}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="text-4xl font-bold"
                    >
                      {billing === "monthly"
                        ? plan.monthlyPrice
                        : (plan.onetimePrice ?? plan.monthlyPrice)}
                    </motion.span>
                  </AnimatePresence>
                  {plan.monthlyPrice !== "Free" && (
                    <span className="text-sm text-muted-foreground">
                      {billing === "monthly"
                        ? plan.period
                        : plan.onetimePeriod}
                    </span>
                  )}
                </div>
                {plan.monthlyPrice === "Free" && (
                  <span className="text-sm text-muted-foreground">
                    {plan.period}
                  </span>
                )}
              </div>
              <ul className="mb-8 flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href={plan.href}>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                >
                  {plan.cta}
                </Button>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <p className="mt-12 text-center text-sm text-muted-foreground">
          Need departmental licensing?{" "}
          <a
            href="mailto:contact@apollo.dev"
            className="text-primary hover:underline"
          >
            Contact us
          </a>{" "}
          for institutional pricing starting at ₹1,999/student/semester.
        </p>
      </div>
    </section>
  );
}
