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

export function FeaturesSection() {
  return (
    <section id="features" className="py-14 md:py-[102px]">
      <div className="container">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="font-serif text-3xl tracking-tight text-[#2F2F2F] sm:text-4xl">
            Everything You Need for Your Thesis
          </h2>
          <p className="mt-3 text-lg text-[#6B6B6B]">
            From synopsis to submission, Apollo handles every step of your
            medical thesis workflow.
          </p>
        </motion.div>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className={`group relative overflow-hidden rounded-2xl border border-black/[0.06] bg-gradient-to-b from-white to-[#FAFAF8] p-10 zen-shadow-card transition-[border-color,box-shadow] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[#8B9D77]/30 lg:p-16 ${index % 3 === 1 ? "lg:-translate-y-8" : ""}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{
                duration: 0.5,
                delay: index * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                e.currentTarget.style.setProperty("--mouse-x", `${x}%`);
                e.currentTarget.style.setProperty("--mouse-y", `${y}%`);
              }}
            >
              {/* Cursor-tracking sage glow on hover */}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(139,157,119,0.15) 0%, rgba(139,157,119,0.12) 20%, rgba(139,157,119,0.06) 40%, transparent 80%)",
                }}
              />
              <feature.icon className="relative h-12 w-12 text-[#2F2F2F]" strokeWidth={1.5} />
              <h3 className="relative mt-5 font-serif text-2xl text-[#2F2F2F]">
                {feature.title}
              </h3>
              <p className="relative mt-3 text-base leading-relaxed text-[#6B6B6B]">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
