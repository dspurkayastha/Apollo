"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
  Line,
  Environment,
  ContactShadows,
  MeshTransmissionMaterial,
  RoundedBox,
} from "@react-three/drei";
import * as THREE from "three";

// ── Reduced motion detection ────────────────────────────────────────────────
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

// ── Canvas2D page texture generator ─────────────────────────────────────────
// Page content per variant — title, subtitle, body paragraphs
const PAGE_CONTENT: { title: string; subtitle: string; body: string[] }[] = [
  {
    title: "Introduction",
    subtitle: "Background and Rationale",
    body: [
      "Chronic kidney disease represents a growing public health concern in the Indian subcontinent, with prevalence estimates ranging from 8.2% to 17.4% across various population-based studies.",
      "The early detection of renal impairment through biomarker screening has demonstrated significant potential for improving patient outcomes and reducing long-term morbidity.",
      "This study investigates the diagnostic accuracy of novel urinary biomarkers in comparison with established serum creatinine-based estimation methods.",
      "Epidemiological data from the Indian CKD Registry indicate that over 17% of the adult population in eastern India harbour stage 2 or higher renal disease, yet fewer than 5% receive timely diagnosis before irreversible nephron loss.",
      "The pathophysiological basis for early biomarker elevation rests on tubular injury preceding glomerular filtration decline. Neutrophil gelatinase-associated lipocalin and kidney injury molecule-1 are upregulated within hours of ischaemic or nephrotoxic insult.",
      "Existing screening protocols relying solely on serum creatinine and estimated GFR have demonstrated limited sensitivity in the subclinical phase, particularly among patients with low muscle mass or vegetarian dietary patterns.",
      "The present study therefore aims to establish a multimarker panel optimised for the Indian clinical context, addressing the diagnostic gap between tubular injury onset and overt glomerular dysfunction.",
    ],
  },
  {
    title: "Materials and Methods",
    subtitle: "Study Design and Protocol",
    body: [
      "A prospective observational study was conducted at the Department of Nephrology, Institute of Post-Graduate Medical Education, Kolkata, over a period of eighteen months from January 2024 to June 2025.",
      "Consecutive patients presenting with clinical features suggestive of early renal impairment were enrolled following informed written consent. The study protocol was approved by the Institutional Ethics Committee.",
      "Serum and urine samples were collected under standardised conditions and analysed using automated biochemistry analysers with appropriate internal quality controls.",
      "Inclusion criteria comprised adults aged 18 to 65 years with at least two risk factors for CKD including diabetes mellitus, hypertension, or family history of renal disease. Exclusion criteria included pre-existing dialysis, renal transplant recipients, and active urinary tract infection.",
      "Statistical analysis was performed using R version 4.4.1. Receiver operating characteristic curves were constructed for each biomarker and the combined panel, with area under the curve compared using the DeLong method.",
      "Sample size was calculated a priori assuming a minimum clinically significant AUC difference of 0.08 between the novel panel and serum creatinine alone, requiring 186 participants at 80% power with alpha set at 0.05.",
    ],
  },
  {
    title: "Review of Literature",
    subtitle: "Current Evidence and Gaps",
    body: [
      "A comprehensive literature search was performed across PubMed, Scopus, and the Cochrane Library databases. Studies published between 2015 and 2025 were included following PRISMA guidelines.",
      "Kumar et al. (2023) reported a sensitivity of 89.4% for cystatin C in detecting early glomerular filtration rate decline, significantly superior to conventional markers.",
      "Despite promising results, heterogeneity in study populations and methodologies necessitates further investigation in the Indian clinical context with standardised protocols.",
      "Sharma and colleagues conducted a multicentre trial across six tertiary hospitals in northern India demonstrating that urinary NGAL levels above 150 ng/mL predicted progression to stage 3 CKD within 24 months with a specificity of 91.2%.",
      "A recent meta-analysis pooling 42 studies and 18,740 participants concluded that combined biomarker panels outperform single-marker strategies, with summary sensitivity of 0.87 and specificity of 0.83 for early CKD detection.",
      "Identified gaps in the existing literature include limited representation of eastern Indian populations, absence of cost-effectiveness analyses for resource-constrained settings, and insufficient longitudinal follow-up beyond 12 months in most published cohorts.",
    ],
  },
];

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const testLine = currentLine + " " + words[i];
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

function createPageTexture(variant: 0 | 1 | 2): THREE.CanvasTexture {
  const w = 1024;
  const h = 1440;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Clean white paper background
  ctx.fillStyle = "#FEFEFE";
  ctx.fillRect(0, 0, w, h);

  // Subtle grain noise
  for (let i = 0; i < 800; i++) {
    const gx = Math.floor(((i * 7919 + 104729) % 100003) / 100003 * w);
    const gy = Math.floor(((i * 6271 + 73856) % 100003) / 100003 * h);
    ctx.fillStyle = `rgba(0,0,0,${0.008 + (i % 3) * 0.004})`;
    ctx.fillRect(gx, gy, 2, 2);
  }

  const margin = 88;
  const contentW = w - margin * 2;
  const content = PAGE_CONTENT[variant];

  // Chapter title — large serif
  ctx.fillStyle = "#2A2A2A";
  ctx.font = "bold 42px Georgia, 'Times New Roman', serif";
  ctx.fillText(content.title, margin, 120);

  // Subtitle
  ctx.fillStyle = "#4A4A4A";
  ctx.font = "italic 28px Georgia, 'Times New Roman', serif";
  ctx.fillText(content.subtitle, margin, 165);

  // Separator line
  ctx.fillStyle = "#C0C0C0";
  ctx.fillRect(margin, 185, contentW * 0.3, 1.5);

  // Body paragraphs — sans-serif
  ctx.font = "22px 'Helvetica Neue', Helvetica, Arial, sans-serif";
  ctx.fillStyle = "#505050";
  const lineHeight = 32;
  let y = 230;

  for (const paragraph of content.body) {
    const wrappedLines = wrapText(ctx, paragraph, contentW);
    for (const line of wrappedLines) {
      ctx.fillText(line, margin, y);
      y += lineHeight;
    }
    y += 18; // paragraph gap
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ── Thesis Page mesh ────────────────────────────────────────────────────────
function ThesisPageMesh({ variant }: { variant: 0 | 1 | 2 }) {
  const texture = useMemo(() => createPageTexture(variant), [variant]);

  useEffect(() => {
    return () => { texture.dispose(); };
  }, [texture]);

  return (
    <group>
      {/* Paper body — thicker for visible edges, warm tint for contrast */}
      <RoundedBox args={[2.1, 2.97, 0.04]} radius={0.006} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial
          color="#F0EDE6"
          roughness={0.82}
          metalness={0}
        />
      </RoundedBox>
      {/* Front face — bright white texture, sits on front surface */}
      <mesh position={[0, 0, 0.021]} castShadow receiveShadow>
        <planeGeometry args={[2.1, 2.97]} />
        <meshStandardMaterial
          map={texture}
          color="#FFFFFF"
          roughness={0.78}
          metalness={0}
          emissive="#FFFFFF"
          emissiveIntensity={0.06}
        />
      </mesh>
    </group>
  );
}

// ── Thesis pages group — visible fan, 3 edges showing ───────────────────────
function ThesisPagesGroup({ reducedMotion }: { reducedMotion: boolean }) {
  const Wrapper = reducedMotion ? StaticGroup : FloatWrapper;

  return (
    <group position={[-0.6, 0.5, 0]}>
      {/* Page A — back-left, peeks above and left */}
      <Wrapper speed={1.1} floatIntensity={0.15} rotationIntensity={0.03}>
        <group
          rotation={[0.05, -0.16, -0.08]}
          position={[-0.6, 0.4, -1.0]}
        >
          <ThesisPageMesh variant={0} />
        </group>
      </Wrapper>

      {/* Page B — front-centre, dominant */}
      <Wrapper speed={0.9} floatIntensity={0.12} rotationIntensity={0.02}>
        <group
          rotation={[0.02, -0.03, 0.02]}
          position={[0, 0.05, 0]}
        >
          <ThesisPageMesh variant={1} />
        </group>
      </Wrapper>

      {/* Page C — back-right, peeks right and slightly down */}
      <Wrapper speed={0.7} floatIntensity={0.12} rotationIntensity={0.03}>
        <group
          rotation={[-0.04, 0.18, 0.08]}
          position={[0.65, -0.3, -0.65]}
        >
          <ThesisPageMesh variant={2} />
        </group>
      </Wrapper>
    </group>
  );
}

// ── Float / Static wrapper ──────────────────────────────────────────────────
function FloatWrapper({
  children,
  speed,
  floatIntensity,
  rotationIntensity,
}: {
  children: React.ReactNode;
  speed: number;
  floatIntensity: number;
  rotationIntensity: number;
}) {
  return (
    <Float speed={speed} floatIntensity={floatIntensity} rotationIntensity={rotationIntensity}>
      {children}
    </Float>
  );
}

function StaticGroup({
  children,
}: {
  children: React.ReactNode;
  speed?: number;
  floatIntensity?: number;
  rotationIntensity?: number;
}) {
  return <group>{children}</group>;
}

// ── Scatter data — 18 points with varying sizes ─────────────────────────────
const SCATTER_COLORS = ["#2D8C5A", "#D4644A", "#3A82B8", "#D4A030"];

// Breathe config per colour group — frequency, phase offset, amplitude
const GROUP_BREATHE: Record<string, { freq: number; phase: number; amp: number }> = {
  [SCATTER_COLORS[0]]: { freq: 0.7, phase: 0, amp: 0.06 },
  [SCATTER_COLORS[1]]: { freq: 1.1, phase: 1.2, amp: 0.08 },
  [SCATTER_COLORS[2]]: { freq: 0.9, phase: 2.5, amp: 0.05 },
  [SCATTER_COLORS[3]]: { freq: 1.4, phase: 0.8, amp: 0.07 },
};

const SCATTER_POINTS: {
  x: number;
  y: number;
  z: number;
  radius: number;
  color: string;
}[] = [
  // Large spheres — spread across Z depth
  { x: 0.15, y: 0.22, z: 0.85, radius: 0.12, color: SCATTER_COLORS[0] },
  { x: 1.65, y: 1.50, z: 0.20, radius: 0.11, color: SCATTER_COLORS[1] },
  { x: 0.90, y: 0.85, z: 1.10, radius: 0.10, color: SCATTER_COLORS[2] },
  // Medium-large
  { x: 0.50, y: 0.52, z: 0.10, radius: 0.09, color: SCATTER_COLORS[3] },
  { x: 1.30, y: 1.20, z: 0.75, radius: 0.09, color: SCATTER_COLORS[0] },
  { x: 1.10, y: 0.78, z: 0.40, radius: 0.085, color: SCATTER_COLORS[1] },
  // Medium
  { x: 0.35, y: 0.55, z: 1.20, radius: 0.075, color: SCATTER_COLORS[2] },
  { x: 0.75, y: 0.60, z: 0.05, radius: 0.07, color: SCATTER_COLORS[3] },
  { x: 1.45, y: 1.35, z: 0.55, radius: 0.07, color: SCATTER_COLORS[0] },
  { x: 1.80, y: 1.58, z: 0.90, radius: 0.075, color: SCATTER_COLORS[1] },
  // Small
  { x: 0.60, y: 0.75, z: 1.30, radius: 0.055, color: SCATTER_COLORS[2] },
  { x: 1.20, y: 0.92, z: 0.15, radius: 0.05, color: SCATTER_COLORS[3] },
  { x: 0.25, y: 0.10, z: 0.60, radius: 0.05, color: SCATTER_COLORS[0] },
  { x: 1.55, y: 1.10, z: 1.05, radius: 0.055, color: SCATTER_COLORS[1] },
  // Tiny
  { x: 0.45, y: 0.30, z: 0.95, radius: 0.04, color: SCATTER_COLORS[2] },
  { x: 0.85, y: 1.05, z: 1.25, radius: 0.04, color: SCATTER_COLORS[3] },
  { x: 1.70, y: 1.42, z: 0.30, radius: 0.035, color: SCATTER_COLORS[0] },
  { x: 1.00, y: 0.65, z: 0.70, radius: 0.038, color: SCATTER_COLORS[1] },
];

// ── Scatter sphere — per-group breathe animation ────────────────────────────
function ScatterSphere({
  position,
  color,
  radius,
  reducedMotion,
}: {
  position: [number, number, number];
  color: string;
  radius: number;
  reducedMotion: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => new THREE.SphereGeometry(radius, 32, 32), [radius]);
  const breathe = GROUP_BREATHE[color] ?? { freq: 0.8, phase: 0, amp: 0.05 };

  useFrame(({ clock }) => {
    if (reducedMotion || !meshRef.current) return;
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * breathe.freq + breathe.phase) * breathe.amp;
    meshRef.current.scale.setScalar(s);
  });

  return (
    <mesh ref={meshRef} geometry={geometry} position={position} castShadow>
      <MeshTransmissionMaterial
        transmissionSampler
        transmission={1}
        thickness={radius * 5}
        roughness={0.01}
        chromaticAberration={0.04}
        anisotropicBlur={0.08}
        distortion={0.15}
        distortionScale={0.4}
        temporalDistortion={0.02}
        backside
        backsideThickness={radius * 2}
        color={color}
        toneMapped={false}
        opacity={0.65}
        transparent
      />
    </mesh>
  );
}

// ── Axes with tick marks and arrowheads ──────────────────────────────────────
const AXIS_COLOR = "#C0C0C0";
const AXIS_LENGTH = 2.2;
const TICK_SIZE = 0.025;
const TICK_INTERVAL = 0.5;
const ARROW_HEIGHT = 0.1;
const ARROW_RADIUS = 0.025;

function AxisArrow({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <coneGeometry args={[ARROW_RADIUS, ARROW_HEIGHT, 8]} />
      <meshBasicMaterial color={AXIS_COLOR} />
    </mesh>
  );
}

function ScatterAxes({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  const ticks = useMemo(() => {
    const result: { start: [number, number, number]; end: [number, number, number] }[] = [];

    for (let t = TICK_INTERVAL; t <= AXIS_LENGTH; t += TICK_INTERVAL) {
      result.push({ start: [t, -TICK_SIZE, 0], end: [t, TICK_SIZE, 0] });
    }
    for (let t = TICK_INTERVAL; t <= AXIS_LENGTH; t += TICK_INTERVAL) {
      result.push({ start: [-TICK_SIZE, t, 0], end: [TICK_SIZE, t, 0] });
    }
    for (let t = TICK_INTERVAL; t <= 0.6; t += TICK_INTERVAL) {
      result.push({ start: [0, -TICK_SIZE, t], end: [0, TICK_SIZE, t] });
    }

    return result;
  }, []);

  useFrame(({ clock }) => {
    if (reducedMotion || !groupRef.current) return;
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * 0.35) * 0.008;
    groupRef.current.scale.setScalar(s);
  });

  return (
    <group ref={groupRef}>
      {/* Axis lines */}
      <Line points={[[0, 0, 0], [AXIS_LENGTH, 0, 0]]} color={AXIS_COLOR} lineWidth={1} />
      <Line points={[[0, 0, 0], [0, AXIS_LENGTH, 0]]} color={AXIS_COLOR} lineWidth={1} />
      <Line points={[[0, 0, 0], [0, 0, 0.6]]} color={AXIS_COLOR} lineWidth={1} />

      {/* Arrowheads — cones at axis tips */}
      <AxisArrow position={[AXIS_LENGTH, 0, 0]} rotation={[0, 0, -Math.PI / 2]} />
      <AxisArrow position={[0, AXIS_LENGTH, 0]} rotation={[0, 0, 0]} />
      <AxisArrow position={[0, 0, 0.6]} rotation={[Math.PI / 2, 0, 0]} />

      {/* Tick marks */}
      {ticks.map((tick, i) => (
        <Line key={i} points={[tick.start, tick.end]} color={AXIS_COLOR} lineWidth={1} />
      ))}
    </group>
  );
}

// ── Scatter plot — overlaps right edge of pages ─────────────────────────────
function ScatterPlotGroup({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (reducedMotion || !groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.position.y = -0.3 + Math.sin(t * 0.6) * 0.1;
  });

  return (
    <group
      ref={groupRef}
      position={[0.0, -0.3, 1.5]}
      rotation={[0.1, -45 * (Math.PI / 180), 0.15]}
    >
      <ScatterAxes reducedMotion={reducedMotion} />
      {SCATTER_POINTS.map((pt, i) => (
        <ScatterSphere
          key={i}
          position={[pt.x, pt.y, pt.z]}
          color={pt.color}
          radius={pt.radius}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}

// ── Procedural environment (no HDR download) ────────────────────────────────
function StudioEnvironment() {
  return (
    <Environment frames={1} resolution={128} background={false}>
      <mesh position={[0, 6, 0]} scale={30}>
        <planeGeometry />
        <meshBasicMaterial color="#FFFEF8" />
      </mesh>
      <mesh position={[0, -6, 0]} scale={30} rotation={[Math.PI, 0, 0]}>
        <planeGeometry />
        <meshBasicMaterial color="#E8E0D0" />
      </mesh>
      <mesh position={[-8, 0, 0]} scale={20} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry />
        <meshBasicMaterial color="#FFF5E8" />
      </mesh>
      <mesh position={[8, 0, 0]} scale={20} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry />
        <meshBasicMaterial color="#E8ECF0" />
      </mesh>
      <mesh position={[0, 2, 8]} scale={15} rotation={[0, Math.PI, 0]}>
        <planeGeometry />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
    </Environment>
  );
}

// ── Main scene ──────────────────────────────────────────────────────────────
function Scene() {
  const reducedMotion = useReducedMotion();

  return (
    <>
      <StudioEnvironment />

      {/* Lighting — key/fill/rim for depth */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[4, 8, 3]}
        intensity={1.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0005}
      />
      <pointLight position={[-4, 4, 3]} intensity={0.6} color="#FFF5E6" />
      <pointLight position={[2, -2, 5]} intensity={0.3} color="#F5F0E8" />
      <directionalLight position={[-3, 2, -4]} intensity={0.8} color="#E8ECF0" />

      {/* Soft contact shadows beneath objects */}
      <ContactShadows
        position={[0, -1.5, 0]}
        opacity={0.3}
        scale={20}
        blur={2.5}
        smooth
        far={5}
        resolution={512}
        color="#2A2520"
      />

      <ThesisPagesGroup reducedMotion={reducedMotion} />
      <ScatterPlotGroup reducedMotion={reducedMotion} />
    </>
  );
}

// ── Exported component ──────────────────────────────────────────────────────
export function Hero3DScene() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 0.5, 7], fov: 38, near: 0.1, far: 50 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "default" }}
      style={{ background: "transparent" }}
    >
      <Scene />
    </Canvas>
  );
}
