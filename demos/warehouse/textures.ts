import * as THREE from 'three';
import { mulberry32 } from '../../packages/room-runtime/materials';

/**
 * Procedural canvas textures. The warehouse ships without image files: every map here is drawn
 * at build time, so there is nothing to license or download. Tileable maps wrap seamlessly;
 * repeats are set per material in meters (geometry UVs are in meters).
 */

const anisotropy = 8;

export function canvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  return c;
}

export function toTexture(source: HTMLCanvasElement, color: boolean, repeat: [number, number] = [1, 1]) {
  const t = new THREE.CanvasTexture(source);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = anisotropy;
  return t;
}

// --- noise ------------------------------------------------------------------------------

/** Tileable value noise: `cells` lattice cells across, smoothstep-interpolated. */
function valueNoise(size: number, cells: number, rand: () => number, stretch: [number, number] = [1, 1]) {
  const cx = Math.max(1, Math.round(cells * stretch[0])), cy = Math.max(1, Math.round(cells * stretch[1]));
  const lattice = Float32Array.from({ length: cx * cy }, rand);
  const out = new Float32Array(size * size);
  const s = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cy, y0 = Math.floor(fy), ty = s(fy - y0);
    const r0 = (y0 % cy) * cx, r1 = ((y0 + 1) % cy) * cx;
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cx, x0 = Math.floor(fx), tx = s(fx - x0);
      const c0 = x0 % cx, c1 = (x0 + 1) % cx;
      const a = lattice[r0 + c0] + (lattice[r0 + c1] - lattice[r0 + c0]) * tx;
      const b = lattice[r1 + c0] + (lattice[r1 + c1] - lattice[r1 + c0]) * tx;
      out[y * size + x] = a + (b - a) * ty;
    }
  }
  return out;
}

/** Fractal noise normalized to 0..1. `octaves` are [cells, weight]. */
export function fbm(size: number, seed: number, octaves: [number, number][], stretch: [number, number] = [1, 1]) {
  const rand = mulberry32(seed);
  const out = new Float32Array(size * size);
  for (const [cells, weight] of octaves) {
    const n = valueNoise(size, cells, rand, stretch);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * weight;
  }
  let lo = Infinity, hi = -Infinity;
  for (const v of out) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / (hi - lo || 1);
  return out;
}

/** Grayscale/colored canvas from a scalar field. */
export function fieldCanvas(field: Float32Array, size: number, color: (v: number, i: number) => [number, number, number]) {
  return canvas(size, size, (ctx) => {
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < field.length; i++) {
      const [r, g, b] = color(field[i], i);
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
}

/** OpenGL-convention normal map from a tileable height field (strength = slope scale). */
export function normalCanvas(height: Float32Array, w: number, h: number, strength: number) {
  return canvas(w, h, (ctx) => {
    const img = ctx.createImageData(w, h);
    const at = (x: number, y: number) => height[((y + h) % h) * w + ((x + w) % w)];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
        const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
        // canvas rows run down; texture v runs up
        const n = new THREE.Vector3(-dx, dy, 1).normalize();
        const i = (y * w + x) * 4;
        img.data[i] = (n.x * 0.5 + 0.5) * 255;
        img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
        img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

/** Normal map for a profile that varies along u only (ribs, corrugation, seams). */
export function profileNormal(profile: (t: number) => number, px: number, strength: number) {
  const h = 4;
  const field = new Float32Array(px * h);
  for (let x = 0; x < px; x++) for (let y = 0; y < h; y++) field[y * px + x] = profile(x / px);
  return normalCanvas(field, px, h, strength);
}

const gray = (v: number): [number, number, number] => { const g = Math.round(v * 255); return [g, g, g]; };

// --- surfaces ---------------------------------------------------------------------------

/** Concrete micro detail: a roughness map and a soft normal map, tileable. */
export function concreteMaps(seed = 11) {
  const size = 512;
  const h = fbm(size, seed, [[8, 0.35], [32, 0.3], [96, 0.2], [256, 0.15]]);
  const rough = fieldCanvas(h, size, (v) => gray(0.52 + (v - 0.5) * 0.35));
  return { rough, normal: normalCanvas(h, size, size, 2.2) };
}

/** Neutral light-gray detail map (tinted by material.color). */
export function neutralNoise(seed: number, octaves: [number, number][], mean = 0.86, contrast = 0.22, stretch: [number, number] = [1, 1], size = 256) {
  const h = fbm(size, seed, octaves, stretch);
  return fieldCanvas(h, size, (v) => gray(Math.min(1, Math.max(0, mean + (v - 0.5) * contrast))));
}

/** Wood grain running along u (pallet boards, crates). */
export function woodGrain(seed: number) {
  const size = 256;
  const h = fbm(size, seed, [[3, 0.4], [9, 0.3], [40, 0.2], [120, 0.1]], [0.25, 4]);
  const rand = mulberry32(seed + 1);
  const knots = Array.from({ length: 3 }, () => [rand() * size, rand() * size, 4 + rand() * 6]);
  return fieldCanvas(h, size, (v, i) => {
    const x = i % size, y = Math.floor(i / size);
    let k = 0;
    for (const [kx, ky, r] of knots) {
      const d = Math.hypot(((x - kx + size * 1.5) % size) - size / 2, ((y - ky + size * 1.5) % size) - size / 2);
      k = Math.max(k, Math.max(0, 1 - d / r));
    }
    const ring = 0.5 + 0.5 * Math.sin(v * 38);
    const g = 0.78 + ring * 0.12 - k * 0.35 + (v - 0.5) * 0.1;
    return [Math.round(g * 255), Math.round(g * 0.93 * 255), Math.round(g * 0.82 * 255)];
  });
}

/** Stretch-film wrinkles: streaks mostly around the load (along u). */
export function wrapMaps(seed: number) {
  const size = 256;
  const h = fbm(size, seed, [[2, 0.45], [5, 0.3], [12, 0.17], [40, 0.08]], [0.3, 1.6]);
  const color = fieldCanvas(h, size, (v) => {
    const g = 0.84 + (v - 0.5) * 0.18;
    return [Math.round(g * 248), Math.round(g * 252), Math.round(g * 255)];
  });
  return { color, normal: normalCanvas(h, size, size, 2.5) };
}

/** Metal panel rib profiles, one period per texture width (t = 0..1). */
export const PROFILES = {
  /** "R-panel": a trapezoidal major rib and two small stiffening ribs per 12" */
  rPanel: (t: number) => {
    const rib = (c: number, half: number, top: number) => {
      const d = Math.abs(t - c);
      return d < top ? 1 : d < half ? 1 - (d - top) / (half - top) : 0;
    };
    return rib(0.5, 0.14, 0.05) + 0.12 * rib(0.2, 0.04, 0.015) + 0.12 * rib(0.8, 0.04, 0.015);
  },
  /** standing seam: a tall narrow seam, flat pan with slight stiffening lines */
  standingSeam: (t: number) => {
    const d = Math.abs(t - 0.5);
    return (d < 0.02 ? 1 : d < 0.035 ? 1 - (d - 0.02) / 0.015 : 0) + 0.05 * Math.cos(t * Math.PI * 6);
  },
  /** liner panel: shallow ribs */
  liner: (t: number) => 0.5 + 0.5 * Math.cos(t * Math.PI * 2) ** 9,
  /** sectional door: two embossed horizontal grooves per section */
  doorGroove: (t: number) => {
    const g = (c: number) => Math.max(0, 1 - Math.abs(t - c) / 0.03);
    return -(g(0.33) + g(0.66)) + (t < 0.015 || t > 0.985 ? -1 : 0);
  },
  /** trailer side: aluminum posts */
  trailerPost: (t: number) => (Math.abs(t - 0.5) < 0.08 ? 1 : Math.abs(t - 0.5) < 0.1 ? 0.5 : 0),
};

/** Vertical strip (color by height in meters, 0..12 m): wainscot, liner bands. */
export function heightStrip(bands: { to: number; color: string }[], meters = 12, grime?: { to: number; color: string }) {
  const px = 512;
  return canvas(4, px, (ctx) => {
    let from = 0;
    for (const b of bands) {
      ctx.fillStyle = b.color;
      // canvas row 0 is the top (v = 1)
      ctx.fillRect(0, px - (b.to / meters) * px, 4, ((b.to - from) / meters) * px + 1);
      from = b.to;
    }
    if (grime) {
      const g = ctx.createLinearGradient(0, px, 0, px - (grime.to / meters) * px);
      g.addColorStop(0, grime.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, px - (grime.to / meters) * px, 4, (grime.to / meters) * px);
    }
  });
}

/** Upright face: powder-coated steel with a column of teardrop slots, one slot per tile. */
export function uprightSlots(color: string) {
  return canvas(64, 64, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0d1420';
    ctx.beginPath();
    ctx.moveTo(w * 0.42, h * 0.22);
    ctx.lineTo(w * 0.58, h * 0.22);
    ctx.lineTo(w * 0.58, h * 0.55);
    ctx.arc(w * 0.5, h * 0.55, w * 0.08, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
  });
}

/** Wire mesh deck: galvanized wires on a transparent background (alpha-tested). */
export function wireMesh() {
  return canvas(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#c9ced2';
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (const x of [w * 0.25, w * 0.75]) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.stroke();
  });
}

/** Yellow/black diagonal hazard stripes, one stripe pair per tile. */
export function hazardStripes() {
  return canvas(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f2c018';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1a1a1a';
    for (const o of [-w, 0, w]) {
      ctx.beginPath();
      ctx.moveTo(o, h);
      ctx.lineTo(o + w / 2, 0);
      ctx.lineTo(o + w, 0);
      ctx.lineTo(o + w / 2, h);
      ctx.closePath();
      ctx.fill();
    }
  });
}

/** Lay-in ceiling: 2×4 ft tiles with a white T-bar grid (texture covers 4×4 ft). */
export function ceilingGrid() {
  const rough = fbm(256, 5, [[64, 0.5], [128, 0.5]]);
  return canvas(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < rough.length; i++) {
      const g = 228 + (rough[i] - 0.5) * 30;
      img.data.set([g, g, g - 4, 255], i * 4);
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#f4f4f2';
    ctx.fillRect(0, 0, w, 4); ctx.fillRect(0, h / 2 - 2, w, 4);
    ctx.fillRect(0, 0, 4, h);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, 4, w, 1); ctx.fillRect(0, h / 2 + 2, w, 1); ctx.fillRect(4, 0, 1, h);
  });
}

/** Carpet tile: dark heathered loop pile with tile seams (texture covers 2×2 ft). */
export function carpetTile() {
  const n = fbm(256, 21, [[16, 0.2], [64, 0.3], [256, 0.5]]);
  return fieldCanvas(n, 256, (v, i) => {
    const x = i % 256, y = Math.floor(i / 256);
    const seam = x < 2 || y < 2 ? 0.75 : 1;
    const g = (0.36 + (v - 0.5) * 0.18) * seam;
    return [Math.round(g * 150), Math.round(g * 160), Math.round(g * 178)];
  });
}

/** Asphalt: dark binder with light aggregate speckle (neutral, tinted by color). */
export function asphalt(seed = 31) {
  const size = 512;
  const n = fbm(size, seed, [[6, 0.25], [48, 0.25], [256, 0.5]]);
  const rand = mulberry32(seed);
  return fieldCanvas(n, size, (v) => {
    const speck = rand() < 0.06 ? 0.25 * rand() : 0;
    const g = 0.6 + (v - 0.5) * 0.3 + speck;
    return gray(Math.min(1, g));
  });
}

// --- graphics ---------------------------------------------------------------------------

/** Text panel (signs, door numbers, labels). Returns a canvas sized to the panel aspect. */
export function sign(text: string, opts: { w: number; h: number; bg: string; fg: string; font?: string; border?: string; px?: number }) {
  const px = opts.px ?? 256;
  const cw = Math.round(px * Math.max(1, opts.w / opts.h)), ch = Math.round(px * Math.max(1, opts.h / opts.w));
  return canvas(cw, ch, (ctx, w, h) => {
    ctx.fillStyle = opts.bg;
    ctx.fillRect(0, 0, w, h);
    if (opts.border) {
      ctx.strokeStyle = opts.border;
      ctx.lineWidth = Math.min(w, h) * 0.06;
      ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);
    }
    ctx.fillStyle = opts.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = text.split('\n');
    let size = h * (lines.length > 1 ? 0.36 : 0.62);
    ctx.font = `${opts.font ?? '800'} ${size}px "Helvetica Neue", Arial, sans-serif`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest > w * 0.86) {
      size *= (w * 0.86) / widest;
      ctx.font = `${opts.font ?? '800'} ${size}px "Helvetica Neue", Arial, sans-serif`;
    }
    lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.1));
  });
}

/** Carton tops seen through stretch film: a grid of flaps and tape, tinted by color. */
export function cartonTops(cols: number, rows: number) {
  return canvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#dcdcdc';
    ctx.fillRect(0, 0, w, h);
    const cw = w / cols, rh = h / rows;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      ctx.fillStyle = '#e4e4e4';
      ctx.fillRect(c * cw + 2, r * rh + 2, cw - 4, rh - 4);
      ctx.fillStyle = 'rgba(80,60,30,0.35)';
      ctx.fillRect(c * cw + cw * 0.44, r * rh + 2, cw * 0.12, rh - 4); // tape
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(c * cw + 2, r * rh + rh / 2, cw - 4, 1); // flap seam
    }
  });
}
