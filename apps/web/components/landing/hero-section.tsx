"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { AnimatedGridPattern } from "@/components/ui/animated-grid";
import { ApolloHeroPlayer } from "@/components/remotion/apollo-hero-player";

const springTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

const noMotion = {
  duration: 0,
};

function TypewriterText({
  text,
  delay = 0,
  speed = 50,
}: {
  text: string;
  delay?: number;
  speed?: number;
}) {
  const [displayed, setDisplayed] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayed(text);
      setShowCursor(false);
      return;
    }

    const startTimeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          // Keep cursor blinking for 2s after completion, then hide
          setTimeout(() => setShowCursor(false), 2000);
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [text, delay, speed, prefersReducedMotion]);

  return (
    <>
      {displayed}
      {showCursor && (
        <span className="inline-block w-[3px] h-[0.85em] bg-primary ml-1 animate-pulse align-middle" />
      )}
    </>
  );
}

export function HeroSection() {
  const prefersReducedMotion = useReducedMotion();

  const transition = prefersReducedMotion ? noMotion : springTransition;

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition,
    },
  };

  const videoVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 40 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        ...(prefersReducedMotion ? noMotion : springTransition),
        delay: prefersReducedMotion ? 0 : 0.2,
      },
    },
  };

  return (
    <section className="relative overflow-hidden py-20 sm:py-28 lg:py-36">
      {/* Full-width container with flex split */}
      <div className="container relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-16">
          {/* LEFT SIDE — 60% on desktop: Remotion video with grid behind */}
          <div className="relative lg:w-[60%]">
            {/* Animated grid background */}
            <div className="absolute -inset-x-8 -inset-y-8 overflow-hidden rounded-2xl [mask-image:radial-gradient(ellipse_at_60%_50%,black_20%,transparent_70%)]">
              <AnimatedGridPattern
                cellSize={48}
                numSquares={20}
                maxOpacity={0.25}
                duration={4}
              />
            </div>

            {/* Orange glow behind video */}
            <div className="absolute left-1/3 top-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-primary/20 blur-[120px]" />

            {/* Perspective-tilted Remotion video */}
            <motion.div
              className="relative"
              variants={videoVariants}
              initial="hidden"
              animate="visible"
              style={{ perspective: "1200px" }}
            >
              <div
                className="transform-gpu rounded-xl shadow-2xl shadow-primary/10 overflow-hidden border border-white/10"
                style={{
                  transform: "rotateX(8deg) rotateY(-5deg)",
                }}
              >
                <ApolloHeroPlayer />
              </div>

              {/* Right-edge gradient fade */}
              <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background/80 to-transparent" />
            </motion.div>
          </div>

          {/* RIGHT SIDE — 40% on desktop: copy with typewriter */}
          <motion.div
            className="mt-12 lg:mt-0 lg:w-[40%]"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Badge */}
            <motion.div variants={itemVariants}>
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                Now in Beta
              </span>
            </motion.div>

            {/* Heading — larger + typewriter */}
            <motion.h1
              className="mt-8 font-heading text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
              variants={itemVariants}
            >
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                <TypewriterText text="Apollo" delay={400} speed={80} />
              </span>
              <br />
              <span className="text-foreground">
                <TypewriterText
                  text="Your Thesis, Perfected."
                  delay={1000}
                  speed={45}
                />
              </span>
            </motion.h1>

            {/* Subtitle — larger */}
            <motion.p
              className="mt-8 text-xl text-muted-foreground leading-relaxed"
              variants={itemVariants}
            >
              From synopsis to submission — AI-powered workflows for 85,000+
              medical postgraduates across India.
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="mt-10 flex items-center gap-4"
              variants={itemVariants}
            >
              <Link href="/sign-up">
                <Button size="lg" className="text-base px-8 py-6">
                  Get Started Free
                  <ArrowRight />
                </Button>
              </Link>
              <a href="#features">
                <Button variant="outline" size="lg" className="text-base px-8 py-6">
                  Learn More
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
