"use client";

import { useState, useCallback } from "react";
import { FileUploader } from "@/components/upload/file-uploader";

interface SynopsisUploadStepProps {
  projectId: string;
  synopsisText: string | null;
  onSynopsisChange: (text: string) => void;
}

export function SynopsisUploadStep({
  projectId,
  synopsisText,
  onSynopsisChange,
}: SynopsisUploadStepProps) {
  const [uploadedPdf, setUploadedPdf] = useState(false);

  const handleFileRead = useCallback(
    (text: string) => {
      onSynopsisChange(text);
    },
    [onSynopsisChange]
  );

  const handleUploadComplete = useCallback(() => {
    setUploadedPdf(true);
  }, []);

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Upload Your Synopsis</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Provide your synopsis so Apollo can auto-parse key details such as the
        title, aims, and study type. You may upload a file or paste the text
        directly.
      </p>

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

        {uploadedPdf && (
          <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-sm text-amber-400">
              PDF uploaded. Text extraction will be available in a future update.
              Please paste the synopsis text manually below.
            </p>
          </div>
        )}
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
