"use client";

import { useState, useEffect, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

// ── Lazy-load 3D scene (SSR-safe) ──────────────────────────────────────────
const Hero3DScene = dynamic(
  () => import("@/components/landing/hero-3d-scene").then((m) => m.Hero3DScene),
  {
    ssr: false,
    loading: () => <Hero3DFallback />,
  },
);

// ── Fallback while 3D loads ─────────────────────────────────────────────────
function Hero3DFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-10 w-10 animate-pulse rounded-full bg-[#E8DCC8]/60" />
    </div>
  );
}

// ── WebGL error boundary ────────────────────────────────────────────────────
interface ErrorBoundaryState {
  hasError: boolean;
}

class WebGLErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("WebGL error boundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return <Hero3DFallback />;
    }
    return this.props.children;
  }
}

// ── TypewriterText ──────────────────────────────────────────────────────────
function TypewriterText({
  text,
  charDelay = 50,
  startDelay = 1200,
  reducedMotion = false,
}: {
  text: string;
  charDelay?: number;
  startDelay?: number;
  reducedMotion?: boolean;
}) {
  const [displayed, setDisplayed] = useState(reducedMotion ? text : "");
  const [showCursor, setShowCursor] = useState(!reducedMotion);

  useEffect(() => {
    if (reducedMotion) return;
    const startTimeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          setTimeout(() => setShowCursor(false), 2000);
        }
      }, charDelay);
      return () => clearInterval(interval);
    }, startDelay);
    return () => clearTimeout(startTimeout);
  }, [text, charDelay, startDelay, reducedMotion]);

  return (
    <span>
      {displayed}
      {showCursor && (
        <span className="animate-typewriter-cursor">|</span>
      )}
    </span>
  );
}

// ── HeroSection ─────────────────────────────────────────────────────────────
export function HeroSection() {
  const prefersReducedMotion = useReducedMotion();

  const dur = prefersReducedMotion ? 0 : 1.0;
  const zenEase = [0.16, 1, 0.3, 1] as const;

  return (
    <section className="relative pb-2 pt-28 lg:pb-4 lg:pt-32">
      <div className="container relative">
        {/* ── 3D scene — absolutely positioned, wider, behind text ── */}
        <div className="pointer-events-none absolute -right-12 top-0 hidden h-[828px] w-[75%] lg:block">
          <WebGLErrorBoundary>
            <Hero3DScene />
          </WebGLErrorBoundary>
        </div>

        {/* ── Left zone — branding + CTA, overlaps in front ────────── */}
        <div className="relative z-10 flex min-h-[580px] flex-col justify-center lg:max-w-[45%]">
          <div style={{ perspective: 900 }}>
            <motion.h1
              className="font-brand text-[96px] font-normal leading-[0.90] tracking-[-0.03em] text-[#1A1A1A] md:text-[168px] lg:text-[192px]"
              style={{ transformOrigin: "left center" }}
              initial={{ opacity: 0, y: 60, scale: 0.95, rotateY: 0 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateY: 9 }}
              transition={{ duration: dur, delay: 0.2, ease: zenEase }}
            >
              Apollo
            </motion.h1>
          </div>

          <motion.p
            className="mt-4 max-w-md font-typewriter text-[17px] leading-[1.7] tracking-wide text-[#5A5A5A] md:mt-5 md:text-[20px]"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.8, delay: 0.4, ease: zenEase }}
          >
            <TypewriterText
              text="From synopsis to submission — structured, cited, compliant. Upload your synopsis, and Apollo handles the rest."
              reducedMotion={prefersReducedMotion ?? false}
            />
          </motion.p>

          <motion.div
            className="mt-7 flex items-center gap-4 md:mt-8"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.8, delay: 0.6, ease: zenEase }}
          >
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-full bg-[#1A1A1A] px-7 py-3.5 text-[15px] font-medium text-white transition-all hover:bg-[#333] hover:shadow-lg"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center rounded-full border border-[rgba(0,0,0,0.08)] bg-white/50 px-7 py-3.5 text-[15px] font-medium text-[#1A1A1A] backdrop-blur-sm transition-all hover:bg-white/80 hover:shadow-sm"
            >
              Learn More
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
