"use client";

import { useCallback, useRef, useState } from "react";

const COLS = 20;
const ROWS = 15;
const CELL_SIZE = 40;

export function InteractiveGridPattern({ className }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    col: number;
    row: number;
  } | null>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const scaleX = (COLS * CELL_SIZE) / rect.width;
      const scaleY = (ROWS * CELL_SIZE) / rect.height;

      const col = Math.floor((x * scaleX) / CELL_SIZE);
      const row = Math.floor((y * scaleY) / CELL_SIZE);

      if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
        setHoveredCell({ col, row });
      } else {
        setHoveredCell(null);
      }
    },
    [],
  );

  return (
    <svg
      ref={svgRef}
      className={className ?? "h-full w-full"}
      viewBox={`0 0 ${COLS * CELL_SIZE} ${ROWS * CELL_SIZE}`}
      preserveAspectRatio="xMidYMid slice"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredCell(null)}
    >
      {Array.from({ length: ROWS }, (_, row) =>
        Array.from({ length: COLS }, (_, col) => {
          let opacity = 0.04; // ambient idle glow — faint orange tint so grid is visible

          if (hoveredCell) {
            const distance =
              Math.abs(col - hoveredCell.col) +
              Math.abs(row - hoveredCell.row);
            const hoverOpacity = Math.max(0, 1 - distance / 5) * 0.7;
            opacity = Math.max(opacity, hoverOpacity);
          }

          const fill =
            opacity > 0
              ? `hsl(24 95% 53% / ${opacity})`
              : "transparent";

          return (
            <rect
              key={`${col}-${row}`}
              x={col * CELL_SIZE}
              y={row * CELL_SIZE}
              width={CELL_SIZE - 1}
              height={CELL_SIZE - 1}
              fill={fill}
              stroke="hsl(24 95% 53% / 0.12)"
              style={{ transition: "fill 300ms ease" }}
            />
          );
        }),
      )}
    </svg>
  );
}
