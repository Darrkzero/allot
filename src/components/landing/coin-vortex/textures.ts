import * as THREE from "three";
import { TOKEN_LOGOS, type LogoToken } from "@/lib/logos/tokens";

// Coin textures generated in the browser: a color map + a bump map per face, and a knurled edge.
// Token coins use the real token logos (single-color SVG), tinted metallic and embossed.

export type Glyph = "allot" | LogoToken | "eth" | "btc" | "usdc" | "usdt" | "sol" | "near" | "zec" | "bnb" | "trx" | "ton";

const S = 512;

function canvas() {
  const c = document.createElement("canvas");
  c.width = c.height = S;
  return [c, c.getContext("2d")!] as const;
}

/** Draws the glyph using the context's current fill/stroke styles, centered. */
function drawGlyph(ctx: CanvasRenderingContext2D, g: Glyph) {
  const cx = S / 2;
  const cy = S / 2;
  const u = S * 0.1;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const poly = (pts: [number, number][], fill = true) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * u, y * u) : ctx.moveTo(x * u, y * u)));
    ctx.closePath();
    if (fill) ctx.fill();
    else ctx.stroke();
  };
  const text = (t: string, size: number, dy = 0) => {
    ctx.font = `800 ${size * u}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t, 0, dy * u);
  };
  switch (g) {
    case "allot": {
      ctx.lineWidth = 0.42 * u;
      ctx.beginPath();
      ctx.moveTo(0, -1.9 * u);
      ctx.lineTo(0, -0.35 * u);
      ctx.moveTo(0, -0.35 * u);
      ctx.bezierCurveTo(0, 0.45 * u, -1.35 * u, 0.4 * u, -1.35 * u, 1.15 * u);
      ctx.moveTo(0, -0.35 * u);
      ctx.lineTo(0, 1.15 * u);
      ctx.moveTo(0, -0.35 * u);
      ctx.bezierCurveTo(0, 0.45 * u, 1.35 * u, 0.4 * u, 1.35 * u, 1.15 * u);
      ctx.stroke();
      for (const x of [-1.35, 0, 1.35]) {
        ctx.beginPath();
        ctx.arc(x * u, 1.75 * u, 0.36 * u, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "eth":
      poly([[0, -2.1], [1.3, 0.05], [0, 0.75], [-1.3, 0.05]]);
      poly([[0, 1.05], [1.3, 0.35], [0, 2.1], [-1.3, 0.35]]);
      break;
    case "btc":
      ctx.save();
      ctx.rotate(0.24);
      text("B", 3.4, 0.15);
      ctx.lineWidth = 0.3 * u;
      for (const x of [-0.35, 0.35]) {
        ctx.beginPath();
        ctx.moveTo(x * u, -1.95 * u);
        ctx.lineTo(x * u, -1.35 * u);
        ctx.moveTo(x * u, 1.6 * u);
        ctx.lineTo(x * u, 2.15 * u);
        ctx.stroke();
      }
      ctx.restore();
      break;
    case "usdc":
      text("$", 3.0, 0.1);
      ctx.lineWidth = 0.3 * u;
      ctx.beginPath();
      ctx.arc(0, 0, 2.1 * u, Math.PI * 0.62, Math.PI * 1.38);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 2.1 * u, -Math.PI * 0.38, Math.PI * 0.38);
      ctx.stroke();
      break;
    case "usdt":
      text("T", 3.2, 0.25);
      ctx.lineWidth = 0.28 * u;
      ctx.beginPath();
      ctx.ellipse(0, -0.25 * u, 1.65 * u, 0.5 * u, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "sol":
      for (const y of [-1.2, 0, 1.2]) {
        const s = y === 0 ? -1 : 1;
        poly([[-1.6 + 0.4 * s, y - 0.38], [1.6 + 0.4 * s, y - 0.38], [1.6 - 0.4 * s, y + 0.38], [-1.6 - 0.4 * s, y + 0.38]]);
      }
      break;
    case "near":
      ctx.lineWidth = 0.42 * u;
      ctx.beginPath();
      ctx.moveTo(-1.2 * u, 1.6 * u);
      ctx.lineTo(-1.2 * u, -1.6 * u);
      ctx.lineTo(1.2 * u, 1.6 * u);
      ctx.lineTo(1.2 * u, -1.6 * u);
      ctx.stroke();
      break;
    case "zec":
      text("Z", 3.2, 0.12);
      ctx.lineWidth = 0.32 * u;
      ctx.beginPath();
      ctx.moveTo(0, -2.05 * u);
      ctx.lineTo(0, -1.45 * u);
      ctx.moveTo(0, 1.6 * u);
      ctx.lineTo(0, 2.15 * u);
      ctx.stroke();
      break;
    case "bnb": {
      const d = (x: number, y: number, r: number) => poly([[x, y - r], [x + r, y], [x, y + r], [x - r, y]]);
      d(0, 0, 0.62);
      d(0, -1.35, 0.42);
      d(0, 1.35, 0.42);
      d(-1.35, 0, 0.42);
      d(1.35, 0, 0.42);
      break;
    }
    case "trx":
      ctx.lineWidth = 0.3 * u;
      poly([[-1.6, -1.3], [1.7, -0.7], [-0.1, 1.9]], false);
      ctx.beginPath();
      ctx.moveTo(-1.6 * u, -1.3 * u);
      ctx.lineTo(0.55 * u, -0.25 * u);
      ctx.lineTo(-0.1 * u, 1.9 * u);
      ctx.moveTo(0.55 * u, -0.25 * u);
      ctx.lineTo(1.7 * u, -0.7 * u);
      ctx.stroke();
      break;
    case "ton":
      ctx.lineWidth = 0.32 * u;
      poly([[-1.5, -1.3], [1.5, -1.3], [0, 1.8]], false);
      ctx.beginPath();
      ctx.moveTo(0, -1.3 * u);
      ctx.lineTo(0, 1.8 * u);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

export type FacePalette = { light: string; dark: string; ring: string; glyph: string[] };

export const NAVY: FacePalette = { light: "#1f3a7a", dark: "#050a1a", ring: "#7f9be0", glyph: ["#e9f0ff", "#8fa8e6"] };
export const ALLOT: FacePalette = { light: "#0b1f1d", dark: "#020506", ring: "#3bf0b0", glyph: ["#3bf0b0", "#4cc2ff", "#8b7cff"] };

const faceCache = new Map<string, { map: THREE.CanvasTexture; bump: THREE.CanvasTexture }>();

/** Cached per glyph + palette, so repeated coins share one texture upload. */
export function makeFace(g: Glyph, p: FacePalette) {
  const key = `${g}:${p.light}`;
  const hit = faceCache.get(key);
  if (hit) return hit;
  const made = buildFace(g, p);
  faceCache.set(key, made);
  return made;
}

function buildFace(g: Glyph, p: FacePalette) {
  // Color map
  const [c, ctx] = canvas();
  const bg = ctx.createRadialGradient(S * 0.32, S * 0.28, S * 0.04, S / 2, S / 2, S * 0.72);
  bg.addColorStop(0, p.light);
  bg.addColorStop(1, p.dark);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = p.ring;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = S * 0.012;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const grad = ctx.createLinearGradient(S * 0.25, S * 0.2, S * 0.75, S * 0.8);
  p.glyph.forEach((col, i) => grad.addColorStop(i / Math.max(1, p.glyph.length - 1), col));

  // Bump map: raised ring (+ glyph)
  const [b, bctx] = canvas();
  bctx.fillStyle = "#000";
  bctx.fillRect(0, 0, S, S);
  bctx.strokeStyle = "#fff";
  bctx.fillStyle = "#fff";
  bctx.lineWidth = S * 0.014;
  bctx.beginPath();
  bctx.arc(S / 2, S / 2, S * 0.42, 0, Math.PI * 2);
  bctx.stroke();

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const bump = new THREE.CanvasTexture(b);

  if (g in TOKEN_LOGOS) {
    // Real logo: rasterize the mono SVG large, tint it metallic for the color map, use it white for the bump map.
    const svg = TOKEN_LOGOS[g as LogoToken].mono.replace('width="24" height="24"', `width="${S}" height="${S}"`);
    const img = new Image();
    img.onload = () => {
      const size = S * 0.5;
      const at = (S - size) / 2;
      const [t, tctx] = canvas();
      tctx.drawImage(img, at, at, size, size);
      tctx.globalCompositeOperation = "source-in";
      tctx.fillStyle = grad;
      tctx.fillRect(0, 0, S, S);
      ctx.drawImage(t, 0, 0);
      map.needsUpdate = true;
      bctx.drawImage(img, at, at, size, size);
      bctx.filter = "blur(1.5px)";
      bctx.drawImage(b, 0, 0);
      bump.needsUpdate = true;
    };
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } else {
    ctx.fillStyle = grad;
    ctx.strokeStyle = grad;
    drawGlyph(ctx, g);
    bctx.fillStyle = "#fff";
    bctx.strokeStyle = "#fff";
    drawGlyph(bctx, g);
    bctx.filter = "blur(2px)";
    bctx.drawImage(b, 0, 0);
  }
  return { map, bump };
}

let edge: THREE.CanvasTexture | null = null;
/** Knurled coin edge (reused by every coin). */
export function edgeTexture() {
  if (edge) return edge;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 16;
  const ctx = c.getContext("2d")!;
  for (let x = 0; x < 512; x += 8) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, 0, 4, 16);
    ctx.fillStyle = "#000";
    ctx.fillRect(x + 4, 0, 4, 16);
  }
  edge = new THREE.CanvasTexture(c);
  edge.wrapS = THREE.RepeatWrapping;
  edge.repeat.set(4, 1);
  return edge;
}

let white: THREE.DataTexture | null = null;
/** 1×1 white texture: a no-op map that lets the coin edges share the face shader program. */
export function whiteTexture() {
  if (white) return white;
  white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.colorSpace = THREE.SRGBColorSpace;
  white.needsUpdate = true;
  return white;
}

/** Soft radial glow sprite. */
export function glowTexture(color: string) {
  const [c, ctx] = canvas();
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
