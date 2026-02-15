"use client";

import {
  getWordCountTarget,
  getWordCountStatus,
} from "@/lib/phases/word-count-targets";

interface WordCountBarProps {
  phaseNumber: number;
  wordCount: number;
}

const STATUS_COLOURS = {
  "on-target": {
    bar: "bg-[#8B9D77]",
    text: "text-[#8B9D77]",
  },
  under: {
    bar: "bg-[#D4A373]",
    text: "text-[#D4A373]",
  },
  over: {
    bar: "bg-destructive",
    text: "text-destructive",
  },
} as const;

export function WordCountBar({ phaseNumber, wordCount }: WordCountBarProps) {
  const target = getWordCountTarget(phaseNumber);
  const status = getWordCountStatus(phaseNumber, wordCount);

  // No target for this phase — show a plain word count
  if (!target || status === "no-target") {
    return (
      <p className="font-mono text-sm text-[#6B6B6B]">
        {wordCount.toLocaleString()} words
      </p>
    );
  }

  const colours = STATUS_COLOURS[status];

  // Clamp the visual percentage to 0–100 so the bar never overflows
  const percentage = Math.min(
    Math.round((wordCount / target.max) * 100),
    100,
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between font-mono text-sm">
        <span className={colours.text}>
          {wordCount.toLocaleString()} / {target.min.toLocaleString()}–
          {target.max.toLocaleString()} words
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F0F0F0]">
        <div
          className={`h-full rounded-full transition-all ${colours.bar}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
