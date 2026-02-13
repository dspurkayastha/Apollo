"use client";

interface TitlePagePreviewProps {
  html: string;
}

export function TitlePagePreview({ html }: TitlePagePreviewProps) {
  return (
    <div className="w-full max-w-[595px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
      <div
        className="origin-top"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
