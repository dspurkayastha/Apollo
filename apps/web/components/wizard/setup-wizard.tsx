"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { Project, UniversityType, ProjectMetadata } from "@/lib/types/database";
import type { ParsedSynopsis } from "@/lib/synopsis/parser";
import { UniversityStep } from "@/components/wizard/steps/university-step";
import { SynopsisUploadStep } from "@/components/wizard/steps/synopsis-upload-step";
import { ParsedDataReviewStep } from "@/components/wizard/steps/parsed-data-review-step";
import { MetadataFormStep } from "@/components/wizard/steps/metadata-form-step";
import { TitlePagePreviewStep } from "@/components/wizard/steps/title-page-preview-step";
import { cn } from "@/lib/utils";

const STEPS = [
  { number: 1, label: "University" },
  { number: 2, label: "Synopsis" },
  { number: 3, label: "Review" },
  { number: 4, label: "Metadata" },
  { number: 5, label: "Preview" },
] as const;

interface SetupWizardProps {
  project: Project;
}

export function SetupWizard({ project }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 state
  const [universityType, setUniversityType] = useState<UniversityType | null>(
    project.university_type
  );

  // Step 2 state
  const [synopsisText, setSynopsisText] = useState<string | null>(
    project.synopsis_text
  );
  const [aiConsentAccepted, setAiConsentAccepted] = useState(false);

  // Step 3 state
  const [parsedData, setParsedData] = useState<ParsedSynopsis | null>(null);

  // Step 4 state
  const [metadata, setMetadata] = useState<ProjectMetadata>(
    project.metadata_json ?? {}
  );

  // Derived
  const isSandbox = project.status === "sandbox";

  const patchProject = useCallback(
    async (body: Record<string, unknown>) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(
            err?.error?.message ?? `Failed to save (${res.status})`
          );
        }

        return await res.json();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "An unexpected error occurred";
        toast.error(message);
        throw error;
      } finally {
        setSaving(false);
      }
    },
    [project.id]
  );

  const handleNext = useCallback(async () => {
    try {
      if (currentStep === 1) {
        if (!universityType) {
          toast.error("Please select a university type to continue.");
          return;
        }
        await patchProject({ university_type: universityType });
      }

      if (currentStep === 2) {
        if (!aiConsentAccepted) {
          toast.error("Please accept the AI processing consent to continue.");
          return;
        }
        await patchProject({ synopsis_text: synopsisText ?? "" });
      }

      if (currentStep === 3) {
        if (parsedData) {
          await patchProject({
            title: parsedData.title ?? project.title,
            study_type: parsedData.study_type ?? undefined,
          });
        }
      }

      if (currentStep === 4) {
        await patchProject({ metadata_json: metadata });
      }

      setCurrentStep((prev) => Math.min(prev + 1, 5));
    } catch {
      // Error already shown via toast in patchProject
    }
  }, [
    currentStep,
    universityType,
    synopsisText,
    aiConsentAccepted,
    parsedData,
    metadata,
    patchProject,
    project.title,
  ]);

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Stepper */}
      <nav aria-label="Setup progress" className="mb-8">
        <ol className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isActive = step.number === currentStep;
            const isCompleted = step.number < currentStep;
            const isPending = step.number > currentStep;

            return (
              <li key={step.number} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                      isActive &&
                        "border-blue-600 bg-blue-600 text-white",
                      isCompleted &&
                        "border-green-600 bg-green-600 text-white",
                      isPending &&
                        "border-gray-300 bg-white text-gray-400"
                    )}
                  >
                    {isCompleted ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isActive && "text-blue-600",
                      isCompleted && "text-green-600",
                      isPending && "text-gray-400"
                    )}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector line */}
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 h-0.5 flex-1 transition-colors",
                      step.number < currentStep
                        ? "bg-green-600"
                        : "bg-gray-200"
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step content */}
      <div className="min-h-[400px] rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {currentStep === 1 && (
          <UniversityStep value={universityType} onChange={setUniversityType} />
        )}

        {currentStep === 2 && (
          <SynopsisUploadStep
            projectId={project.id}
            synopsisText={synopsisText}
            onSynopsisChange={setSynopsisText}
            aiConsentAccepted={aiConsentAccepted}
            onAiConsentChange={setAiConsentAccepted}
          />
        )}

        {currentStep === 3 && (
          <ParsedDataReviewStep
            synopsisText={synopsisText}
            parsedData={parsedData}
            onParsedDataChange={setParsedData}
          />
        )}

        {currentStep === 4 && (
          <MetadataFormStep metadata={metadata} onChange={setMetadata} />
        )}

        {currentStep === 5 && (
          <TitlePagePreviewStep
            project={{
              ...project,
              university_type: universityType,
              title: parsedData?.title ?? project.title,
              metadata_json: metadata,
            }}
            isSandbox={isSandbox}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={currentStep === 1 || saving}
          className={cn(
            "rounded-md border border-gray-300 px-5 py-2.5 text-sm font-medium transition-colors",
            currentStep === 1
              ? "cursor-not-allowed opacity-0"
              : "hover:bg-gray-50"
          )}
        >
          Back
        </button>

        {currentStep < 5 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className={cn(
              "rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            )}
          >
            {saving ? "Saving..." : "Next"}
          </button>
        ) : (
          <div>{/* No next button on the final step */}</div>
        )}
      </div>
    </div>
  );
}
