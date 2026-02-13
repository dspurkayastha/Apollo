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
      <h2 className="mb-1 text-lg font-semibold text-gray-900">
        Upload Your Synopsis
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        Provide your synopsis so Apollo can auto-parse key details such as the
        title, aims, and study type. You may upload a file or paste the text
        directly.
      </p>

      {/* Option 1: File upload */}
      <div className="mb-6">
        <h3 className="mb-2 text-sm font-medium text-gray-700">
          Option 1: Upload a file
        </h3>
        <FileUploader
          projectId={projectId}
          accept=".pdf,.txt,application/pdf,text/plain"
          maxSize={50 * 1024 * 1024}
          onUploadComplete={handleUploadComplete}
          onFileRead={handleFileRead}
        />

        {uploadedPdf && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              PDF uploaded. Text extraction will be available in a future update.
              Please paste the synopsis text manually below.
            </p>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-sm text-gray-400">or</span>
        </div>
      </div>

      {/* Option 2: Paste text */}
      <div className="mb-6">
        <h3 className="mb-2 text-sm font-medium text-gray-700">
          Option 2: Paste text directly
        </h3>
        <textarea
          value={synopsisText ?? ""}
          onChange={(e) => onSynopsisChange(e.target.value)}
          placeholder="Paste your synopsis text here..."
          rows={10}
          className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Synopsis preview */}
      {synopsisText && synopsisText.trim().length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700">
            Synopsis Preview
          </h3>
          <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-3">
            <pre className="whitespace-pre-wrap text-xs text-gray-700">
              {synopsisText.slice(0, 2000)}
              {synopsisText.length > 2000 && (
                <span className="text-gray-400">
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
