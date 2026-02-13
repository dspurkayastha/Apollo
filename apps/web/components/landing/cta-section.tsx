"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="container">
        <motion.div
          className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-12 sm:p-16 text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          {/* Decorative orange glow orbs */}
          <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-primary/15 blur-[80px]" />
          <div className="absolute -left-20 -bottom-20 h-60 w-60 rounded-full bg-primary/10 blur-[80px]" />

          {/* Subtle grid pattern overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(24_95%_53%/0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />

          <div className="relative z-10">
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Ready to Start Your{" "}
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                Thesis
              </span>
              ?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
              Join thousands of medical postgraduates who trust Apollo for
              publication-ready thesis generation.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link href="/sign-up">
                <Button size="lg">
                  Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#pricing">
                <Button variant="outline" size="lg">
                  View Pricing
                </Button>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
