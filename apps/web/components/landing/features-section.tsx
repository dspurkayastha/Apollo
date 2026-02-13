"use client";

import {
  GraduationCap,
  Brain,
  BookOpen,
  BarChart3,
  FileSearch,
  FileOutput,
} from "lucide-react";
import { motion } from "motion/react";

const features = [
  {
    icon: GraduationCap,
    title: "University Templates",
    description:
      "WBUHS, SSUHS, and generic formats with university-compliant LaTeX formatting.",
  },
  {
    icon: Brain,
    title: "AI Writing Assistant",
    description:
      "Claude-powered generation with structured workflows for each thesis phase.",
  },
  {
    icon: BookOpen,
    title: "Citation Management",
    description:
      "Automated citation verification via PubMed and CrossRef with provenance tracking.",
  },
  {
    icon: BarChart3,
    title: "Statistical Analysis",
    description:
      "Integrated R-based analysis: descriptive stats, chi-square, t-tests, survival analysis.",
  },
  {
    icon: FileSearch,
    title: "Smart Synopsis Parsing",
    description:
      "Upload your synopsis and auto-populate metadata, study type, and methodology.",
  },
  {
    icon: FileOutput,
    title: "Export & Compilation",
    description:
      "One-click LaTeX compilation to publication-ready PDF with zero blocking errors.",
  },
];

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="container">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything You Need for Your Thesis
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From synopsis to submission, Apollo handles every step of your
            medical thesis workflow.
          </p>
        </motion.div>
        <motion.div
          className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              className="rounded-xl border bg-card p-6 transition-colors hover:border-primary/40"
              variants={itemVariants}
              whileHover={{ y: -5 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 ring-8 ring-primary/10">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
