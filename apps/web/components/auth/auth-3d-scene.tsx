"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
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

// ── Float / Static wrappers ─────────────────────────────────────────────────
function FloatWrap({
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
    <Float
      speed={speed}
      floatIntensity={floatIntensity}
      rotationIntensity={rotationIntensity}
    >
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

// ── Procedural studio environment ───────────────────────────────────────────
function StudioEnvironment() {
  return (
    <Environment frames={1} resolution={128} background={false}>
      <mesh position={[0, 8, 0]} scale={30}>
        <planeGeometry />
        <meshBasicMaterial color="#FFFEF8" />
      </mesh>
      <mesh position={[0, -6, 0]} scale={30} rotation={[Math.PI, 0, 0]}>
        <planeGeometry />
        <meshBasicMaterial color="#F0EBE0" />
      </mesh>
      <mesh position={[-8, 2, 0]} scale={20} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry />
        <meshBasicMaterial color="#FFF5E8" />
      </mesh>
      <mesh position={[8, 2, 0]} scale={20} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry />
        <meshBasicMaterial color="#E8ECF0" />
      </mesh>
      <mesh position={[0, 3, 8]} scale={15} rotation={[0, Math.PI, 0]}>
        <planeGeometry />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
    </Environment>
  );
}

// ── Flat ribbon geometry for DNA strands ─────────────────────────────────────
function createRibbonGeometry(
  curve: THREE.CatmullRomCurve3,
  segments: number,
  ribbonWidth: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();

    // Radial direction: outward from Y-axis through this point
    const radial = new THREE.Vector3(point.x, 0, point.z);
    if (radial.lengthSq() < 0.0001) radial.set(1, 0, 0);
    radial.normalize();

    // Binormal perpendicular to tangent and radial — ribbon lies in this direction
    const binormal = new THREE.Vector3().crossVectors(tangent, radial).normalize();

    const halfW = ribbonWidth / 2;
    positions.push(
      point.x + binormal.x * halfW,
      point.y + binormal.y * halfW,
      point.z + binormal.z * halfW,
    );
    positions.push(
      point.x - binormal.x * halfW,
      point.y - binormal.y * halfW,
      point.z - binormal.z * halfW,
    );

    if (i < segments) {
      const b = i * 2;
      indices.push(b, b + 1, b + 2);
      indices.push(b + 1, b + 3, b + 2);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

// ── DNA Double Helix ────────────────────────────────────────────────────────
const HELIX_RADIUS = 0.35;
const HELIX_HEIGHT = 2.6;
const HELIX_TURNS = 2.5;
const RIBBON_WIDTH = 0.14;
const RUNG_RADIUS = 0.018;
const HELIX_SAMPLES = 120;

function generateStrandPoints(phaseOffset: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= HELIX_SAMPLES; i++) {
    const t = (i / HELIX_SAMPLES) * HELIX_TURNS * Math.PI * 2;
    const x = HELIX_RADIUS * Math.cos(t + phaseOffset);
    const y = (t / (HELIX_TURNS * Math.PI * 2)) * HELIX_HEIGHT - HELIX_HEIGHT / 2;
    const z = HELIX_RADIUS * Math.sin(t + phaseOffset);
    points.push(new THREE.Vector3(x, y, z));
  }
  return points;
}

function DNAHelix({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  const { strand1Geom, strand2Geom, rungs } = useMemo(() => {
    const pts1 = generateStrandPoints(0);
    const pts2 = generateStrandPoints(Math.PI);

    const curve1 = new THREE.CatmullRomCurve3(pts1);
    const curve2 = new THREE.CatmullRomCurve3(pts2);

    const s1Geom = createRibbonGeometry(curve1, 200, RIBBON_WIDTH);
    const s2Geom = createRibbonGeometry(curve2, 200, RIBBON_WIDTH);

    // Generate rungs every ~36 degrees (PI/5 radians)
    const rungData: { position: THREE.Vector3; quaternion: THREE.Quaternion; length: number }[] = [];
    const rungStep = Math.PI / 5;
    const totalAngle = HELIX_TURNS * Math.PI * 2;

    for (let angle = rungStep; angle < totalAngle; angle += rungStep) {
      const t = angle / totalAngle;
      const p1 = curve1.getPointAt(t);
      const p2 = curve2.getPointAt(t);

      const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const direction = new THREE.Vector3().subVectors(p2, p1);
      const length = direction.length();
      direction.normalize();

      const quat = new THREE.Quaternion();
      quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

      rungData.push({ position: midpoint, quaternion: quat, length });
    }

    return { strand1Geom: s1Geom, strand2Geom: s2Geom, rungs: rungData };
  }, []);

  useEffect(() => {
    return () => {
      strand1Geom.dispose();
      strand2Geom.dispose();
    };
  }, [strand1Geom, strand2Geom]);

  useFrame(({ clock }) => {
    if (reducedMotion || !groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.rotation.y = t * 0.08;
    groupRef.current.position.y = 0.15 + Math.sin(t * 0.3) * 0.04;
  });

  return (
    <group
      ref={groupRef}
      position={[0.6, 0.15, 0.4]}
      rotation={[0, 0, 0.087]} // ~5 deg Z tilt
    >
      {/* Strand 1 — cream flat ribbon */}
      <mesh geometry={strand1Geom} castShadow receiveShadow>
        <meshStandardMaterial
          color="#F0EDE6"
          roughness={0.25}
          metalness={0.02}
          envMapIntensity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Strand 2 — sage green flat ribbon */}
      <mesh geometry={strand2Geom} castShadow receiveShadow>
        <meshStandardMaterial
          color="#B8C9A3"
          roughness={0.25}
          metalness={0.02}
          envMapIntensity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Connecting rungs — amber */}
      {rungs.map((rung, i) => (
        <mesh
          key={i}
          position={rung.position}
          quaternion={rung.quaternion}
          castShadow
        >
          <cylinderGeometry args={[RUNG_RADIUS, RUNG_RADIUS, rung.length * 0.88, 6]} />
          <meshStandardMaterial color="#D4A373" roughness={0.5} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

// ── Canvas-textured tablet screen ───────────────────────────────────────────
function createScreenTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 1440;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // White background
  ctx.fillStyle = "#FEFEFE";
  ctx.fillRect(0, 0, w, h);

  // Grain noise (800 points)
  for (let i = 0; i < 800; i++) {
    const gx = Math.random() * w;
    const gy = Math.random() * h;
    const grey = Math.floor(180 + Math.random() * 60);
    ctx.fillStyle = `rgba(${grey}, ${grey}, ${grey}, 0.15)`;
    ctx.fillRect(gx, gy, 1, 1);
  }

  const margin = 72;
  const textWidth = w - margin * 2;
  let y = 100;

  // Title
  ctx.fillStyle = "#1A1A1A";
  ctx.font = "bold 36px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "left";
  const titleLines = wrapText(
    ctx,
    "AI Thesis Writing Platform to Hize Scientific Research Methodology",
    textWidth,
  );
  for (const line of titleLines) {
    ctx.fillText(line, margin, y);
    y += 44;
  }
  y += 12;

  // Author names
  ctx.fillStyle = "#444444";
  ctx.font = "italic 18px Georgia, 'Times New Roman', serif";
  ctx.fillText("D. Purkayastha\u00B9, S. Mehta\u00B2, R. Chatterjee\u00B3", margin, y);
  y += 28;

  // Affiliations
  ctx.fillStyle = "#777777";
  ctx.font = "14px 'Helvetica Neue', Helvetica, Arial, sans-serif";
  ctx.fillText("\u00B9 Institute of Post-Graduate Medical Education, Kolkata", margin, y);
  y += 20;
  ctx.fillText("\u00B2 Department of Biostatistics, AIIMS New Delhi", margin, y);
  y += 20;
  ctx.fillText("\u00B3 School of Public Health, SSUHS Assam", margin, y);
  y += 36;

  // Separator
  ctx.fillStyle = "#CCCCCC";
  ctx.fillRect(margin, y, textWidth * 0.4, 1.5);
  y += 32;

  // Abstract heading
  ctx.fillStyle = "#1A1A1A";
  ctx.font = "bold 26px Georgia, 'Times New Roman', serif";
  ctx.fillText("Abstract", margin, y);
  y += 36;

  // Abstract body with yellow highlights
  ctx.font = "18px 'Helvetica Neue', Helvetica, Arial, sans-serif";
  const abstractText =
    "Chronic kidney disease represents a growing public health concern in the Indian subcontinent, with prevalence estimates ranging from 8.2% to 17.4% across various population-based studies. The early detection of renal impairment through biomarker screening has demonstrated significant potential for improving patient outcomes.";
  const abstractLines = wrapText(ctx, abstractText, textWidth);

  for (let i = 0; i < abstractLines.length; i++) {
    if (i < 2) {
      ctx.fillStyle = "#F5E6B8";
      const metrics = ctx.measureText(abstractLines[i]);
      ctx.fillRect(margin - 4, y - 16, metrics.width + 8, 26);
    }
    ctx.fillStyle = "#333333";
    ctx.fillText(abstractLines[i], margin, y);
    y += 26;
  }
  y += 20;

  // Introduction heading
  ctx.fillStyle = "#1A1A1A";
  ctx.font = "bold 22px Georgia, 'Times New Roman', serif";
  ctx.fillText("1. Introduction", margin, y);
  y += 32;

  // Introduction body with green highlights
  ctx.font = "18px 'Helvetica Neue', Helvetica, Arial, sans-serif";
  const introText =
    "This study investigates the diagnostic accuracy of novel urinary biomarkers in comparison with established serum creatinine-based estimation methods. Epidemiological data from the Indian CKD Registry indicate that over 17% of the adult population in eastern India harbour stage 2 or higher renal disease.";
  const introLines = wrapText(ctx, introText, textWidth);

  for (let i = 0; i < introLines.length; i++) {
    if (i >= 2 && i <= 3) {
      ctx.fillStyle = "#C8E6C0";
      const metrics = ctx.measureText(introLines[i]);
      ctx.fillRect(margin - 4, y - 16, metrics.width + 8, 26);
    }
    ctx.fillStyle = "#333333";
    ctx.fillText(introLines[i], margin, y);
    y += 26;
  }
  y += 20;

  // Highlighting section
  ctx.fillStyle = "#1A1A1A";
  ctx.font = "bold 22px Georgia, 'Times New Roman', serif";
  ctx.fillText("2. Highlighting", margin, y);
  y += 32;

  ctx.font = "18px 'Helvetica Neue', Helvetica, Arial, sans-serif";
  const highlightText =
    "The pathophysiological basis for early biomarker elevation rests on tubular injury preceding glomerular filtration decline. NGAL and KIM-1 are upregulated within hours of ischaemic insult.";
  const highlightLines = wrapText(ctx, highlightText, textWidth);

  for (let i = 0; i < highlightLines.length; i++) {
    if (i === 1) {
      ctx.fillStyle = "#F5E6B8";
      const metrics = ctx.measureText(highlightLines[i]);
      ctx.fillRect(margin - 4, y - 16, metrics.width + 8, 26);
    }
    ctx.fillStyle = "#333333";
    ctx.fillText(highlightLines[i], margin, y);
    y += 26;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// ── Modern thin-bezel tablet ────────────────────────────────────────────────
function Tablet({ reducedMotion }: { reducedMotion: boolean }) {
  const screenTexture = useMemo(() => createScreenTexture(), []);

  useEffect(() => {
    return () => {
      screenTexture.dispose();
    };
  }, [screenTexture]);

  const Wrapper = reducedMotion ? StaticGroup : FloatWrap;

  return (
    <Wrapper speed={0.6} floatIntensity={0.06} rotationIntensity={0.008}>
      <group
        position={[-1.2, -0.1, 1.4]}
        rotation={[0.06, 0.41, 0.0]} // slight backward lean + ~24deg Y rotation
      >
        {/* Device bezel — dark charcoal, very thin modern bezels */}
        <RoundedBox
          args={[1.72, 2.44, 0.05]}
          radius={0.06}
          smoothness={4}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color="#1A1A1A"
            roughness={0.4}
            metalness={0.08}
            envMapIntensity={0.5}
          />
        </RoundedBox>

        {/* Screen — canvas texture, nearly edge-to-edge */}
        <mesh position={[0, 0, 0.026]} receiveShadow>
          <planeGeometry args={[1.62, 2.32]} />
          <meshStandardMaterial
            map={screenTexture}
            color="#FFFFFF"
            roughness={0.88}
            metalness={0}
            emissive="#FFFFFF"
            emissiveIntensity={0.04}
          />
        </mesh>
      </group>
    </Wrapper>
  );
}

// ── Display Pedestals ───────────────────────────────────────────────────────
// Ground plane at y = -2.0. All pedestals sit with bottoms at y = -2.0.
function Pedestals() {
  return (
    <group>
      {/* Left pedestal — cream cube */}
      {/* 1.1^3, bottom at y=-2.0, centre at y=-1.45 */}
      <mesh position={[-1.4, -1.45, 0.2]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 1.1, 1.1]} />
        <meshStandardMaterial
          color="#F0EDE6"
          roughness={0.35}
          metalness={0.02}
          envMapIntensity={0.5}
        />
      </mesh>

      {/* Centre pedestal — mauve cylinder base + gold disc */}
      <group position={[0.6, 0, 0.4]}>
        {/* Mauve cylinder: r=0.65, h=0.4, bottom at y=-2.0, centre at y=-1.8 */}
        <mesh position={[0, -1.8, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.65, 0.65, 0.4, 32]} />
          <meshStandardMaterial
            color="#BFA8A0"
            roughness={0.6}
            metalness={0.05}
            envMapIntensity={0.4}
          />
        </mesh>
        {/* Gold disc: r=0.55, h=0.06, bottom at y=-1.6 (top of cylinder), centre at y=-1.57 */}
        <mesh position={[0, -1.57, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.06, 32]} />
          <meshStandardMaterial
            color="#C8964C"
            roughness={0.25}
            metalness={0.6}
            envMapIntensity={0.8}
          />
        </mesh>
      </group>

      {/* Right pedestal — cream cube, partially visible at right edge */}
      {/* 1.1^3, bottom at y=-2.0, centre at y=-1.45 */}
      <mesh position={[2.6, -1.45, 0.0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 1.1, 1.1]} />
        <meshStandardMaterial
          color="#F0EDE6"
          roughness={0.35}
          metalness={0.02}
          envMapIntensity={0.5}
        />
      </mesh>
    </group>
  );
}

// ── Glass Disc — sits precisely on top of gold disc ─────────────────────────
// Gold disc top at y = -1.57 + 0.03 = -1.54. Glass disc bottom at -1.54, centre at -1.525.
function GlassDisc() {
  return (
    <mesh position={[0.6, -1.525, 0.4]} castShadow>
      <cylinderGeometry args={[0.4, 0.4, 0.03, 32]} />
      <MeshTransmissionMaterial
        transmissionSampler
        transmission={0.85}
        thickness={0.15}
        roughness={0.05}
        chromaticAberration={0.02}
        anisotropicBlur={0.03}
        backside
        backsideThickness={0.1}
        color="#F5EDE0"
        toneMapped={false}
        opacity={0.9}
        transparent
      />
    </mesh>
  );
}

// ── Floating Decorative Shapes ──────────────────────────────────────────────
function FloatingShapes({ reducedMotion }: { reducedMotion: boolean }) {
  const Wrapper = reducedMotion ? StaticGroup : FloatWrap;

  return (
    <>
      {/* Small brown sphere — upper left */}
      <Wrapper speed={0.5} floatIntensity={0.1} rotationIntensity={0.02}>
        <mesh position={[-1.8, 1.8, 0.6]} castShadow>
          <sphereGeometry args={[0.1, 24, 24]} />
          <meshStandardMaterial color="#8B7B6B" roughness={0.8} metalness={0.02} />
        </mesh>
      </Wrapper>

      {/* Large gold disc — behind tablet, left */}
      <Wrapper speed={0.3} floatIntensity={0.06} rotationIntensity={0.01}>
        <mesh
          position={[-2.3, 0.3, -0.3]}
          rotation={[0.3, 0.4, 0.15]}
          castShadow
        >
          <cylinderGeometry args={[0.7, 0.7, 0.05, 32]} />
          <meshStandardMaterial
            color="#D4A373"
            roughness={0.3}
            metalness={0.4}
            envMapIntensity={0.7}
          />
        </mesh>
      </Wrapper>

      {/* Small amber cube — upper centre, between tablet and helix */}
      <Wrapper speed={0.7} floatIntensity={0.12} rotationIntensity={0.03}>
        <mesh position={[0.0, 1.9, 0.9]} rotation={[0.4, 0.6, 0.2]} castShadow>
          <boxGeometry args={[0.15, 0.15, 0.15]} />
          <meshStandardMaterial
            color="#D4A373"
            roughness={0.35}
            metalness={0.3}
            envMapIntensity={0.6}
          />
        </mesh>
      </Wrapper>

      {/* Dark tetrahedron — right of helix */}
      <Wrapper speed={0.4} floatIntensity={0.08} rotationIntensity={0.02}>
        <mesh position={[2.0, 0.8, 0.5]} rotation={[0.5, 0.3, 0.7]} castShadow>
          <tetrahedronGeometry args={[0.13]} />
          <meshStandardMaterial color="#5C4033" roughness={0.7} metalness={0.02} />
        </mesh>
      </Wrapper>

      {/* Small gold sphere — on glass disc at DNA base */}
      <Wrapper speed={0.6} floatIntensity={0.04} rotationIntensity={0.01}>
        <mesh position={[0.8, -1.48, 0.55]} castShadow>
          <sphereGeometry args={[0.08, 24, 24]} />
          <meshStandardMaterial
            color="#D4A373"
            roughness={0.3}
            metalness={0.4}
            envMapIntensity={0.7}
          />
        </mesh>
      </Wrapper>
    </>
  );
}

// ── Main scene ──────────────────────────────────────────────────────────────
function AuthScene() {
  const reducedMotion = useReducedMotion();

  return (
    <>
      <StudioEnvironment />

      {/* Ambient */}
      <ambientLight intensity={0.5} />

      {/* Key light — upper-right, warm, shadow-casting */}
      <directionalLight
        position={[4, 8, 3]}
        intensity={1.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={25}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />

      {/* Fill light — warm from left */}
      <pointLight
        position={[-4, 4, 3]}
        intensity={0.6}
        color="#FFF5E6"
        distance={20}
        decay={2}
      />

      {/* Subtle fill from below-right */}
      <pointLight
        position={[2, -2, 5]}
        intensity={0.3}
        color="#F5F0E8"
        distance={15}
        decay={2}
      />

      {/* Rim light — cool from behind-left */}
      <directionalLight
        position={[-3, 2, -4]}
        intensity={0.8}
        color="#E8ECF0"
      />

      {/* Scene objects */}
      <DNAHelix reducedMotion={reducedMotion} />
      <Tablet reducedMotion={reducedMotion} />
      <Pedestals />
      <GlassDisc />
      <FloatingShapes reducedMotion={reducedMotion} />

      {/* Contact shadows — ground plane at y=-2.0 */}
      <ContactShadows
        position={[0, -2.0, 0]}
        opacity={0.3}
        scale={14}
        blur={2.5}
        far={6}
        resolution={512}
        color="#2A2520"
      />
    </>
  );
}

// ── Exported component ──────────────────────────────────────────────────────
export default function Auth3DScene() {
  return (
    <Canvas
      shadows
      camera={{
        position: [0, 0.2, 9.5],
        fov: 40,
        near: 0.1,
        far: 50,
      }}
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "default",
      }}
      style={{ background: "transparent" }}
    >
      <AuthScene />
    </Canvas>
  );
}
