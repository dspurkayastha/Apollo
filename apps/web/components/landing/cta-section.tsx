"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";

export function CTASection() {
  return (
    <section className="py-14 md:py-[102px]">
      <div className="container flex justify-center">
        <motion.div
          className="group relative max-w-[690px] overflow-hidden rounded-[32px] bg-white px-16 py-10 text-center landing-card-elevated"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
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
          {/* Cursor-tracking blue glow on hover */}
          <div
            className="pointer-events-none absolute inset-0 rounded-[32px] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(48,119,201,0.15) 0%, rgba(48,119,201,0.12) 20%, rgba(48,119,201,0.06) 40%, transparent 80%)",
            }}
          />
          <h2 className="relative font-serif text-[32px] tracking-tight text-[#2F2F2F]">
            Ready to Start Your Thesis?
          </h2>
          <p className="relative mt-3 text-lg text-[#6B6B6B]">
            Join thousands of medical postgraduates who trust Apollo for
            publication-ready thesis generation.
          </p>
          <div className="relative mt-6 flex items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-full bg-[#2F2F2F] px-6 py-3 text-[15px] font-medium text-white transition-colors hover:bg-[#2F2F2F]/90"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center rounded-full border border-black/[0.06] px-6 py-3 text-[15px] font-medium text-[#2F2F2F] transition-colors hover:bg-black/[0.04]"
            >
              View Pricing
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
