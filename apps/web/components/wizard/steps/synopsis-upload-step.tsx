"use client";

import { useCallback } from "react";
import Link from "next/link";
import { FileUploader } from "@/components/upload/file-uploader";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";

interface SynopsisUploadStepProps {
  projectId: string;
  synopsisText: string | null;
  onSynopsisChange: (text: string) => void;
  aiConsentAccepted?: boolean;
  onAiConsentChange?: (accepted: boolean) => void;
}

export function SynopsisUploadStep({
  projectId,
  synopsisText,
  onSynopsisChange,
  aiConsentAccepted = false,
  onAiConsentChange,
}: SynopsisUploadStepProps) {
  const handleFileRead = useCallback(
    (text: string) => {
      onSynopsisChange(text);
    },
    [onSynopsisChange]
  );

  const handleUploadComplete = useCallback(() => {
    // PDF is archived to R2; text extraction handled in FileUploader
  }, []);

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Upload Your Synopsis</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Provide your synopsis so Apollo can auto-parse key details such as the
        title, aims, and study type. You may upload a file or paste the text
        directly.
      </p>

      {/* Medical data warning (9.5) */}
      <div className="mb-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-sm text-amber-800">
          Please ensure your synopsis does not contain patient-identifiable
          information (names, MRNs, dates of birth, Aadhaar numbers). Anonymise
          all patient data before uploading.
        </p>
      </div>

      {/* AI processing consent (9.3) */}
      {onAiConsentChange && (
        <div className="mb-6 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="ai-consent"
              checked={aiConsentAccepted}
              onCheckedChange={(checked) =>
                onAiConsentChange(checked === true)
              }
              className="mt-0.5"
            />
            <label htmlFor="ai-consent" className="cursor-pointer text-sm leading-relaxed text-foreground">
              I acknowledge that my thesis content will be processed by AI
              services (Anthropic, hosted in the US) for generation purposes.
              Patient data must be anonymised before upload.{" "}
              <Link href="/privacy" className="text-primary underline underline-offset-2" target="_blank">
                Privacy Policy
              </Link>
            </label>
          </div>
        </div>
      )}

      {/* Option 1: File upload */}
      <div className="mb-6">
        <h3 className="mb-2 text-sm font-medium">Option 1: Upload a file</h3>
        <FileUploader
          projectId={projectId}
          accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          maxSize={50 * 1024 * 1024}
          onUploadComplete={handleUploadComplete}
          onFileRead={handleFileRead}
        />
      </div>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-sm text-muted-foreground">
            or
          </span>
        </div>
      </div>

      {/* Option 2: Paste text */}
      <div className="mb-6">
        <h3 className="mb-2 text-sm font-medium">
          Option 2: Paste text directly
        </h3>
        <textarea
          value={synopsisText ?? ""}
          onChange={(e) => onSynopsisChange(e.target.value)}
          placeholder="Paste your synopsis text here..."
          rows={10}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Synopsis preview */}
      {synopsisText && synopsisText.trim().length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Synopsis Preview</h3>
          <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-muted/50 p-3">
            <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
              {synopsisText.slice(0, 2000)}
              {synopsisText.length > 2000 && (
                <span className="text-muted-foreground/50">
                  {"\n"}... ({synopsisText.length - 2000} more characters)
                </span>
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
