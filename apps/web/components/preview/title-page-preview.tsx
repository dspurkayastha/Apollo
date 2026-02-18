"use client";

import { useState, useEffect } from "react";

interface TitlePagePreviewProps {
  html: string;
}

export function TitlePagePreview({ html }: TitlePagePreviewProps) {
  const [sanitisedHtml, setSanitisedHtml] = useState("");

  useEffect(() => {
    // Dynamic import — DOMPurify requires window/document (SSR-safe)
    void import("dompurify").then((mod) => {
      setSanitisedHtml(mod.default.sanitize(html));
    });
  }, [html]);

  return (
    <div className="w-full max-w-[595px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
      <div
        className="origin-top"
        dangerouslySetInnerHTML={{ __html: sanitisedHtml }}
      />
    </div>
  );
}
