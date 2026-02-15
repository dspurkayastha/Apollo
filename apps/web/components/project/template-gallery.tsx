"use client";

import Link from "next/link";

interface StudyTemplate {
  id: string;
  name: string;
  guideline: string;
  description: string;
  phases: string;
  icon: string;
}

const STUDY_TEMPLATES: StudyTemplate[] = [
  {
    id: "rct",
    name: "Randomised Controlled Trial",
    guideline: "CONSORT",
    description:
      "Interventional study with randomised allocation. Includes blinding, control groups, and intention-to-treat analysis.",
    phases: "All 12 phases with statistical analysis focus",
    icon: "R",
  },
  {
    id: "cohort",
    name: "Observational Cohort",
    guideline: "STROBE",
    description:
      "Prospective or retrospective cohort following exposed and unexposed groups over time to measure outcomes.",
    phases: "Full pipeline including survival analysis",
    icon: "C",
  },
  {
    id: "cross-sectional",
    name: "Cross-Sectional Study",
    guideline: "STROBE",
    description:
      "Single time-point assessment of prevalence and associations. Common for questionnaire-based research.",
    phases: "Descriptive stats, chi-square, and correlation focus",
    icon: "X",
  },
  {
    id: "case-control",
    name: "Case-Control Study",
    guideline: "STROBE",
    description:
      "Retrospective comparison of cases (with outcome) and controls (without). Measures odds ratios.",
    phases: "Logistic regression and ROC analysis emphasis",
    icon: "K",
  },
  {
    id: "case-report",
    name: "Case Report / Series",
    guideline: "CARE",
    description:
      "Detailed clinical description of one or more patients. Focuses on unusual presentations or novel treatments.",
    phases: "Shorter pipeline — no statistical analysis phase",
    icon: "P",
  },
  {
    id: "systematic-review",
    name: "Systematic Review / Meta-Analysis",
    guideline: "PRISMA",
    description:
      "Comprehensive literature search with quantitative pooling. Includes forest plots and heterogeneity assessment.",
    phases: "Extended ROL phase with PRISMA flow diagram",
    icon: "M",
  },
];

const UNIVERSITY_TEMPLATES = [
  {
    id: "wbuhs",
    name: "WBUHS / Kolkata",
    cls: "sskm-thesis.cls",
    features: ["Director designation", "REFERENCES heading", "Bottom-centre page numbers"],
    color: "#2F4858",
  },
  {
    id: "ssuhs",
    name: "SSUHS / Assam",
    cls: "ssuhs-thesis.cls",
    features: ["Principal designation", "BIBLIOGRAPHY heading", "Bottom-right pages + dept footer"],
    color: "#4A6741",
  },
];

export function TemplateGallery() {
  return (
    <div className="space-y-6">
      {/* University Format Templates */}
      <div>
        <h2 className="font-serif text-lg font-semibold text-[#2F2F2F]">University Formats</h2>
        <p className="text-sm text-[#6B6B6B]">
          Choose your university to apply the correct thesis formatting.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {UNIVERSITY_TEMPLATES.map((uni) => (
          <div
            key={uni.id}
            className="rounded-2xl border border-black/[0.06] bg-white p-4"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: uni.color }}
              >
                {uni.id.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="font-serif font-medium text-[#2F2F2F]">{uni.name}</h3>
                <span className="text-xs font-mono text-[#6B6B6B]">{uni.cls}</span>
              </div>
            </div>
            <ul className="mt-3 space-y-1">
              {uni.features.map((f) => (
                <li key={f} className="text-xs text-[#6B6B6B]">
                  — {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Study Type Templates */}
      <div>
        <h2 className="font-serif text-lg font-semibold text-[#2F2F2F]">Study Type Templates</h2>
        <p className="text-sm text-[#6B6B6B]">
          Choose a study design to see pre-configured compliance checklists and
          analysis workflows.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STUDY_TEMPLATES.map((template) => (
          <Link
            key={template.id}
            href="/projects/new"
            className="group rounded-2xl border border-black/[0.06] bg-white p-4 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2F2F2F] font-bold text-white">
                {template.icon}
              </div>
              <div className="min-w-0">
                <h3 className="font-serif font-medium leading-tight text-[#2F2F2F]">
                  {template.name}
                </h3>
                <span className="mt-0.5 inline-block rounded-full bg-[#F0F0F0] px-2 py-0.5 text-xs font-medium text-[#6B6B6B]">
                  {template.guideline}
                </span>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-[#6B6B6B]">
              {template.description}
            </p>
            <p className="mt-1.5 text-xs text-[#9CA3AF]">
              {template.phases}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
