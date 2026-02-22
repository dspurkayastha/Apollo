"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

// ---------------------------------------------------------------------------
// Tour step definitions
// ---------------------------------------------------------------------------

interface TourStep {
  title: string;
  description: string;
  target: string | null;
  position: "bottom" | "top" | "right" | "left" | "center";
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Apollo",
    description:
      "Let\u2019s take a quick look around your thesis workspace.",
    target: null,
    position: "center",
  },
  {
    title: "The Pipeline",
    description:
      "Your thesis follows 12 phases. Complete each milestone to progress.",
    target: "[data-tour='pipeline']",
    position: "bottom",
  },
  {
    title: "Generate & Approve",
    description:
      "AI generates each chapter. You review, refine, and approve before advancing.",
    target: "[data-tour='compile']",
    position: "bottom",
  },
  {
    title: "The Editor",
    description:
      "Full LaTeX editing power. The AI\u2019s output is your starting point \u2014 make it yours.",
    target: "[data-tour='editor']",
    position: "right",
  },
  {
    title: "You\u2019re Ready",
    description:
      "That\u2019s all you need. Let\u2019s build something remarkable.",
    target: null,
    position: "center",
  },
];

const STORAGE_KEY = "apollo_onboarding_complete";
const SPOTLIGHT_PADDING = 12;
const CARD_GAP = 16;
const EDGE_PADDING = 20;
const CARD_WIDTH = 340;
const LENS_FLARE_DISTANCE_THRESHOLD = 300;
const LENS_FLARE_SCALE = 1.2;

// SSR-safe default spotlight (no window access)
const DEFAULT_SPOTLIGHT = { x: 0, y: 0, width: 2, height: 2 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the bounding rect for a tour target selector, or null. */
function getTargetRect(selector: string | null): DOMRect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  return el.getBoundingClientRect();
}

/** Compute padded spotlight rect from a target DOMRect. */
function spotlightFromRect(rect: DOMRect) {
  return {
    x: rect.x - SPOTLIGHT_PADDING,
    y: rect.y - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  };
}

/** Viewport-centre spotlight (for welcome/finish steps). Client-only. */
function centreSpotlight() {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  return { x: cx - 1, y: cy - 1, width: 2, height: 2 };
}

/** Full-viewport spotlight (for aperture-open exit). Client-only. */
function fullSpotlight() {
  return { x: -40, y: -40, width: window.innerWidth + 80, height: window.innerHeight + 80 };
}

/** Euclidean distance between two spotlight centres. */
function spotlightDistance(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

/** Expand a spotlight rect by a factor around its centre (lens flare). */
function inflateSpotlight(
  s: { x: number; y: number; width: number; height: number },
  factor: number,
) {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const w = s.width * factor;
  const h = s.height * factor;
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
}

/** Shared AudioContext for whoosh sounds (avoids per-step context creation). */
let sharedAudioCtx: AudioContext | null = null;

/** Play a subtle synthesised whoosh via Web Audio API. */
function playWhoosh() {
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new AudioContext();
    }
    const ctx = sharedAudioCtx;
    // Resume if suspended (autoplay policy)
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // Audio not available — fail silently
  }
}

interface CardPos {
  x: number;
  y: number;
}

/** Smart card positioning with viewport clamping. */
function computeCardPosition(
  targetRect: DOMRect | null,
  preference: TourStep["position"],
  cardHeight: number,
): CardPos {
  // Centre fallback
  if (!targetRect || preference === "center") {
    return {
      x: window.innerWidth / 2 - CARD_WIDTH / 2,
      y: window.innerHeight / 2 - cardHeight / 2,
    };
  }

  const pad = SPOTLIGHT_PADDING;
  let x: number;
  let y: number;

  switch (preference) {
    case "bottom":
      x = targetRect.left + targetRect.width / 2 - CARD_WIDTH / 2;
      y = targetRect.bottom + pad + CARD_GAP;
      break;
    case "top":
      x = targetRect.left + targetRect.width / 2 - CARD_WIDTH / 2;
      y = targetRect.top - pad - CARD_GAP - cardHeight;
      break;
    case "right":
      x = targetRect.right + pad + CARD_GAP;
      y = targetRect.top + targetRect.height / 2 - cardHeight / 2;
      break;
    case "left":
      x = targetRect.left - pad - CARD_GAP - CARD_WIDTH;
      y = targetRect.top + targetRect.height / 2 - cardHeight / 2;
      break;
  }

  // Clamp to viewport
  x = Math.max(EDGE_PADDING, Math.min(x, window.innerWidth - CARD_WIDTH - EDGE_PADDING));
  y = Math.max(EDGE_PADDING, Math.min(y, window.innerHeight - cardHeight - EDGE_PADDING));

  return { x, y };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TourOverlay() {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [spotlight, setSpotlight] = useState(DEFAULT_SPOTLIGHT); // FIX C1: SSR-safe default
  const [cardPos, setCardPos] = useState<CardPos>({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const prevSpotlightRef = useRef(DEFAULT_SPOTLIGHT); // FIX C1: SSR-safe default
  const flareTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Check localStorage on mount ──
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      setVisible(true);
    }
  }, []);

  // ── Responsive check ──
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Calculate spotlight + card position (with lens flare for long morphs) ──
  const recalculate = useCallback(
    (withFlare = false) => {
      const step = TOUR_STEPS[currentStep];
      const rect = getTargetRect(step.target);
      const target =
        rect && isDesktop ? spotlightFromRect(rect) : centreSpotlight();

      // FIX M1: clear any pending lens flare timeout
      clearTimeout(flareTimeoutRef.current);

      if (withFlare && isDesktop) {
        const dist = spotlightDistance(prevSpotlightRef.current, target);
        if (dist > LENS_FLARE_DISTANCE_THRESHOLD) {
          // Lens flare: briefly inflate mid-transit, then settle
          const midpoint = {
            x: (prevSpotlightRef.current.x + target.x) / 2,
            y: (prevSpotlightRef.current.y + target.y) / 2,
            width: (prevSpotlightRef.current.width + target.width) / 2,
            height: (prevSpotlightRef.current.height + target.height) / 2,
          };
          setSpotlight(inflateSpotlight(midpoint, LENS_FLARE_SCALE));
          flareTimeoutRef.current = setTimeout(() => setSpotlight(target), 180);
        } else {
          setSpotlight(target);
        }
        playWhoosh();
      } else {
        setSpotlight(target);
      }

      prevSpotlightRef.current = target;

      const cardH = cardRef.current?.offsetHeight ?? 180;
      setCardPos(
        computeCardPosition(isDesktop ? rect : null, step.position, cardH),
      );
    },
    [currentStep, isDesktop],
  );

  // Track whether this is the initial mount (no flare) vs step change (with flare)
  const isInitialMount = useRef(true);
  // FIX M3: Track previous isDesktop to suppress flare on responsive toggle
  const prevIsDesktopRef = useRef(isDesktop);

  // Recalculate on step change + initial
  useEffect(() => {
    const desktopChanged = prevIsDesktopRef.current !== isDesktop;
    prevIsDesktopRef.current = isDesktop;
    // Only flare on genuine step changes, not on initial mount or desktop toggle
    const flare = !isInitialMount.current && !desktopChanged;
    isInitialMount.current = false;
    const id = requestAnimationFrame(() => recalculate(flare));
    return () => cancelAnimationFrame(id);
  }, [recalculate, isDesktop]);

  // ── Resize + ResizeObserver ──
  useEffect(() => {
    if (!visible) return;

    const onResize = () => recalculate();
    window.addEventListener("resize", onResize);

    const step = TOUR_STEPS[currentStep];
    let observer: ResizeObserver | undefined;
    if (step.target) {
      const el = document.querySelector(step.target);
      if (el) {
        observer = new ResizeObserver(onResize);
        observer.observe(el);
      }
    }

    return () => {
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
  }, [visible, currentStep, recalculate]);

  // ── Stable handler refs for effects (FIX M4) ──
  const handleNextRef = useRef<() => void>(() => {});
  const handlePrevRef = useRef<() => void>(() => {});
  const handleDismissRef = useRef<() => void>(() => {});

  const handleNext = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      handleDismissRef.current?.();
    }
  }, [currentStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const handleDismiss = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setSpotlight(fullSpotlight());
    // FIX M2: store timeout for cleanup
    dismissTimeoutRef.current = setTimeout(() => {
      setVisible(false);
      setExiting(false);
      localStorage.setItem(STORAGE_KEY, "true");
    }, 500);
  }, [exiting]);

  // Keep refs in sync
  handleNextRef.current = handleNext;
  handlePrevRef.current = handlePrev;
  handleDismissRef.current = handleDismiss;

  // Cleanup timeouts on unmount (FIX M1, M2)
  useEffect(() => {
    return () => {
      clearTimeout(flareTimeoutRef.current);
      clearTimeout(dismissTimeoutRef.current);
    };
  }, []);

  // ── Interactive target: click through spotlight to advance (FIX M4) ──
  useEffect(() => {
    if (!visible || exiting) return;
    const step = TOUR_STEPS[currentStep];
    if (!step.target) return;
    const el = document.querySelector(step.target);
    if (!el) return;
    const onClick = () => handleNextRef.current?.();
    el.addEventListener("click", onClick, { once: true });
    return () => el.removeEventListener("click", onClick);
  }, [visible, exiting, currentStep]); // FIX M4: proper deps

  // ── Keyboard navigation (FIX M4) ──
  useEffect(() => {
    if (!visible || exiting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        handleNextRef.current?.();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevRef.current?.();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleDismissRef.current?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, exiting]); // FIX M4: proper deps, uses refs for handlers

  if (!visible) return null;

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const hasTarget = step.target !== null && isDesktop;

  const spotlightSpring = {
    type: "spring" as const,
    stiffness: 170,
    damping: 26,
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: exiting ? 0 : 1 }}
          transition={{ duration: exiting ? 0.3 : 0.4 }}
          className="fixed inset-0 z-[100]"
          style={{ pointerEvents: "none" }}
        >
          {/* ── SVG Mask Overlay (desktop only) ── */}
          {isDesktop && (
            <svg
              className="pointer-events-none fixed inset-0"
              style={{ width: "100vw", height: "100vh", zIndex: 100 }}
            >
              <defs>
                <filter id="spotlight-feather">
                  <feGaussianBlur stdDeviation="10" />
                </filter>
                <mask id="spotlight-mask">
                  <rect width="100%" height="100%" fill="white" />
                  <motion.rect
                    animate={{
                      x: spotlight.x,
                      y: spotlight.y,
                      width: spotlight.width,
                      height: spotlight.height,
                    }}
                    transition={spotlightSpring}
                    rx={16}
                    fill="black"
                    filter="url(#spotlight-feather)"
                  />
                </mask>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill="rgba(0,0,0,0.55)"
                mask="url(#spotlight-mask)"
              />
            </svg>
          )}

          {/* ── Mobile scrim (no spotlight) ── */}
          {!isDesktop && (
            <div className="pointer-events-none fixed inset-0 bg-black/50" style={{ zIndex: 100 }} />
          )}

          {/* ── Breathing Glow Ring (desktop with target only) ── */}
          {isDesktop && hasTarget && !exiting && (
            <motion.div
              className="pointer-events-none fixed"
              style={{
                zIndex: 101,
                top: 0,   // FIX m1: explicit offsets
                left: 0,
                borderRadius: 16,
                animation: "tour-breathe 3s ease-in-out infinite",
              }}
              animate={{
                x: spotlight.x,
                y: spotlight.y,
                width: spotlight.width,
                height: spotlight.height,
              }}
              transition={spotlightSpring}
            />
          )}

          {/* ── Glass Tooltip Card ── */}
          <AnimatePresence mode="wait">
            {/* FIX C2: Use wrapper div for mobile centering so FM animate doesn't clobber transform */}
            <motion.div
              key={currentStep}
              ref={cardRef}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
                delay: hasTarget ? 0.15 : 0,
              }}
              className="fixed rounded-2xl border border-white/40 bg-white/85 p-5 shadow-xl backdrop-blur-[20px]"
              style={{
                zIndex: 102,
                width: CARD_WIDTH,
                pointerEvents: "auto",
                ...(isDesktop
                  ? { left: cardPos.x, top: cardPos.y }
                  : {
                      left: "50%",
                      top: "50%",
                      // FIX C2: Use margin-based centering instead of transform
                      // (FM controls transform via animate prop)
                      marginLeft: -(CARD_WIDTH / 2),
                      marginTop: -(cardRef.current?.offsetHeight ?? 180) / 2,
                    }),
              }}
            >
              {/* Parallax drift wrapper — subtle floating feel */}
              <motion.div
                animate={{ x: [0, 1.5, -1, 2, -1.5, 0], y: [0, -1, 2, -1.5, 1, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
              >
                {/* Progress dots — 3-tier hierarchy */}
                <div className="mb-4 flex items-center justify-center gap-2">
                  {TOUR_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-full transition-all duration-300 ${
                        i === currentStep
                          ? "h-2 w-2 bg-[#2F2F2F]"
                          : i < currentStep
                            ? "h-1.5 w-1.5 bg-[#8B9D77]"
                            : "h-1.5 w-1.5 bg-[#D1D1D1]"
                      }`}
                    />
                  ))}
                </div>

                <h3 className="font-serif text-base font-semibold text-[#2F2F2F]">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#6B6B6B]">
                  {step.description}
                </p>

                {/* Navigation */}
                <div className="mt-5 flex items-center justify-between">
                  <button
                    onClick={handleDismiss}
                    className="text-[13px] text-[#6B6B6B] transition-colors hover:text-[#2F2F2F]"
                  >
                    Skip tour
                  </button>
                  <div className="flex items-center gap-2">
                    {!isFirst && (
                      <button
                        onClick={handlePrev}
                        className="rounded-lg px-3 py-1.5 text-[13px] text-[#6B6B6B] transition-colors hover:bg-black/5 hover:text-[#2F2F2F]"
                      >
                        Back
                      </button>
                    )}
                    <button
                      onClick={handleNext}
                      className="rounded-lg bg-[#2F2F2F] px-4 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#1A1A1A]"
                    >
                      {isLast ? "Get Started" : "Next"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
