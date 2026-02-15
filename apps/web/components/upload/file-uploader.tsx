"use client";

import { useState, useCallback, useRef, type DragEvent } from "react";
import { cn } from "@/lib/utils";

type UploadState = "idle" | "uploading" | "complete" | "error";

interface FileUploaderProps {
  projectId: string;
  accept: string;
  maxSize: number;
  onUploadComplete: (key: string) => void;
  onFileRead?: (text: string) => void;
}

export function FileUploader({
  projectId,
  accept,
  maxSize,
  onUploadComplete,
  onFileRead,
}: FileUploaderProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setState("idle");
    setProgress(0);
    setErrorMessage(null);
    setFileName(null);
  }, []);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxSize) {
        const maxMB = Math.round(maxSize / (1024 * 1024));
        return `File exceeds the maximum size of ${maxMB}MB.`;
      }

      // Check accepted types
      const acceptedTypes = accept.split(",").map((t) => t.trim());
      const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`;
      const matchesAccept = acceptedTypes.some(
        (type) =>
          type === file.type ||
          type === fileExtension ||
          (type.endsWith("/*") &&
            file.type.startsWith(type.replace("/*", "/")))
      );

      if (!matchesAccept) {
        return `File type not accepted. Please upload: ${accept}`;
      }

      return null;
    },
    [accept, maxSize]
  );

  const isTextFile = useCallback((file: File): boolean => {
    return (
      file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")
    );
  }, []);

  const isDocxFile = useCallback((file: File): boolean => {
    return (
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.toLowerCase().endsWith(".docx")
    );
  }, []);

  const readTextFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === "string" && onFileRead) {
          onFileRead(text);
        }
        setState("complete");
        setProgress(100);
      };
      reader.onerror = () => {
        setState("error");
        setErrorMessage("Failed to read the file. Please try again.");
      };
      reader.readAsText(file);
    },
    [onFileRead]
  );

  const readDocxFile = useCallback(
    async (file: File) => {
      try {
        const mammoth = await import("mammoth");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        if (result.value && onFileRead) {
          onFileRead(result.value);
        }
        setState("complete");
        setProgress(100);
      } catch {
        setState("error");
        setErrorMessage(
          "Failed to extract text from DOCX. Please try pasting the text directly."
        );
      }
    },
    [onFileRead]
  );

  const uploadToR2 = useCallback(
    async (file: File) => {
      setState("uploading");
      setProgress(10);

      try {
        // Step 1: Get signed URL
        const signedUrlRes = await fetch("/api/upload/signed-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            projectId,
          }),
        });

        if (!signedUrlRes.ok) {
          const errData = await signedUrlRes.json().catch(() => null);
          throw new Error(
            errData?.error?.message ?? `Upload initiation failed (${signedUrlRes.status})`
          );
        }

        const { data } = await signedUrlRes.json();
        setProgress(30);

        // Step 2: Upload file directly to R2 via signed URL
        const uploadRes = await fetch(data.url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error(`File upload failed (${uploadRes.status})`);
        }

        setProgress(100);
        setState("complete");
        onUploadComplete(data.key);
      } catch (error) {
        setState("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Upload failed. Please try again."
        );
      }
    },
    [projectId, onUploadComplete]
  );

  const processFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setState("error");
        setErrorMessage(validationError);
        return;
      }

      setFileName(file.name);

      if (isTextFile(file)) {
        setState("uploading");
        setProgress(50);
        readTextFile(file);
      } else if (isDocxFile(file)) {
        setState("uploading");
        setProgress(30);
        void readDocxFile(file);
      } else {
        uploadToR2(file);
      }
    },
    [validateFile, isTextFile, isDocxFile, readTextFile, readDocxFile, uploadToR2]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
      // Reset input so the same file can be selected again
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [processFile]
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          "relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
          isDragOver && "border-primary bg-primary/5",
          state === "idle" && !isDragOver && "border-border hover:border-muted-foreground hover:bg-muted/50",
          state === "uploading" && "border-primary/60 bg-primary/5",
          state === "complete" && "border-green-500/60 bg-green-500/5",
          state === "error" && "border-destructive/60 bg-destructive/5"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          aria-label="Upload file"
        />

        {state === "idle" && (
          <>
            <svg
              className="mb-2 h-8 w-8 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-primary">Click to browse</span>{" "}
              or drag and drop
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              DOCX, TXT, or PDF up to {Math.round(maxSize / (1024 * 1024))}MB
            </p>
          </>
        )}

        {state === "uploading" && (
          <div className="w-full max-w-xs text-center">
            <p className="mb-2 text-sm text-primary">
              {fileName ? `Processing ${fileName}...` : "Processing..."}
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{progress}%</p>
          </div>
        )}

        {state === "complete" && (
          <div className="text-center">
            <svg
              className="mx-auto mb-1 h-8 w-8 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <p className="text-sm font-medium text-green-500">
              {fileName ?? "File"} uploaded successfully
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resetState();
              }}
              className="mt-2 text-xs text-green-500/80 underline hover:text-green-500"
            >
              Upload another file
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="text-center">
            <svg
              className="mx-auto mb-1 h-8 w-8 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
            <p className="text-sm text-destructive">
              {errorMessage ?? "An error occurred"}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resetState();
              }}
              className="mt-2 text-xs text-destructive/80 underline hover:text-destructive"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
