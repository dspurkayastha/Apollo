"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  useId,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

interface AnimatedGridPatternProps {
  className?: string;
  /** Size of each grid cell in pixels */
  cellSize?: number;
  /** Number of cells that are lit at any given time */
  numSquares?: number;
  /** Maximum opacity for lit cells */
  maxOpacity?: number;
  /** Duration of each pulse cycle in seconds */
  duration?: number;
  /** RGB string for the accent color (e.g. "234, 121, 21") */
  color?: string;
}

export function AnimatedGridPattern({
  className,
  cellSize = 48,
  numSquares = 25,
  maxOpacity = 0.3,
  duration = 3,
  color = "234, 121, 21",
}: AnimatedGridPatternProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ cols: 0, rows: 0 });
  const [activeSquares, setActiveSquares] = useState<number[]>([]);
  const prefersReducedMotion = useReducedMotion();
  const uniqueId = useId();

  const patternId = `grid-pattern-${uniqueId}`;

  // Calculate grid dimensions from container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const { clientWidth, clientHeight } = container;
      const cols = Math.ceil(clientWidth / cellSize);
      const rows = Math.ceil(clientHeight / cellSize);
      setDimensions({ cols, rows });
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [cellSize]);

  const totalCells = dimensions.cols * dimensions.rows;

  // Generate a set of random unique cell indices
  const generateSquares = useCallback(() => {
    if (totalCells === 0) return [];

    const count = Math.min(numSquares, totalCells);
    const indices = new Set<number>();

    while (indices.size < count) {
      indices.add(Math.floor(Math.random() * totalCells));
    }

    return Array.from(indices);
  }, [totalCells, numSquares]);

  // Regenerate active squares on an interval
  useEffect(() => {
    if (prefersReducedMotion || totalCells === 0) return;

    // Initial set
    setActiveSquares(generateSquares());

    const interval = setInterval(() => {
      setActiveSquares(generateSquares());
    }, duration * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [generateSquares, duration, prefersReducedMotion, totalCells]);

  // Map a flat index to { col, row }
  const indexToPosition = useCallback(
    (index: number) => ({
      col: index % dimensions.cols,
      row: Math.floor(index / dimensions.cols),
    }),
    [dimensions.cols]
  );

  // Memoize the grid line path
  const gridLinePath = useMemo(
    () => `M ${cellSize} 0 L 0 0 0 ${cellSize}`,
    [cellSize]
  );

  return (
    <div
      ref={containerRef}
      className={cn("absolute inset-0 overflow-hidden", className)}
    >
      <svg
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id={patternId}
            width={cellSize}
            height={cellSize}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={gridLinePath}
              fill="none"
              stroke={`rgba(${color}, 0.08)`}
              strokeWidth="1"
            />
          </pattern>
        </defs>

        {/* Static grid lines */}
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />

        {/* Animated lit cells */}
        {!prefersReducedMotion && (
          <AnimatePresence>
            {activeSquares.map((index) => {
              const { col, row } = indexToPosition(index);
              return (
                <motion.rect
                  key={`${index}-${col}-${row}`}
                  x={col * cellSize + 1}
                  y={row * cellSize + 1}
                  width={cellSize - 2}
                  height={cellSize - 2}
                  fill={`rgba(${color}, ${maxOpacity})`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration,
                    times: [0, 0.05, 0.7, 1],
                    ease: "easeInOut",
                  }}
                />
              );
            })}
          </AnimatePresence>
        )}
      </svg>
    </div>
  );
}
