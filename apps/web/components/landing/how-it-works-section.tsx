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

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 25,
    },
  },
};

export function HowItWorksSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="container">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-center">
          How It Works
        </h2>
        <p className="mt-4 text-lg text-muted-foreground text-center mx-auto max-w-2xl">
          From synopsis to submission in four simple steps.
        </p>

        <motion.div
          className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              className="relative flex flex-col items-center text-center"
              variants={itemVariants}
              whileHover={{ y: -3 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              {/* Connecting dashed line between steps (desktop only, not on last item) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-7 left-[calc(50%+28px)] w-[calc(100%-56px)] border-t-2 border-dashed border-primary/50" />
              )}

              {/* Step number circle */}
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-primary/20 text-primary font-bold text-lg">
                {index + 1}
              </div>

              {/* Icon */}
              <step.icon className="mt-4 h-6 w-6 text-muted-foreground" />

              {/* Title */}
              <h3 className="mt-3 text-base font-semibold">{step.title}</h3>

              {/* Description */}
              <p className="mt-2 text-sm text-muted-foreground">
                {step.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
