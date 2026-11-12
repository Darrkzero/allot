"use client";

import { Canvas, useFrame, useThree, type ThreeElements } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import type { LogoToken } from "@/lib/logos/tokens";
import { ALLOT, NAVY, edgeTexture, glowTexture, makeFace, whiteTexture, type FacePalette, type Glyph } from "./textures";

// "Many coins in, one Allot": real token coins spiral in, lock into an orbit around the Allot coin,
// react to the pointer, and speed up / spread out as the page scrolls.

export type Motion = {
  pointer: RefObject<{ x: number; y: number }>;
  scroll: RefObject<number>; // 0 at top of page → 1 when the hero has scrolled away
  reduced: boolean;
};

const RING: { token: LogoToken; rim: "silver" | "gold" }[] = [
  { token: "USDC", rim: "silver" }, { token: "ETH", rim: "gold" }, { token: "BTC", rim: "gold" }, { token: "SOL", rim: "silver" },
  { token: "USDT", rim: "silver" }, { token: "NEAR", rim: "gold" }, { token: "BNB", rim: "gold" }, { token: "ZEC", rim: "silver" },
  { token: "TON", rim: "silver" }, { token: "TRX", rim: "gold" }, { token: "USDC", rim: "gold" }, { token: "ETH", rim: "silver" },
  { token: "NEAR", rim: "silver" }, { token: "USDT", rim: "gold" },
];

const RIM = {
  silver: { color: "#dfe7f5", roughness: 0.18 },
  gold: { color: "#e9c07a", roughness: 0.24 },
  mint: { color: "#bff5e2", roughness: 0.16 },
};

// Shared across coins: one edge material per rim colour, one face material per glyph.
// Every coin surface uses the same texture slots (map + bumpMap + emissiveMap), so three.js builds ONE
// shader program for all of them. Each program costs 0.2–0.6 s to compile on Windows/Direct3D.
const edgeCache = new Map<string, THREE.Material>();
const faceMatCache = new Map<string, THREE.Material>();

function edgeMaterial(rim: keyof typeof RIM) {
  let m = edgeCache.get(rim);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: RIM[rim].color, metalness: 1, roughness: RIM[rim].roughness, bumpMap: edgeTexture(), bumpScale: 2, envMapIntensity: 1.6,
      map: whiteTexture(), emissiveMap: whiteTexture(), // no-op (white map, black emissive): only here to share the program
    });
    edgeCache.set(rim, m);
  }
  return m;
}

function faceMaterial(glyph: Glyph, palette: FacePalette) {
  const key = `${glyph}:${palette.light}`;
  let m = faceMatCache.get(key);
  if (!m) {
    const { map, bump } = makeFace(glyph, palette);
    m =
      glyph === "allot"
        ? // Hero coin: low env reflection keeps the face dark from any angle; the logo carries the glow.
          new THREE.MeshStandardMaterial({
            map, bumpMap: bump, bumpScale: 6, metalness: 0.3, roughness: 0.4, envMapIntensity: 0.2,
            emissive: new THREE.Color("#ffffff"), emissiveMap: map, emissiveIntensity: 1,
          })
        : // Token coins: emissive stays black, so emissiveMap adds no glow; it only keeps the shared program.
          new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 6, metalness: 0.85, roughness: 0.26, envMapIntensity: 1.45, emissiveMap: map });
    faceMatCache.set(key, m);
  }
  return m;
}

const geoCache = new Map<number, THREE.CylinderGeometry>();
function coinGeometry(radius: number) {
  let g = geoCache.get(radius);
  if (!g) {
    g = new THREE.CylinderGeometry(radius, radius, radius * 0.2, 56, 1);
    g.rotateX(Math.PI / 2); // faces point along ±Z
    g.rotateZ(Math.PI / 2); // cap UVs come out rotated; this keeps glyphs upright on the front face
    geoCache.set(radius, g);
  }
  return g;
}

function Coin({ glyph, palette = NAVY, rim, radius, ...props }: { glyph: Glyph; palette?: FacePalette; rim: keyof typeof RIM; radius: number } & ThreeElements["group"]) {
  const materials = useMemo(() => {
    const face = faceMaterial(glyph, palette);
    return [edgeMaterial(rim), face, face]; // cylinder groups: side, top, bottom
  }, [glyph, palette, rim]);
  return (
    <group {...props}>
      <mesh geometry={coinGeometry(radius)} material={materials} />
    </group>
  );
}

const RADIUS = 4.3;
// Intro timeline (seconds from the first rendered frame)
const COIN_DELAY = 0.1;
const COIN_STAGGER = 0.06;
const COIN_DUR = 1.8;
const CENTER_DELAY = 0.4;
const CENTER_DUR = 2.0;
const LANDED_AT = COIN_DELAY + (RING.length - 1) * COIN_STAGGER + COIN_DUR; // last coin locks in

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);

/** Frames the ring for the canvas shape: wide stage on desktop, pulled back on narrow phones. */
function Rig({ motion }: { motion: Motion }) {
  const { camera, size } = useThree();
  const base = useRef(12.5);
  const smooth = useRef(0);
  useEffect(() => {
    const aspect = size.width / size.height;
    base.current = aspect >= 2.6 ? 11.2 : aspect >= 1.8 ? 12.5 : aspect >= 1.2 ? 13 : 17;
  }, [size]);
  useFrame((_, dt) => {
    // Gentle dolly back + rise as the hero scrolls away (eased, so wheel steps glide).
    const target = motion.reduced ? 0 : motion.scroll.current ?? 0;
    smooth.current += (target - smooth.current) * (1 - Math.pow(0.002, Math.min(dt, 0.05)));
    const s = smooth.current;
    camera.position.set(0, 1.4 + s * 1.6, base.current + s * 3);
    camera.lookAt(0, -0.3, 0);
  });
  return null;
}

/**
 * Compiles every shader before the coins appear. With KHR_parallel_shader_compile (Chrome, Edge) this
 * runs on background threads, so the page never freezes mid-intro. Without it the promise resolves at
 * once and the first visible frame absorbs the work instead; the intro clock starts after that frame.
 */
function useShadersReady() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    const done = () => {
      if (live) setReady(true);
    };
    // Runs after <Environment> has set scene.environment (layout effects run first), so the programs
    // compiled here are the exact ones the first render uses.
    gl.compileAsync(scene, camera).then(done, done);
    return () => {
      live = false;
    };
  }, [gl, scene, camera]);
  return ready;
}

function Orbit({ motion }: { motion: Motion }) {
  const ready = useShadersReady();
  const shownFrames = useRef(0);
  const tilt = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Group>(null);
  const center = useRef<THREE.Group>(null);
  const holders = useRef<(THREE.Group | null)[]>([]);
  const coins = useRef<(THREE.Group | null)[]>([]);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);
  const spin = useRef(0);
  const look = useRef({ x: 0.3, y: 0, z: -0.06 });
  const scrollSmooth = useRef(0);
  const t0 = useRef<number | null>(null); // intro clock: starts once the coins are on screen
  const announced = useRef(false);

  // Final orbit slots: a slightly wavy horizontal ring, faces turned outward and a little along the orbit.
  const layout = useMemo(
    () =>
      RING.map((c, i) => {
        const t = (i / RING.length) * Math.PI * 2;
        const pos = new THREE.Vector3(Math.cos(t) * RADIUS, 0.45 * Math.sin(2 * t + 0.4), Math.sin(t) * RADIUS);
        const radial = new THREE.Vector3(Math.cos(t), 0, Math.sin(t));
        const tangent = new THREE.Vector3(-Math.sin(t), 0, Math.cos(t));
        const normal = radial.clone().multiplyScalar(Math.cos(0.55)).add(tangent.multiplyScalar(Math.sin(0.55))).add(new THREE.Vector3(0, 0.12, 0)).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        // Intro: each coin swirls in from far out and below along its own spiral arm.
        const start = radial.multiplyScalar(RADIUS * 3.4).add(new THREE.Vector3(0, -6 - (i % 3), 0));
        return { ...c, pos, quat, start, angle: t, drop: -5 - (i % 3), phase: i * 0.7, delay: COIN_DELAY + i * COIN_STAGGER };
      }),
    []
  );

  const glow = useMemo(() => glowTexture("rgba(59,240,176,0.5)"), []);

  useFrame((state, dt) => {
    if (!ready) return; // coins stay hidden while their shaders compile
    // Frame 1 draws the start pose (and absorbs any leftover GPU setup); the clock starts on frame 2,
    // so a slow first frame can never skip part of the intro.
    shownFrames.current++;
    if (shownFrames.current === 2) t0.current = state.clock.elapsedTime;
    const time = motion.reduced ? 99 : t0.current === null ? 0 : state.clock.elapsedTime - t0.current; // reduced motion: end state
    if (!announced.current && time >= LANDED_AT) {
      announced.current = true;
      window.dispatchEvent(new Event("allot:coins-landed")); // hero cards + counters key off this
    }
    const target = motion.reduced ? 0 : motion.scroll.current ?? 0;
    scrollSmooth.current += (target - scrollSmooth.current) * (1 - Math.pow(0.002, Math.min(dt, 0.05)));
    const s = scrollSmooth.current;
    const p = motion.pointer.current ?? { x: 0, y: 0 };

    // Orbit: speeds up with scroll.
    spin.current += Math.min(dt, 0.05) * (motion.reduced ? 0 : 0.28 + s * 1.6);
    if (ring.current) ring.current.rotation.y = spin.current;

    // Pointer parallax (smoothed): the whole system tilts toward the cursor.
    const k = 1 - Math.pow(0.001, Math.min(dt, 0.05)); // frame-rate independent lerp
    look.current.x += (0.3 + p.y * 0.1 + s * 0.35 - look.current.x) * k;
    look.current.y += (p.x * 0.22 - look.current.y) * k;
    look.current.z += (-0.06 + p.x * 0.05 - look.current.z) * k;
    if (tilt.current) tilt.current.rotation.set(look.current.x, look.current.y, look.current.z);

    // Coins: spiral in, then sit in orbit with a gentle tumble; spread outward on scroll.
    const spread = 1 + s * 0.45;
    holders.current.forEach((h, i) => {
      const c = coins.current[i];
      if (!h || !c) return;
      const l = layout[i];
      const e = easeOutCubic(clamp01((time - l.delay) / COIN_DUR));
      // Spiral: the angle unwinds and the radius shrinks as the coin arrives.
      const ang = l.angle + (1 - e) * 2.6;
      const r = RADIUS * spread * (1 + (1 - e) * 2.2);
      h.position.set(Math.cos(ang) * r, l.pos.y * spread + (1 - e) * l.drop, Math.sin(ang) * r);
      h.scale.setScalar(0.3 + 0.7 * easeOutExpo(clamp01((time - l.delay) / COIN_DUR)));
      c.quaternion.copy(l.quat);
      c.rotateX((1 - e) * Math.PI * 4 + Math.sin(time * 0.9 + l.phase) * 0.25 * e);
    });

    // Allot coin: spins in, lands with a little overshoot, then sways.
    const ce = clamp01((time - CENTER_DELAY) / CENTER_DUR);
    if (center.current) {
      center.current.scale.setScalar(0.35 + 0.65 * easeOutBack(ce));
      center.current.rotation.set(-look.current.x, (1 - easeOutCubic(ce)) * Math.PI * 4 + Math.sin(time * 0.5) * 0.45 * ce, -look.current.z);
      center.current.position.y = Math.sin(time * 0.8) * 0.08;
    }
    // Glow pulse when the last coin locks in, then a slow breathe.
    if (glowMat.current) {
      const pulse = Math.exp(-Math.pow(time - LANDED_AT, 2) / 0.06);
      glowMat.current.opacity = Math.min(1, ce) * (0.75 + 0.15 * Math.sin(time * 1.6)) + pulse * 0.9;
    }
  });

  return (
    <group position={[0, -0.35, 0]} visible={ready}>
      <group ref={tilt}>
        <group ref={ring}>
          {layout.map((c, i) => (
            <group key={i} ref={(el) => { holders.current[i] = el; }} position={c.start}>
              <group ref={(el) => { coins.current[i] = el; }}>
                <Coin glyph={c.token} rim={c.rim} radius={0.72} />
              </group>
            </group>
          ))}
        </group>
        <group ref={center} scale={0.35}>
          <mesh position={[0, 0, -0.8]}>
            <planeGeometry args={[7, 7]} />
            <meshBasicMaterial ref={glowMat} map={glow} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          <Coin glyph="allot" palette={ALLOT} rim="mint" radius={1.55} />
        </group>
      </group>
    </group>
  );
}

export default function CoinVortexScene({ active, motion }: { active: boolean; motion: Motion }) {
  // Start at up to 1.5× resolution; drop to 1× if the device can't keep up, recover if it can.
  const [dpr, setDpr] = useState(() => Math.min(1.5, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1));
  return (
    <Canvas
      frameloop={active ? "always" : "demand"}
      dpr={dpr}
      camera={{ position: [0, 1.4, 12.5], fov: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      style={{ background: "transparent" }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(Math.min(1.5, window.devicePixelRatio || 1))} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 6, 8]} intensity={1.4} color="#ffffff" />
      <directionalLight position={[-6, -2, 4]} intensity={0.9} color="#4cc2ff" />
      <Rig motion={motion} />
      <Orbit motion={motion} />
      {/* Studio reflections, generated once locally (no HDR download) */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 5, 6]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={2.4} color="#4cc2ff" position={[-7, 0, 3]} rotation={[0, Math.PI / 2, 0]} scale={[8, 4, 1]} />
        <Lightformer form="rect" intensity={2.2} color="#3bf0b0" position={[7, -1, 3]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 4, 1]} />
        <Lightformer form="ring" intensity={1.6} color="#8b7cff" position={[0, -4, -6]} scale={6} />
      </Environment>
    </Canvas>
  );
}
