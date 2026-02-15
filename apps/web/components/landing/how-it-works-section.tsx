"use client";

import { FileUp, Brain, Pencil, FileOutput } from "lucide-react";
import { motion } from "motion/react";

const steps = [
  {
    icon: FileUp,
    title: "Upload Synopsis",
    description:
      "Upload your approved synopsis PDF. Apollo extracts metadata, study type, and methodology automatically.",
  },
  {
    icon: Brain,
    title: "AI Parses & Populates",
    description:
      "Our AI engine populates each thesis phase with structured content, citations, and statistical frameworks.",
  },
  {
    icon: Pencil,
    title: "Review & Edit",
    description:
      "Edit and refine each phase with AI assistance. Add your findings, tables, and analysis.",
  },
  {
    icon: FileOutput,
    title: "Export PDF",
    description:
      "One-click LaTeX compilation to a publication-ready, university-compliant PDF.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-14 md:py-[102px]">
      <div className="container">
        <h2 className="text-center font-serif text-3xl tracking-tight text-[#2F2F2F] sm:text-4xl">
          How It Works
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-[#6B6B6B]">
          From synopsis to submission in four simple steps.
        </p>

        <motion.div
          className="mt-12 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.15 } },
          }}
        >
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              className="relative flex flex-col items-center text-center"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                },
              }}
            >
              {/* Sage connecting line */}
              {index < steps.length - 1 && (
                <div className="absolute left-[calc(50%+28px)] top-7 hidden h-0.5 w-[calc(100%-56px)] bg-[#8B9D77] lg:block" />
              )}

              {/* Charcoal outlined circle */}
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#2F2F2F] text-lg font-bold text-[#2F2F2F]">
                {index + 1}
              </div>

              <step.icon className="mt-4 h-6 w-6 text-[#6B6B6B]" strokeWidth={1.5} />
              <h3 className="mt-3 font-serif text-base font-semibold text-[#2F2F2F]">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-[#6B6B6B]">{step.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
