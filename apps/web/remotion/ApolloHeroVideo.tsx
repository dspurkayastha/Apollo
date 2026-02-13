import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";

// ── Film Timing (30s @ 30fps = 900 frames) ─────────────────────────────────
const SHOTS = {
  pressure: { from: 0, to: 150 }, // 0-5s    Tension
  fracture: { from: 150, to: 270 }, // 5-9s    Chaos peaks
  ignition: { from: 270, to: 390 }, // 9-13s   Turning point
  formation: { from: 390, to: 570 }, // 13-19s  Structure + citations
  proof: { from: 570, to: 720 }, // 19-24s  Data authority
  material: { from: 720, to: 840 }, // 24-28s  Physical thesis
  identity: { from: 840, to: 900 }, // 28-30s  Brand hold
} as const;

// ── Cinematic Helpers ───────────────────────────────────────────────────────
/** Eased 0→1 progress between two frame numbers */
const ease = (f: number, from: number, to: number) =>
  interpolate(f, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

/** Linear 0→1 progress between two frame numbers */
const lin = (f: number, from: number, to: number) =>
  interpolate(f, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const lerp = (t: number, a: number, b: number) => a + (b - a) * t;

function typeText(
  text: string,
  frame: number,
  start: number,
  end: number,
): string {
  return text.slice(
    0,
    Math.floor(
      interpolate(frame, [start, end], [0, text.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );
}

// ── Color Tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#0a0a0a",
  surface: "#1a1a1a",
  border: "#333333",
  borderLight: "#444444",
  /** Higher-contrast card for Act 1 fragments */
  card: "#252525",
  cardBorder: "#444444",
  orange: "#f97316",
  orangeLight: "#fb923c",
  green: "#22c55e",
  white: "#ffffff",
  gray100: "#f5f5f5",
  gray200: "#e5e5e5",
  gray300: "#d4d4d4",
  gray400: "#a3a3a3",
  gray500: "#737373",
  gray600: "#525252",
  gray700: "#404040",
  gray800: "#262626",
};

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const FONT_SERIF = 'Georgia, "Times New Roman", serif';
const FONT_MONO =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace';

// ═══════════════════════════════════════════════════════════════════════════
// ACT 1 — TENSION (Pressure + Fracture)
// Near-monochrome. Tight framing. Micro-jitter. Fragmented compositions.
// ═══════════════════════════════════════════════════════════════════════════

// ── Shot 1: Pressure (0-150, 5s) ───────────────────────────────────────────
const ShotPressure: React.FC = () => {
  const f = useCurrentFrame();

  // Anxiety micro-jitter — subtle, not shaky
  const jx = Math.sin(f * 0.85) * 1.2;
  const jy = Math.cos(f * 0.61) * 0.8;

  // Fragment entrances (staggered from the void)
  const frag1 = ease(f, 15, 40);
  const frag2 = ease(f, 30, 55);
  const frag3 = ease(f, 45, 70);
  const frag4 = ease(f, 55, 80);

  // Deadline counter
  const deadlineIn = ease(f, 8, 30);

  // Hero copy: "One thesis. One deadline." — holds for ~2s
  const copyIn = ease(f, 70, 88);
  const copyOut = lin(f, 140, 150);

  // Fragments dim when copy appears
  const fragDim = interpolate(f, [65, 85], [1, 0.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: C.bg,
        filter: "saturate(0.25)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${jx}px, ${jy}px)`,
        }}
      >
        {/* Fragment 1: Partial literature review paragraph */}
        <div
          style={{
            position: "absolute",
            top: 100,
            left: 60,
            width: 480,
            opacity: frag1 * fragDim,
            transform: `rotate(-1deg) translateY(${lerp(frag1, 12, 0)}px)`,
          }}
        >
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.cardBorder}`,
              borderRadius: 8,
              padding: "20px 24px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                fontSize: 14,
                color: C.gray300,
                fontFamily: FONT_SERIF,
                lineHeight: 1.75,
              }}
            >
              Gupta et al. (2019) reported a complication rate of 12.4%,
              directly contradicting Sharma &amp; Mehta who observed only 3.2%
              in a comparable North Indian cohort. No consensus exists on
              whether these findings can be generalised to&hellip;
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <div
                style={{
                  height: 5,
                  width: "65%",
                  background: C.gray600,
                  borderRadius: 2,
                }}
              />
              <div
                style={{
                  height: 5,
                  width: "30%",
                  background: C.gray600,
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        </div>

        {/* Fragment 2: Broken data table */}
        <div
          style={{
            position: "absolute",
            top: 340,
            left: 340,
            width: 360,
            opacity: frag2 * fragDim,
            transform: `rotate(1.5deg) translateY(${lerp(frag2, 12, 0)}px)`,
          }}
        >
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "16px 20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: C.gray400,
                fontFamily: FONT_MONO,
                marginBottom: 10,
              }}
            >
              Table ?: Patient Demographics
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{ display: "flex", gap: 6, marginBottom: 5 }}
              >
                {[0, 1, 2, 3].map((j) => (
                  <div
                    key={j}
                    style={{
                      flex: 1,
                      height: 6,
                      background: i === 0 ? C.gray600 : C.gray700,
                      borderRadius: 2,
                      opacity: j === 3 && i > 0 ? 0.35 : 1,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Fragment 3: Uncertain citation */}
        <div
          style={{
            position: "absolute",
            bottom: 220,
            left: 120,
            opacity: frag3 * fragDim,
            transform: `rotate(-0.5deg) translateY(${lerp(frag3, 10, 0)}px)`,
          }}
        >
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "14px 20px",
              display: "inline-flex",
              gap: 8,
              alignItems: "center",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            <span
              style={{
                fontSize: 16,
                color: C.gray400,
                fontFamily: FONT_SERIF,
              }}
            >
              ...as demonstrated by Kumar et al.
            </span>
            <span
              style={{
                fontSize: 16,
                color: "#ef4444",
                fontWeight: 700,
                fontFamily: FONT_SERIF,
              }}
            >
              [?]
            </span>
          </div>
        </div>

        {/* Fragment 4: Half-written methodology */}
        <div
          style={{
            position: "absolute",
            top: 150,
            right: 80,
            width: 340,
            opacity: frag4 * fragDim,
            transform: `rotate(1deg) translateY(${lerp(frag4, 10, 0)}px)`,
          }}
        >
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "16px 20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: C.gray400,
                fontFamily: FONT,
                fontWeight: 600,
                marginBottom: 8,
                textTransform: "uppercase" as const,
                letterSpacing: 1,
              }}
            >
              Methods &mdash; Draft
            </div>
            <div
              style={{
                fontSize: 14,
                color: C.gray500,
                fontFamily: FONT_SERIF,
                lineHeight: 1.7,
              }}
            >
              A prospective study was conducted at... inclusion criteria
              included patients aged 18&ndash;65 presenting with...
            </div>
          </div>
        </div>
      </div>

      {/* Deadline counter */}
      <div
        style={{
          position: "absolute",
          top: 40,
          right: 80,
          opacity: deadlineIn * fragDim,
          transform: `translateY(${lerp(deadlineIn, 10, 0)}px)`,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: C.gray500,
            fontFamily: FONT,
            letterSpacing: 3,
            textTransform: "uppercase" as const,
            marginBottom: 6,
          }}
        >
          Submission
        </div>
        <div
          style={{
            fontSize: 44,
            color: C.gray400,
            fontFamily: FONT,
            fontWeight: 200,
            letterSpacing: -1,
          }}
        >
          45 days
        </div>
      </div>

      {/* "One thesis. One deadline." */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          opacity: copyIn * (1 - copyOut),
        }}
      >
        <div
          style={{
            fontSize: 38,
            color: C.gray300,
            fontFamily: FONT,
            fontWeight: 300,
            letterSpacing: 2,
          }}
        >
          One thesis. One deadline.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Shot 2: Fracture (150-270, 4s) ─────────────────────────────────────────
const ShotFracture: React.FC = () => {
  const f = useCurrentFrame(); // 0-120 local

  // Jitter — subtle ramp
  const jitterAmp = lerp(lin(f, 0, 80), 1, 2.5);
  const jx = Math.sin(f * 0.85) * jitterAmp;
  const jy = Math.cos(f * 0.61) * jitterAmp * 0.6;

  // Fragments spread outward from center
  const spread = ease(f, 0, 60);

  // Quick flash cuts — simulate fragmented attention
  const flash1 = f > 35 && f < 38 ? 0.12 : 0;
  const flash2 = f > 65 && f < 67 ? 0.10 : 0;
  const flash3 = f > 88 && f < 90 ? 0.08 : 0;

  // Convergence toward center at end (setup for ignition)
  const converge = ease(f, 95, 120);

  // Overall dimming toward end
  const exitDim = lin(f, 108, 120);

  return (
    <AbsoluteFill
      style={{
        background: C.bg,
        filter: `saturate(${lerp(lin(f, 0, 120), 0.25, 0.2)})`,
      }}
    >
      {/* Flash overlay for "abrupt cut" feeling */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: C.white,
          opacity: flash1 + flash2 + flash3,
          zIndex: 100,
          pointerEvents: "none" as const,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${jx}px, ${jy}px)`,
          opacity: 1 - exitDim * 0.6,
        }}
      >
        {/* Fragment: lit review — drifts upper-left */}
        <div
          style={{
            position: "absolute",
            top: lerp(spread, 140, 70) + converge * 70,
            left: lerp(spread, 80, 30) + converge * 50,
            width: 420,
            opacity: 0.8,
            transform: `rotate(${lerp(spread, -1, -3)}deg)`,
          }}
        >
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "18px 22px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                fontSize: 14,
                color: C.gray400,
                fontFamily: FONT_SERIF,
                lineHeight: 1.7,
              }}
            >
              ...numerous randomised controlled trials have evaluated the
              comparative efficacy of these two approaches. However, the
              applicability of Western data to Indian centres remains
              questionable...
            </div>
          </div>
        </div>

        {/* Fragment: references with missing sources */}
        <div
          style={{
            position: "absolute",
            top: lerp(spread, 300, 360) + converge * (-60),
            right: lerp(spread, 120, 60) + converge * 60,
            width: 340,
            opacity: 0.75,
            transform: `rotate(${lerp(spread, 1, 3)}deg)`,
          }}
        >
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "18px 22px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            {[
              "1. Semm K. Endoscopic appendectomy...",
              "2. Kumar A, et al. Meta-analysis...",
              "3. [source needed]",
              "4. [source needed]",
            ].map((ref, i) => (
              <div
                key={i}
                style={{
                  fontSize: 13,
                  color: i >= 2 ? "#ef4444" : C.gray400,
                  fontFamily: FONT_SERIF,
                  lineHeight: 1.8,
                  fontStyle: i >= 2 ? ("italic" as const) : ("normal" as const),
                }}
              >
                {ref}
              </div>
            ))}
          </div>
        </div>

        {/* Fragment: empty results table */}
        <div
          style={{
            position: "absolute",
            bottom: lerp(spread, 160, 80) + converge * 80,
            left: lerp(spread, 280, 180) + converge * 100,
            width: 380,
            opacity: 0.7,
            transform: `rotate(${lerp(spread, 0.5, -1.5)}deg)`,
          }}
        >
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "16px 20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: C.gray400,
                fontFamily: FONT_MONO,
                marginBottom: 10,
              }}
            >
              Table 4.1: Outcomes &mdash; INCOMPLETE
            </div>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{ display: "flex", gap: 6, marginBottom: 4 }}
              >
                {[0, 1, 2, 3].map((j) => (
                  <div
                    key={j}
                    style={{
                      flex: 1,
                      height: 6,
                      background: i === 0 ? C.gray600 : C.gray700,
                      borderRadius: 2,
                      opacity: i > 2 && j > 1 ? 0.3 : 1,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Fragment: methodology — upper right */}
        <div
          style={{
            position: "absolute",
            top: lerp(spread, 80, 20) + converge * 60,
            right: lerp(spread, 100, 50) + converge * 50,
            width: 300,
            opacity: 0.65,
            transform: `rotate(${lerp(spread, 1.5, 4)}deg)`,
          }}
        >
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "16px 20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: C.gray400,
                fontFamily: FONT,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              METHODS &mdash; DRAFT 3
            </div>
            <div
              style={{
                fontSize: 13,
                color: C.gray500,
                fontFamily: FONT_SERIF,
                lineHeight: 1.7,
              }}
            >
              Sample size: n = 2(Z&alpha; + Z&beta;)&sup2;&sigma;&sup2;/d&sup2;
              &hellip; verify with statistician
            </div>
          </div>
        </div>

        {/* Fragment: TODO sticky */}
        <div
          style={{
            position: "absolute",
            bottom: lerp(spread, 280, 220) + converge * 60,
            left: lerp(spread, 60, 20) + converge * 40,
            opacity: lin(f, 15, 35) * 0.75,
            transform: `rotate(${lerp(spread, -2, -4)}deg)`,
          }}
        >
          <div
            style={{
              background: C.surface,
              border: "1px solid #dc262666",
              borderRadius: 8,
              padding: "12px 16px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#ef4444",
                fontFamily: FONT_MONO,
              }}
            >
              TODO: ethics committee approval?
            </div>
          </div>
        </div>

        {/* Fragment: missing figure */}
        <div
          style={{
            position: "absolute",
            top: lerp(spread, 460, 500) + converge * (-40),
            right: lerp(spread, 300, 240) + converge * 60,
            opacity: lin(f, 25, 45) * 0.65,
            transform: `rotate(${lerp(spread, 0.5, -1)}deg)`,
          }}
        >
          <div
            style={{
              background: C.surface,
              border: "1px solid #dc262644",
              borderRadius: 8,
              padding: "12px 16px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#ef4444",
                fontFamily: FONT_MONO,
              }}
            >
              Fig ?.?: [Missing figure]
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TURNING POINT — Ignition
// Orange enters the visual language. Chaos reorganizes into structure.
// ═══════════════════════════════════════════════════════════════════════════

// ── Shot 3: Ignition (270-390, 4s) ─────────────────────────────────────────
const ShotIgnition: React.FC = () => {
  const f = useCurrentFrame(); // 0-120 local
  const { fps } = useVideoConfig();

  // Phase 1 (0-15): Synopsis file drops in
  const fileSpring = spring({
    frame: f,
    fps,
    config: { damping: 12, mass: 0.8, stiffness: 140 },
  });
  const fileFade = lin(f, 50, 65); // file fades out after pulse

  // Phase 2 (15-55): Orange radial pulse
  const pulseT = ease(f, 15, 55);
  const pulseRadius = lerp(pulseT, 40, 1200);
  const pulseAlpha = interpolate(pulseT, [0, 0.3, 1], [0, 0.5, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 3 (55-90): Ordered grid establishes
  const orderIn = ease(f, 55, 85);

  // Phase 4: Copy holds longer
  const copyIn = ease(f, 78, 95);
  const exitFade = lin(f, 115, 120);

  // Saturation: desaturated → full color with the pulse
  const sat = lerp(ease(f, 15, 55), 0.15, 1.0);

  // Residual ambient glow after pulse
  const glowIn = ease(f, 40, 70);

  return (
    <AbsoluteFill
      style={{
        background: C.bg,
        filter: `saturate(${sat})`,
      }}
    >
      {/* Residual orange glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          opacity: glowIn * 0.5,
          pointerEvents: "none" as const,
        }}
      >
        <div
          style={{
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      {/* Orange radial pulse */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          pointerEvents: "none" as const,
        }}
      >
        <div
          style={{
            width: pulseRadius,
            height: pulseRadius,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(249,115,22,${pulseAlpha}) 0%, rgba(249,115,22,0) 72%)`,
            filter: "blur(14px)",
          }}
        />
      </div>

      {/* Synopsis file icon — drops in, then fades */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          zIndex: 10,
        }}
      >
        <div
          style={{
            opacity: fileSpring * (1 - fileFade),
            transform: `translateY(${lerp(fileSpring, -50, 0)}px) scale(${lerp(fileSpring, 0.8, 1)})`,
          }}
        >
          <div
            style={{
              width: 80,
              height: 100,
              background: C.surface,
              borderRadius: 8,
              border: `1px solid ${C.borderLight}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect
                x="4"
                y="2"
                width="20"
                height="24"
                rx="3"
                stroke={C.gray500}
                strokeWidth="1.5"
              />
              <path
                d="M9 10h10M9 14h10M9 18h6"
                stroke={C.gray600}
                strokeWidth="1"
                strokeLinecap="round"
              />
            </svg>
            <div
              style={{
                fontSize: 9,
                color: C.gray400,
                fontFamily: FONT_MONO,
                letterSpacing: 0.3,
              }}
            >
              synopsis.pdf
            </div>
          </div>
        </div>
      </div>

      {/* Organized thesis structure grid — appears after pulse */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: orderIn * (1 - exitFade * 0.5),
          transform: `scale(${lerp(orderIn, 0.95, 1)})`,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 180px)",
            gap: 16,
          }}
        >
          {[
            { label: "Introduction", icon: "01" },
            { label: "Literature Review", icon: "02" },
            { label: "Methodology", icon: "03" },
            { label: "Results", icon: "04" },
            { label: "Discussion", icon: "05" },
            { label: "References", icon: "06" },
          ].map((phase, i) => {
            const phaseIn = ease(f, 58 + i * 4, 76 + i * 4);
            return (
              <div
                key={phase.label}
                style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "16px",
                  opacity: phaseIn,
                  transform: `translateY(${lerp(phaseIn, 12, 0)}px)`,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: C.orange,
                    fontFamily: FONT_MONO,
                    marginBottom: 6,
                    fontWeight: 600,
                  }}
                >
                  {phase.icon}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: C.gray300,
                    fontFamily: FONT,
                    fontWeight: 500,
                  }}
                >
                  {phase.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* "From synopsis to submission." */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 0,
          right: 0,
          textAlign: "center" as const,
          opacity: copyIn * (1 - exitFade),
        }}
      >
        <div
          style={{
            fontSize: 30,
            color: C.gray300,
            fontFamily: FONT,
            fontWeight: 300,
            letterSpacing: 2,
          }}
        >
          From synopsis to submission.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ACT 2 — INTELLIGENCE (Formation + Proof)
// Geometric order. Clean spacing. Orange as system accent.
// ═══════════════════════════════════════════════════════════════════════════

// ── Shot 4: Formation (390-570, 6s) ────────────────────────────────────────
const CitationMark: React.FC<{
  num: number;
  showAt: number;
  verifyAt: number;
  frame: number;
}> = ({ num, showAt, verifyAt, frame }) => {
  const show = lin(frame, showAt, showAt + 4);
  const verified = ease(frame, verifyAt, verifyAt + 5) > 0.5;
  const flash =
    frame >= verifyAt && frame <= verifyAt + 6;

  if (show <= 0) return null;
  return (
    <span
      style={{
        display: "inline",
        color: verified ? C.orange : "#dc2626",
        fontWeight: 700,
        fontSize: 14,
        opacity: show,
        textShadow: flash ? `0 0 16px ${C.orange}` : "none",
      }}
    >
      {verified ? ` [${num}]` : " [?]"}
    </span>
  );
};

const ShotFormation: React.FC = () => {
  const f = useCurrentFrame(); // 0-180 local

  // Panel entrance
  const panelIn = ease(f, 0, 25);

  // Three sentences type sequentially
  const line1 =
    "Acute appendicitis remains one of the most common surgical emergencies worldwide, with a lifetime prevalence of 7\u20138%.";
  const line2 =
    " Since Semm described endoscopic appendectomy in 1983, numerous RCTs have evaluated comparative outcomes of these approaches.";
  const line3 =
    " Kumar et al. (2023) reported significantly shorter hospital stay favouring the laparoscopic approach across 15 trials.";

  const typed1 = typeText(line1, f, 12, 55);
  const typed2 = typeText(line2, f, 60, 100);
  const typed3 = typeText(line3, f, 105, 140);

  // Copy — holds for ~1.5s
  const copyIn = ease(f, 148, 160);
  const exitFade = lin(f, 175, 180);

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {/* Ambient orange glow — orange is now a system color */}
      <div
        style={{
          position: "absolute",
          top: "18%",
          left: "28%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(249,115,22,0.05) 0%, transparent 70%)",
          filter: "blur(80px)",
          pointerEvents: "none" as const,
        }}
      />

      {/* Writing panel — centered, cinematic */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: panelIn * (1 - exitFade * 0.4),
        }}
      >
        <div
          style={{
            width: 720,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "44px 52px",
            boxShadow: "0 40px 80px rgba(0,0,0,0.4)",
            transform: `translateY(${lerp(panelIn, 20, 0)}px)`,
          }}
        >
          {/* Chapter heading */}
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: C.white,
              fontFamily: FONT_SERIF,
              marginBottom: 6,
            }}
          >
            Review of Literature
          </div>
          <div
            style={{
              width: 50,
              height: 2.5,
              background: C.orange,
              borderRadius: 2,
              marginBottom: 28,
            }}
          />

          {/* Body text with citations verifying */}
          <div
            style={{
              fontSize: 16,
              color: C.gray300,
              fontFamily: FONT_SERIF,
              lineHeight: 2,
            }}
          >
            <span>{typed1}</span>
            <CitationMark num={1} showAt={56} verifyAt={66} frame={f} />
            <span>{typed2}</span>
            <CitationMark num={2} showAt={101} verifyAt={110} frame={f} />
            <span>{typed3}</span>
            <CitationMark num={3} showAt={141} verifyAt={148} frame={f} />
            {/* Cursor */}
            {f >= 12 && f < 145 && (
              <span
                style={{
                  display: "inline-block",
                  width: 2,
                  height: 18,
                  background: C.orange,
                  marginLeft: 2,
                  opacity: Math.floor(f / 8) % 2 === 0 ? 1 : 0,
                  verticalAlign: "middle",
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* "Verified citations. Defensible results." */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: "center" as const,
          opacity: copyIn * (1 - exitFade),
        }}
      >
        <div
          style={{
            fontSize: 30,
            color: C.gray300,
            fontFamily: FONT,
            fontWeight: 300,
            letterSpacing: 2,
          }}
        >
          Verified citations. Defensible results.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Shot 5: Proof (570-720, 5s) ────────────────────────────────────────────
const PROOF_TABLE = [
  { param: "Age (years)", la: "28.4 \u00B1 8.2", oa: "29.1 \u00B1 7.6", p: "0.621", sig: false },
  { param: "Male:Female", la: "34:26", oa: "31:29", p: "0.583", sig: false },
  { param: "BMI (kg/m\u00B2)", la: "23.8 \u00B1 3.1", oa: "24.2 \u00B1 2.9", p: "0.447", sig: false },
  { param: "Op Duration (min)", la: "42.3 \u00B1 11.5", oa: "56.7 \u00B1 14.2", p: "<0.001*", sig: true },
  { param: "Hospital Stay (d)", la: "1.8 \u00B1 0.6", oa: "3.2 \u00B1 1.1", p: "<0.001*", sig: true },
  { param: "Wound Infection", la: "2 (3.3%)", oa: "7 (11.7%)", p: "0.048*", sig: true },
];

const PROOF_BARS = [
  { label: "Op Time", la: 42.3, oa: 56.7, max: 65 },
  { label: "Stay (d)", la: 1.8, oa: 3.2, max: 4 },
  { label: "Infection", la: 3.3, oa: 11.7, max: 14 },
  { label: "RTW (d)", la: 8.4, oa: 14.6, max: 18 },
];

const ShotProof: React.FC = () => {
  const f = useCurrentFrame(); // 0-150 local
  const { fps } = useVideoConfig();

  const tableIn = ease(f, 5, 25);
  const chartIn = ease(f, 60, 85);
  const exitFade = lin(f, 135, 150);

  const headerStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: C.gray500,
    fontFamily: FONT,
    textAlign: "left" as const,
    padding: "8px 10px",
    borderBottom: `1px solid ${C.borderLight}`,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  };

  const cellStyle: React.CSSProperties = {
    fontSize: 13,
    color: C.gray400,
    fontFamily: FONT_MONO,
    padding: "7px 10px",
    borderBottom: `1px solid ${C.border}`,
  };

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {/* Glow */}
      <div
        style={{
          position: "absolute",
          top: "25%",
          right: "15%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(249,115,22,0.04) 0%, transparent 70%)",
          filter: "blur(80px)",
          pointerEvents: "none" as const,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 48,
          opacity: 1 - exitFade * 0.5,
          padding: "0 80px",
        }}
      >
        {/* Table */}
        <div
          style={{
            flex: 1,
            maxWidth: 560,
            opacity: tableIn,
            transform: `translateY(${lerp(tableIn, 16, 0)}px)`,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: C.white,
              fontFamily: FONT_SERIF,
              marginBottom: 16,
            }}
          >
            Table 4.1: Comparative Outcomes
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse" as const,
            }}
          >
            <thead>
              <tr>
                {["Parameter", "LA (n=60)", "OA (n=60)", "p-value"].map(
                  (h) => (
                    <th key={h} style={headerStyle}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {PROOF_TABLE.map((row, i) => {
                const rowIn = ease(f, 12 + i * 8, 24 + i * 8);
                return (
                  <tr
                    key={row.param}
                    style={{
                      opacity: rowIn,
                      transform: `translateY(${lerp(rowIn, 8, 0)}px)`,
                    }}
                  >
                    <td style={{ ...cellStyle, color: C.gray200 }}>
                      {row.param}
                    </td>
                    <td style={cellStyle}>{row.la}</td>
                    <td style={cellStyle}>{row.oa}</td>
                    <td
                      style={{
                        ...cellStyle,
                        color: row.sig ? C.orange : C.gray400,
                        fontWeight: row.sig ? 700 : 400,
                      }}
                    >
                      {row.p}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Chart */}
        <div
          style={{
            width: 300,
            opacity: chartIn,
            transform: `translateY(${lerp(chartIn, 16, 0)}px)`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.gray500,
              fontFamily: FONT,
              textTransform: "uppercase" as const,
              letterSpacing: 0.8,
              marginBottom: 20,
            }}
          >
            Comparative Outcomes
          </div>
          <div
            style={{
              display: "flex",
              gap: 20,
              alignItems: "flex-end",
              height: 180,
            }}
          >
            {PROOF_BARS.map((bar, i) => {
              const barSpring = spring({
                frame: Math.max(0, f - 70 - i * 10),
                fps,
                config: { damping: 14, stiffness: 80 },
              });
              return (
                <div
                  key={bar.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      alignItems: "flex-end",
                      height: 140,
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: (bar.la / bar.max) * 140 * barSpring,
                        background: `linear-gradient(180deg, ${C.orangeLight}, ${C.orange})`,
                        borderRadius: "3px 3px 0 0",
                      }}
                    />
                    <div
                      style={{
                        width: 22,
                        height: (bar.oa / bar.max) * 140 * barSpring,
                        background: `linear-gradient(180deg, ${C.gray500}, ${C.gray700})`,
                        borderRadius: "3px 3px 0 0",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      color: C.gray500,
                      fontFamily: FONT,
                    }}
                  >
                    {bar.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: C.orange,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: C.gray500,
                  fontFamily: FONT,
                }}
              >
                Laparoscopic
              </span>
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: C.gray600,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: C.gray500,
                  fontFamily: FONT,
                }}
              >
                Open
              </span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ACT 3 — AUTHORITY (Material + Identity)
// Slower. Heavier. Tactile. Premium. Longer holds. Fewer elements.
// ═══════════════════════════════════════════════════════════════════════════

// ── Thesis Page Content Renderers ───────────────────────────────────────────
const PAPER_PAGE_TYPES = [
  "title",
  "certificate",
  "literature",
  "methodology",
  "results",
  "discussion",
  "references",
] as const;

const P = {
  body: FONT_SERIF,
  ui: FONT,
  mono: FONT_MONO,
  c: {
    black: "#0f0f0f",
    dark: "#1a1a1a",
    mid: "#333",
    light: "#555",
    muted: "#888",
    rule: "#222",
    cite: "#1d4ed8",
    sig: "#c2410c",
  },
};

const PageNumber: React.FC<{ n: number }> = ({ n }) => (
  <div
    style={{
      position: "absolute",
      bottom: 8,
      right: 14,
      fontSize: 8,
      color: P.c.muted,
      fontFamily: P.ui,
    }}
  >
    {n}
  </div>
);

const TitlePageContent: React.FC = () => (
  <div style={{ textAlign: "center" as const, paddingTop: 16 }}>
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        fontFamily: P.ui,
        textTransform: "uppercase" as const,
        letterSpacing: 1.5,
        color: P.c.black,
        lineHeight: 1.5,
      }}
    >
      The West Bengal University
      <br />
      of Health Sciences
    </div>
    <div
      style={{
        width: 80,
        height: 1.5,
        background: P.c.rule,
        margin: "6px auto",
      }}
    />
    <div
      style={{
        fontSize: 9,
        color: P.c.light,
        fontFamily: P.ui,
        marginBottom: 20,
      }}
    >
      Department of General Surgery, SSKM Hospital, Kolkata
    </div>
    <div
      style={{
        fontSize: 9,
        fontWeight: 600,
        color: P.c.mid,
        fontFamily: P.ui,
        textTransform: "uppercase" as const,
        letterSpacing: 4,
        marginBottom: 14,
      }}
    >
      Thesis
    </div>
    <div
      style={{
        fontSize: 14,
        fontWeight: 700,
        color: P.c.black,
        fontFamily: P.body,
        lineHeight: 1.45,
        padding: "0 6px",
        marginBottom: 22,
      }}
    >
      Efficacy of Laparoscopic vs Open Appendectomy in Acute Appendicitis: A
      Prospective Comparative Study
    </div>
    <div
      style={{
        fontSize: 9,
        color: P.c.light,
        fontFamily: P.body,
        lineHeight: 2,
      }}
    >
      Submitted by
      <br />
      <span style={{ fontWeight: 700, color: P.c.dark, fontSize: 10.5 }}>
        Dr. Ananya Sharma
      </span>
      <br />
      MS General Surgery, 2024{"\u2013"}2027
    </div>
    <div
      style={{
        marginTop: 16,
        fontSize: 9,
        color: P.c.light,
        fontFamily: P.body,
        lineHeight: 2,
      }}
    >
      Under the guidance of
      <br />
      <span style={{ fontWeight: 700, color: P.c.dark, fontSize: 10.5 }}>
        Prof. Rajesh Kumar, MS, FRCS
      </span>
      <br />
      Director, Dept. of General Surgery
    </div>
    <div
      style={{
        marginTop: 20,
        fontSize: 9,
        color: P.c.muted,
        fontFamily: P.ui,
        letterSpacing: 2,
      }}
    >
      2027
    </div>
  </div>
);

const CertificatePageContent: React.FC = () => (
  <div style={{ paddingTop: 4 }}>
    <div
      style={{
        textAlign: "center" as const,
        fontSize: 14,
        fontWeight: 700,
        fontFamily: P.ui,
        textTransform: "uppercase" as const,
        letterSpacing: 3,
        color: P.c.black,
        marginBottom: 16,
      }}
    >
      Certificate
    </div>
    <div
      style={{
        fontSize: 9,
        color: P.c.dark,
        fontFamily: P.body,
        lineHeight: 1.9,
        textAlign: "justify" as const,
      }}
    >
      This is to certify that the thesis entitled &ldquo;Efficacy of
      Laparoscopic vs Open Appendectomy in Acute Appendicitis: A Prospective
      Comparative Study&rdquo; submitted by{" "}
      <strong>Dr. Ananya Sharma</strong> for the degree of{" "}
      <strong>Master of Surgery (General Surgery)</strong> to The West Bengal
      University of Health Sciences is a bonafide record of the research work
      carried out by her under my direct supervision and guidance during the
      period of 2024{"\u2013"}2027 at the Department of General Surgery, SSKM
      Hospital, Kolkata.
    </div>
    <div
      style={{
        fontSize: 9,
        color: P.c.dark,
        fontFamily: P.body,
        lineHeight: 1.9,
        marginTop: 10,
        textAlign: "justify" as const,
      }}
    >
      The work embodied in this thesis is original and has not been submitted in
      part or full for any other degree or diploma to this or any other
      university. I further certify that the candidate has fulfilled all the
      conditions required for the submission of this thesis as prescribed by the
      university regulations.
    </div>
    <div
      style={{
        fontSize: 9,
        color: P.c.dark,
        fontFamily: P.body,
        lineHeight: 1.9,
        marginTop: 10,
        textAlign: "justify" as const,
      }}
    >
      Place: Kolkata
      <br />
      Date: 15th March, 2027
    </div>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: 36,
        padding: "0 2px",
      }}
    >
      <div style={{ textAlign: "center" as const }}>
        <div
          style={{
            width: 110,
            borderTop: `1px solid ${P.c.rule}`,
            paddingTop: 4,
          }}
        >
          <div
            style={{
              fontSize: 8.5,
              fontWeight: 600,
              color: P.c.dark,
              fontFamily: P.ui,
            }}
          >
            Prof. Rajesh Kumar
          </div>
          <div style={{ fontSize: 7.5, color: P.c.light, fontFamily: P.ui }}>
            Guide &amp; Supervisor
          </div>
        </div>
      </div>
      <div style={{ textAlign: "center" as const }}>
        <div
          style={{
            width: 110,
            borderTop: `1px solid ${P.c.rule}`,
            paddingTop: 4,
          }}
        >
          <div
            style={{
              fontSize: 8.5,
              fontWeight: 600,
              color: P.c.dark,
              fontFamily: P.ui,
            }}
          >
            Prof. S. Mukherjee
          </div>
          <div style={{ fontSize: 7.5, color: P.c.light, fontFamily: P.ui }}>
            Director, SSKM Hospital
          </div>
        </div>
      </div>
    </div>
    <PageNumber n={2} />
  </div>
);

const LiteraturePageContent: React.FC = () => (
  <div style={{ paddingTop: 2 }}>
    <div
      style={{
        fontSize: 13,
        fontWeight: 700,
        fontFamily: P.body,
        color: P.c.black,
        marginBottom: 2,
      }}
    >
      Chapter 2: Review of Literature
    </div>
    <div
      style={{
        width: 50,
        height: 1.5,
        background: P.c.rule,
        marginBottom: 8,
      }}
    />
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        fontFamily: P.body,
        color: P.c.dark,
        marginBottom: 4,
      }}
    >
      2.1 Historical Background
    </div>
    <div
      style={{
        fontSize: 8.5,
        color: P.c.mid,
        fontFamily: P.body,
        lineHeight: 1.8,
        textAlign: "justify" as const,
        marginBottom: 6,
      }}
    >
      Acute appendicitis remains one of the most common surgical emergencies
      worldwide, with a lifetime prevalence of 7{"\u2013"}8%.{" "}
      <span style={{ color: P.c.cite, fontWeight: 600 }}>[1]</span> The
      evolution from open appendectomy (OA) to laparoscopic appendectomy (LA)
      has been one of the most significant paradigm shifts in general surgery
      over the past three decades. Since Semm first described endoscopic
      appendectomy in 1983,{" "}
      <span style={{ color: P.c.cite, fontWeight: 600 }}>[2]</span> numerous
      randomised controlled trials and systematic reviews have evaluated the
      comparative efficacy, safety, and cost-effectiveness of these two
      surgical approaches.
    </div>
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        fontFamily: P.body,
        color: P.c.dark,
        marginBottom: 4,
      }}
    >
      2.2 Laparoscopic Approach
    </div>
    <div
      style={{
        fontSize: 8.5,
        color: P.c.mid,
        fontFamily: P.body,
        lineHeight: 1.8,
        textAlign: "justify" as const,
        marginBottom: 6,
      }}
    >
      Meta-analyses by Kumar et al. (2023) across 15 RCTs demonstrated
      significantly shorter hospital stay (WMD {"\u2212"}1.4 days, p&lt;0.001)
      and reduced wound infection rates (OR 0.43, 95% CI 0.28{"\u2013"}0.66)
      favouring LA over OA.{" "}
      <span style={{ color: P.c.cite, fontWeight: 600 }}>[3]</span> Gupta and
      Sharma (2024) reported similar outcomes across 12 Indian tertiary care
      centres, noting that LA was the preferred approach in 78% of surveyed
      institutions.{" "}
      <span style={{ color: P.c.cite, fontWeight: 600 }}>[4]</span> The
      cosmetic benefit and reduced post-operative pain associated with smaller
      port-site incisions have further driven adoption rates among younger
      patient demographics.
    </div>
    <div
      style={{
        fontSize: 8.5,
        color: P.c.mid,
        fontFamily: P.body,
        lineHeight: 1.8,
        textAlign: "justify" as const,
      }}
    >
      However, operative duration remains a contentious metric, with outcomes
      varying significantly based on institutional case volume and individual
      surgeon experience.{" "}
      <span style={{ color: P.c.cite, fontWeight: 600 }}>[5,6]</span>{" "}
      Cost-effectiveness data in the Indian public healthcare context remain
      sparse, with most economic evaluations originating from Western European
      or North American settings.
    </div>
    <PageNumber n={8} />
  </div>
);

const MethodologyPageContent: React.FC = () => {
  const tCell: React.CSSProperties = {
    fontSize: 8,
    color: P.c.mid,
    fontFamily: P.mono,
    padding: "4px 6px",
    borderBottom: "0.5px solid #ddd",
  };
  const tHeader: React.CSSProperties = {
    ...tCell,
    fontWeight: 700,
    color: P.c.dark,
    fontFamily: P.ui,
    background: "#f0f0f0",
    fontSize: 8,
  };
  return (
    <div style={{ paddingTop: 2 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          fontFamily: P.body,
          color: P.c.black,
          marginBottom: 2,
        }}
      >
        Chapter 3: Materials &amp; Methods
      </div>
      <div
        style={{
          width: 50,
          height: 1.5,
          background: P.c.rule,
          marginBottom: 8,
        }}
      />
      <div
        style={{
          fontSize: 8.5,
          color: P.c.mid,
          fontFamily: P.body,
          lineHeight: 1.8,
          textAlign: "justify" as const,
          marginBottom: 6,
        }}
      >
        A prospective comparative study was conducted at the Department of
        General Surgery, SSKM Hospital, Kolkata from July 2025 to December
        2026. A total of 120 patients presenting with a clinical diagnosis of
        acute appendicitis were enrolled after obtaining informed consent and
        randomised into two equal groups of 60 patients each using
        computer-generated random number allocation.
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          fontFamily: P.body,
          color: P.c.dark,
          marginBottom: 4,
        }}
      >
        Table 3.1: Inclusion &amp; Exclusion Criteria
      </div>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse" as const,
          border: "0.5px solid #ccc",
          marginBottom: 8,
        }}
      >
        <thead>
          <tr>
            <th style={tHeader}>Inclusion Criteria</th>
            <th style={tHeader}>Exclusion Criteria</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tCell}>Age 18{"\u2013"}65 years</td>
            <td style={tCell}>Appendicular mass / abscess</td>
          </tr>
          <tr>
            <td style={tCell}>Clinical acute appendicitis</td>
            <td style={tCell}>Previous lower abdominal surgery</td>
          </tr>
          <tr>
            <td style={tCell}>ASA grade I or II</td>
            <td style={tCell}>
              Pregnancy / BMI &gt; 35 kg/m{"\u00B2"}
            </td>
          </tr>
          <tr>
            <td style={tCell}>Informed written consent</td>
            <td style={tCell}>Generalized peritonitis</td>
          </tr>
          <tr>
            <td style={tCell}>Symptom onset &lt; 72 hours</td>
            <td style={tCell}>Coagulation disorders</td>
          </tr>
        </tbody>
      </table>
      <div
        style={{
          fontSize: 8.5,
          color: P.c.mid,
          fontFamily: P.body,
          lineHeight: 1.8,
          textAlign: "justify" as const,
        }}
      >
        Sample size was calculated using the formula n = 2(Z&#945; +
        Z&#946;)&#178;&#963;&#178; / d&#178;, based on the primary outcome of
        hospital stay duration. With &#945; = 0.05 and power = 80%, a minimum
        of 54 patients per group was required. Accounting for a 10% dropout
        rate, 60 patients were recruited in each arm.
      </div>
      <PageNumber n={18} />
    </div>
  );
};

const ResultsPageContent: React.FC = () => {
  const tCell: React.CSSProperties = {
    fontSize: 7.5,
    color: P.c.mid,
    fontFamily: P.mono,
    padding: "3.5px 5px",
    borderBottom: "0.5px solid #ddd",
    textAlign: "center" as const,
  };
  const tHeader: React.CSSProperties = {
    ...tCell,
    fontWeight: 700,
    color: P.c.dark,
    fontFamily: P.ui,
    background: "#f0f0f0",
    fontSize: 7.5,
  };
  const rows = [
    { param: "Age (years)", la: "28.4 \u00B1 8.2", oa: "29.1 \u00B1 7.6", p: "0.621", sig: false },
    { param: "Male:Female", la: "34:26", oa: "31:29", p: "0.583", sig: false },
    { param: "Op. Duration (min)", la: "42.3 \u00B1 11.5", oa: "56.7 \u00B1 14.2", p: "<0.001*", sig: true },
    { param: "Hospital Stay (d)", la: "1.8 \u00B1 0.6", oa: "3.2 \u00B1 1.1", p: "<0.001*", sig: true },
    { param: "Wound Infection", la: "2 (3.3%)", oa: "7 (11.7%)", p: "0.048*", sig: true },
    { param: "Return to Work (d)", la: "8.4 \u00B1 2.1", oa: "14.6 \u00B1 3.8", p: "<0.001*", sig: true },
  ];
  const bars = [
    { label: "Op Time", la: 42.3, oa: 56.7, max: 65 },
    { label: "Stay (d)", la: 1.8, oa: 3.2, max: 4 },
    { label: "Infection %", la: 3.3, oa: 11.7, max: 14 },
    { label: "RTW (d)", la: 8.4, oa: 14.6, max: 18 },
  ];
  return (
    <div style={{ paddingTop: 2 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          fontFamily: P.body,
          color: P.c.black,
          marginBottom: 2,
        }}
      >
        Chapter 4: Results
      </div>
      <div
        style={{
          width: 50,
          height: 1.5,
          background: P.c.rule,
          marginBottom: 6,
        }}
      />
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          fontFamily: P.body,
          color: P.c.dark,
          marginBottom: 3,
        }}
      >
        Table 4.1: Demographic &amp; Outcome Comparison
      </div>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse" as const,
          border: "0.5px solid #ccc",
          marginBottom: 10,
        }}
      >
        <thead>
          <tr>
            <th style={{ ...tHeader, textAlign: "left" as const }}>
              Parameter
            </th>
            <th style={tHeader}>LA (n=60)</th>
            <th style={tHeader}>OA (n=60)</th>
            <th style={tHeader}>p-value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.param}>
              <td
                style={{
                  ...tCell,
                  textAlign: "left" as const,
                  color: P.c.dark,
                }}
              >
                {r.param}
              </td>
              <td style={tCell}>{r.la}</td>
              <td style={tCell}>{r.oa}</td>
              <td
                style={{
                  ...tCell,
                  color: r.sig ? P.c.sig : P.c.mid,
                  fontWeight: r.sig ? 700 : 400,
                }}
              >
                {r.p}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div
        style={{
          fontSize: 8,
          fontWeight: 600,
          fontFamily: P.ui,
          color: P.c.light,
          marginBottom: 4,
        }}
      >
        Fig 4.1: Comparative Outcomes
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-end",
          height: 60,
        }}
      >
        {bars.map((b) => (
          <div
            key={b.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 2,
                alignItems: "flex-end",
                height: 44,
              }}
            >
              <div
                style={{
                  width: 16,
                  height: (b.la / b.max) * 44,
                  background: "linear-gradient(180deg, #fb923c, #f97316)",
                  borderRadius: "2px 2px 0 0",
                }}
              />
              <div
                style={{
                  width: 16,
                  height: (b.oa / b.max) * 44,
                  background: "linear-gradient(180deg, #a3a3a3, #737373)",
                  borderRadius: "2px 2px 0 0",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 6,
                color: P.c.muted,
                fontFamily: P.ui,
              }}
            >
              {b.label}
            </span>
          </div>
        ))}
        <div
          style={{
            display: "flex",
            gap: 6,
            marginLeft: 8,
            marginBottom: 2,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: 1,
                background: "#f97316",
              }}
            />
            <span
              style={{
                fontSize: 6,
                color: P.c.muted,
                fontFamily: P.ui,
              }}
            >
              LA
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: 1,
                background: "#737373",
              }}
            />
            <span
              style={{
                fontSize: 6,
                color: P.c.muted,
                fontFamily: P.ui,
              }}
            >
              OA
            </span>
          </div>
        </div>
      </div>
      <PageNumber n={26} />
    </div>
  );
};

const DiscussionPageContent: React.FC = () => (
  <div style={{ paddingTop: 2 }}>
    <div
      style={{
        fontSize: 13,
        fontWeight: 700,
        fontFamily: P.body,
        color: P.c.black,
        marginBottom: 2,
      }}
    >
      Chapter 5: Discussion
    </div>
    <div
      style={{
        width: 50,
        height: 1.5,
        background: P.c.rule,
        marginBottom: 8,
      }}
    />
    <div
      style={{
        fontSize: 8.5,
        color: P.c.mid,
        fontFamily: P.body,
        lineHeight: 1.8,
        textAlign: "justify" as const,
        marginBottom: 6,
      }}
    >
      The present study demonstrates that laparoscopic appendectomy offers
      statistically significant advantages over open appendectomy in terms of
      operative duration, post-operative hospital stay, wound infection rates,
      and time to return to normal activity. These findings are largely
      consistent with the meta-analysis by Kumar et al. (2023), who reported a
      weighted mean difference of {"\u2212"}1.4 days for hospital stay
      favouring the laparoscopic approach.{" "}
      <span style={{ color: P.c.cite, fontWeight: 600 }}>[3]</span>
    </div>
    <div
      style={{
        fontSize: 8.5,
        color: P.c.mid,
        fontFamily: P.body,
        lineHeight: 1.8,
        textAlign: "justify" as const,
        marginBottom: 6,
      }}
    >
      The mean operative time for LA in our study (42.3 {"\u00B1"} 11.5 min)
      was significantly shorter than OA (56.7 {"\u00B1"} 14.2 min,
      p&lt;0.001). This contrasts with earlier studies that reported longer
      operative times for LA, likely reflecting the learning curve effect
      described by Chung et al. (1999).{" "}
      <span style={{ color: P.c.cite, fontWeight: 600 }}>[7]</span> Our centre
      performs over 200 laparoscopic procedures annually, which may account for
      the favourable time. This finding underscores the importance of
      institutional case volume in determining operative efficiency.
    </div>
    <div
      style={{
        fontSize: 8.5,
        color: P.c.mid,
        fontFamily: P.body,
        lineHeight: 1.8,
        textAlign: "justify" as const,
        marginBottom: 6,
      }}
    >
      The significantly lower wound infection rate in the LA group (3.3% vs
      11.7%, p=0.048) aligns with the Cochrane review by Jaschinski et al.
      (2018) and the Indian multicentre audit by Gupta and Sharma (2024) who
      reported a wound infection rate of 4.1% for laparoscopic cases.{" "}
      <span style={{ color: P.c.cite, fontWeight: 600 }}>[4,8]</span> The
      cosmetic advantage of smaller port-site scars was acknowledged by 92% of
      LA patients at the 6-month follow-up assessment.
    </div>
    <div
      style={{
        fontSize: 8.5,
        color: P.c.mid,
        fontFamily: P.body,
        lineHeight: 1.8,
        textAlign: "justify" as const,
      }}
    >
      Cost analysis revealed that while the initial operative cost was 18%
      higher for LA ({"\u20B9"}28,400 vs {"\u20B9"}24,100), the overall
      treatment cost {"\u2014"} factoring in reduced hospital stay, fewer
      dressing changes, and earlier return to work {"\u2014"} was comparable
      between the two groups ({"\u20B9"}32,100 vs {"\u20B9"}33,800; p=0.42).
    </div>
    <PageNumber n={34} />
  </div>
);

const ReferencesPageContent: React.FC = () => {
  const refs = [
    "Ferris M, Quan S, Kaplan BS, et al. The global incidence of appendicitis: a systematic review of population-based studies. Ann Surg. 2017;266(2):237\u2013241.",
    "Semm K. Endoscopic appendectomy. Endoscopy. 1983;15(2):59\u201364.",
    "Kumar A, Verma R, Singh T, et al. Laparoscopic vs open appendectomy: a meta-analysis of 15 RCTs. World J Surg. 2023;47(3):678\u2013689.",
    "Gupta R, Sharma P. Outcomes of minimally invasive surgery in Indian tertiary hospitals: a multicentre audit. Indian J Surg. 2024;86(1):45\u201352.",
    "Ohtani H, Tamamori Y, Arimoto Y, et al. Meta-analysis of RCTs comparing laparoscopic with open appendectomy. J Gastrointest Surg. 2012;16:1929\u20131939.",
    "Wei B, Qi C-L, Chen T-F, et al. Laparoscopic versus open appendectomy for acute appendicitis. Surg Endosc. 2011;25(4):1199\u20131208.",
    "Chung RS, Rowland DY, Li P, et al. A meta-analysis of laparoscopic versus conventional appendectomy. Am J Surg. 1999;177(3):250\u2013256.",
    "Jaschinski T, Mosch CG, Eikermann M, et al. Laparoscopic versus open surgery for suspected appendicitis. Cochrane Database Syst Rev. 2018;11:CD001546.",
  ];
  return (
    <div style={{ paddingTop: 2 }}>
      <div
        style={{
          textAlign: "center" as const,
          fontSize: 14,
          fontWeight: 700,
          fontFamily: P.body,
          color: P.c.black,
          marginBottom: 2,
        }}
      >
        References
      </div>
      <div
        style={{
          width: 40,
          height: 1.5,
          background: P.c.rule,
          margin: "0 auto 10px auto",
        }}
      />
      {refs.map((ref, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 8,
              color: P.c.cite,
              fontFamily: P.body,
              fontWeight: 600,
              flexShrink: 0,
              minWidth: 18,
              textAlign: "right" as const,
            }}
          >
            [{i + 1}]
          </span>
          <span
            style={{
              fontSize: 8,
              color: P.c.mid,
              fontFamily: P.body,
              lineHeight: 1.7,
            }}
          >
            {ref}
          </span>
        </div>
      ))}
      <PageNumber n={42} />
    </div>
  );
};

const ThesisPage: React.FC<{ type: string }> = ({ type }) => {
  switch (type) {
    case "title":
      return <TitlePageContent />;
    case "certificate":
      return <CertificatePageContent />;
    case "literature":
      return <LiteraturePageContent />;
    case "methodology":
      return <MethodologyPageContent />;
    case "results":
      return <ResultsPageContent />;
    case "discussion":
      return <DiscussionPageContent />;
    case "references":
      return <ReferencesPageContent />;
    default:
      return null;
  }
};

// ── Paper Sheaf Riffle ──────────────────────────────────────────────────────
const PaperSheaf: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        perspective: "1400px",
        perspectiveOrigin: "50% 42%",
        position: "relative",
        width: 340,
        height: 460,
        transform: "rotateX(6deg) rotateY(2deg)",
      }}
    >
      {/* Stack shadow */}
      <div
        style={{
          position: "absolute",
          bottom: -6,
          left: 8,
          right: 8,
          height: 12,
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.25) 0%, transparent 70%)",
          borderRadius: "50%",
        }}
      />

      {PAPER_PAGE_TYPES.map((type, i) => {
        const flipDelay = startFrame + i * 9;
        const rawFlip = spring({
          frame: Math.max(0, frame - flipDelay),
          fps,
          config: { damping: 18, stiffness: 55, mass: 1.1 },
        });

        // Non-linear flip: slow peel -> fast flip -> soft settle
        const flipProgress = interpolate(
          rawFlip,
          [0, 0.15, 0.5, 0.85, 1.0],
          [0, 0.08, 0.5, 0.92, 1.0],
        );

        const rotY = interpolate(flipProgress, [0, 1], [0, -172]);
        const bendPhase = Math.sin(flipProgress * Math.PI);
        const asymBend =
          Math.sin(flipProgress * Math.PI) *
          (flipProgress < 0.5 ? 1.2 : 0.8);
        const liftY = bendPhase * -28;
        const paperCurl = asymBend * 16;
        const scaleX = 1 - bendPhase * 0.07;
        const flutter =
          Math.sin(flipProgress * Math.PI * 4) *
          2 *
          Math.max(0, 1 - flipProgress * 1.8);

        const zIndex =
          flipProgress > 0.5 ? i : PAPER_PAGE_TYPES.length - i;

        const shadowBlur = 3 + bendPhase * 28;
        const shadowAlpha = 0.04 + bendPhase * 0.28;
        const shadowOffsetY = 1 + bendPhase * 10;
        const shadowSpread = bendPhase * 4;

        const gradientPos = interpolate(
          flipProgress,
          [0, 0.5, 1],
          [100, 50, 0],
        );
        const highlightAlpha = bendPhase * 0.25;
        const shadowGradAlpha = bendPhase * 0.15;

        return (
          <div
            key={type}
            style={{
              position: "absolute",
              inset: 0,
              background: "#fefefe",
              borderRadius: 3,
              border: "0.5px solid #d4d4d4",
              padding: "14px 16px",
              transformOrigin: "right center",
              transform: [
                `rotateY(${rotY}deg)`,
                `translateY(${liftY}px)`,
                `scaleX(${scaleX})`,
                `skewY(${paperCurl}deg)`,
                `rotateZ(${flutter}deg)`,
              ].join(" "),
              boxShadow: [
                `0 ${shadowOffsetY}px ${shadowBlur}px ${shadowSpread}px rgba(0,0,0,${shadowAlpha})`,
                "0 1px 3px rgba(0,0,0,0.06)",
              ].join(", "),
              zIndex,
              overflow: "hidden",
              backfaceVisibility: "hidden" as const,
            }}
          >
            <ThesisPage type={type} />

            {/* Light/shadow gradient overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(to right, rgba(0,0,0,${shadowGradAlpha}) 0%, rgba(255,255,255,${highlightAlpha * 0.6}) ${gradientPos}%, rgba(0,0,0,${shadowGradAlpha * 1.3}) 100%)`,
                pointerEvents: "none" as const,
                borderRadius: 3,
                zIndex: 10,
              }}
            />

            {/* Page edge highlight at spine */}
            {bendPhase > 0.2 && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: Math.max(1, bendPhase * 2.5),
                  height: "100%",
                  background: `linear-gradient(180deg, rgba(255,255,255,${bendPhase * 0.8}) 0%, rgba(200,200,200,${bendPhase * 0.4}) 50%, rgba(255,255,255,${bendPhase * 0.8}) 100%)`,
                  zIndex: 11,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Shot 6: Material (720-840, 4s) ─────────────────────────────────────────
const ShotMaterial: React.FC = () => {
  const f = useCurrentFrame(); // 0-120 local
  const { fps } = useVideoConfig();

  // Slower, heavier entrance — premium feeling
  const sheafIn = spring({
    frame: f,
    fps,
    config: { damping: 22, mass: 1.3, stiffness: 50 },
  });

  const copyIn = ease(f, 55, 72);
  const exitFade = lin(f, 112, 120);

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: sheafIn * (1 - exitFade * 0.6),
          transform: `scale(${lerp(sheafIn, 0.92, 1)})`,
        }}
      >
        <PaperSheaf startFrame={12} />
      </div>

      {/* Page count subtitle */}
      <div
        style={{
          position: "absolute",
          bottom: 130,
          left: 0,
          right: 0,
          textAlign: "center" as const,
          opacity: lin(f, 40, 55) * (1 - exitFade),
        }}
      >
        <div
          style={{
            fontSize: 15,
            color: C.gray500,
            fontFamily: FONT,
            letterSpacing: 0.5,
          }}
        >
          142 pages &middot; 38 references &middot; WBUHS format
        </div>
      </div>

      {/* "Your thesis. Your work." */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: "center" as const,
          opacity: copyIn * (1 - exitFade),
        }}
      >
        <div
          style={{
            fontSize: 32,
            color: C.gray200,
            fontFamily: FONT,
            fontWeight: 400,
            letterSpacing: 2,
          }}
        >
          Your thesis. Your work.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Shot 7: Identity (840-900, 2s) ─────────────────────────────────────────
const ShotIdentity: React.FC = () => {
  const f = useCurrentFrame(); // 0-60 local

  const fadeIn = ease(f, 0, 20);

  // Subtle breathing after settle
  const breathe =
    f > 25
      ? interpolate(
          Math.sin(((f - 25) / 30) * Math.PI * 0.4),
          [-1, 1],
          [0.98, 1.02],
        )
      : 1;

  // Glow pulse
  const glowAlpha = interpolate(
    Math.sin((f / 30) * Math.PI * 0.6),
    [-1, 1],
    [0.1, 0.3],
  );

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {/* Orange glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          pointerEvents: "none" as const,
        }}
      >
        <div
          style={{
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(249,115,22,${glowAlpha * fadeIn}) 0%, rgba(249,115,22,0) 65%)`,
            filter: "blur(40px)",
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center" as const,
          opacity: fadeIn,
        }}
      >
        <div style={{ transform: `scale(${breathe})` }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: C.orange,
              fontFamily: FONT,
              letterSpacing: -1,
              marginBottom: 18,
              textShadow:
                "0 0 60px rgba(249,115,22,0.3), 0 0 120px rgba(249,115,22,0.15)",
            }}
          >
            Apollo
          </div>
          <div
            style={{
              fontSize: 20,
              color: C.gray500,
              fontFamily: FONT,
              fontWeight: 300,
              letterSpacing: 1,
            }}
          >
            AI-powered, not ghost-written.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPOSITION
// ═══════════════════════════════════════════════════════════════════════════

export const ApolloHeroVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT }}>
      {/* ACT 1 — TENSION */}
      <Sequence
        from={SHOTS.pressure.from}
        durationInFrames={SHOTS.pressure.to - SHOTS.pressure.from}
        layout="none"
      >
        <ShotPressure />
      </Sequence>

      <Sequence
        from={SHOTS.fracture.from}
        durationInFrames={SHOTS.fracture.to - SHOTS.fracture.from}
        layout="none"
      >
        <ShotFracture />
      </Sequence>

      {/* TURNING POINT */}
      <Sequence
        from={SHOTS.ignition.from}
        durationInFrames={SHOTS.ignition.to - SHOTS.ignition.from}
        layout="none"
      >
        <ShotIgnition />
      </Sequence>

      {/* ACT 2 — INTELLIGENCE */}
      <Sequence
        from={SHOTS.formation.from}
        durationInFrames={SHOTS.formation.to - SHOTS.formation.from}
        layout="none"
      >
        <ShotFormation />
      </Sequence>

      <Sequence
        from={SHOTS.proof.from}
        durationInFrames={SHOTS.proof.to - SHOTS.proof.from}
        layout="none"
      >
        <ShotProof />
      </Sequence>

      {/* ACT 3 — AUTHORITY */}
      <Sequence
        from={SHOTS.material.from}
        durationInFrames={SHOTS.material.to - SHOTS.material.from}
        layout="none"
      >
        <ShotMaterial />
      </Sequence>

      <Sequence
        from={SHOTS.identity.from}
        durationInFrames={SHOTS.identity.to - SHOTS.identity.from}
        layout="none"
      >
        <ShotIdentity />
      </Sequence>
    </AbsoluteFill>
  );
};

// ── Composition Config ──────────────────────────────────────────────────────
export const apolloHeroVideoConfig = {
  id: "ApolloHeroVideo",
  component: ApolloHeroVideo,
  durationInFrames: 900,
  fps: 30,
  width: 1280,
  height: 800,
} as const;

export default ApolloHeroVideo;
