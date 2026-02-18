"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

const TOUR_STEPS = [
  {
    title: "Welcome to Apollo",
    description:
      "Apollo helps you generate a publication-ready medical thesis step by step. Let\u2019s take a quick tour of the workspace!",
    target: null, // No specific element
    position: "center" as const,
  },
  {
    title: "Pipeline Timeline",
    description:
      "Your thesis follows the GOLD Standard 12-phase methodology. Each dot represents a phase \u2014 complete and approve each one before moving to the next.",
    target: "[data-tour='pipeline']",
    position: "bottom" as const,
  },
  {
    title: "Editor",
    description:
      "Write and refine your thesis here. The AI generates LaTeX content for each phase, and you can edit it directly in the code editor.",
    target: "[data-tour='editor']",
    position: "right" as const,
  },
  {
    title: "Citation Panel",
    description:
      "Track your references and their verification status. Tier A citations are fully verified; Tier D need attention before Final QC.",
    target: "[data-tour='citations']",
    position: "top" as const,
  },
  {
    title: "Compile & Export",
    description:
      "Hit Compile to generate your PDF preview. Once you reach Phase 6, the Export menu unlocks PDF, LaTeX source, and statistics downloads.",
    target: "[data-tour='compile']",
    position: "bottom" as const,
  },
];

const STORAGE_KEY = "apollo_onboarding_complete";

export function TourOverlay() {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if tour has been completed
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      setVisible(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      handleDismiss();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  if (!visible) return null;

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      >
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="relative mx-4 max-w-md rounded-2xl bg-white p-6 shadow-xl"
        >
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute right-3 top-3 rounded-full p-1 text-[#6B6B6B] transition-colors hover:bg-[#F5F5F5] hover:text-[#2F2F2F]"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Step indicator */}
          <div className="mb-4 flex gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i === currentStep
                    ? "bg-[#8B9D77]"
                    : i < currentStep
                      ? "bg-[#8B9D77]/40"
                      : "bg-[#E5E5E5]"
                }`}
              />
            ))}
          </div>

          <h3 className="font-serif text-lg font-semibold text-[#2F2F2F]">
            {step.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[#6B6B6B]">
            {step.description}
          </p>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="text-[#6B6B6B]"
              >
                Skip Tour
              </Button>
              <Button
                size="sm"
                onClick={handleNext}
                className="gap-1"
              >
                {isLast ? "Get Started" : "Next"}
                {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
