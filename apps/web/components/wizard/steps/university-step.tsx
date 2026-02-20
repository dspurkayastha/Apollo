"use client";

import { cn } from "@/lib/utils";

interface UniversityOption {
  value: "wbuhs" | "ssuhs" | "generic";
  name: string;
  description: string;
}

const UNIVERSITY_OPTIONS: UniversityOption[] = [
  {
    value: "wbuhs",
    name: "The West Bengal University of Health Sciences",
    description: "SSKM/WBUHS thesis format",
  },
  {
    value: "ssuhs",
    name: "Srimanta Sankaradeva University of Health Sciences",
    description: "SSUHS thesis format",
  },
  {
    value: "generic",
    name: "Other University",
    description: "Standard thesis format",
  },
];

interface UniversityStepProps {
  value: string | null;
  onChange: (type: "wbuhs" | "ssuhs" | "generic") => void;
}

export function UniversityStep({ value, onChange }: UniversityStepProps) {
  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">
        Select Your University
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        Choose the university whose thesis format you would like to follow. This
        determines the structure and styling of your thesis.
      </p>

      <div className="grid gap-4">
        {UNIVERSITY_OPTIONS.map((option) => {
          const isSelected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "group relative w-full rounded-lg border-2 p-5 text-left transition-all",
                isSelected
                  ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              <div className="flex items-start gap-4">
                {/* Radio indicator */}
                <div
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    isSelected
                      ? "border-blue-600 bg-blue-600"
                      : "border-gray-300 bg-white group-hover:border-gray-400"
                  )}
                >
                  {isSelected && (
                    <div className="h-2 w-2 rounded-full bg-white" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3
                    className={cn(
                      "text-base font-medium",
                      isSelected ? "text-blue-900" : "text-gray-900"
                    )}
                  >
                    {option.name}
                  </h3>
                  <p
                    className={cn(
                      "mt-1 text-sm",
                      isSelected ? "text-blue-700" : "text-gray-500"
                    )}
                  >
                    {option.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
