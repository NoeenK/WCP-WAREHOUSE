import * as THREE from 'three';
import { PALLET } from './config';
import type { Batch } from './batch';
import { warehouseMaterials } from './materials';

/**
 * Pallets and what sits on them. Every load is drawn into a Batch in a pallet-local frame:
 * x along the pallet's 48" depth, z along its 40" width, y up from the floor or beam.
 * Loads are seeded so the warehouse looks the same on every build.
 */
export type LoadKind = 'cartons' | 'wrapped' | 'film-cartons' | 'totes' | 'drums' | 'crate' | 'sacks' | 'empty';

const KINDS: [LoadKind, number][] = [
  ['cartons', 0.3], ['wrapped', 0.17], ['film-cartons', 0.2], ['totes', 0.08], ['drums', 0.06], ['crate', 0.08], ['sacks', 0.07], ['empty', 0.04],
];
export function pickLoad(rand: () => number): LoadKind {
  let r = rand();
  for (const [k, w] of KINDS) { if ((r -= w) < 0) return k; }
  return 'cartons';
}

const CARTONS: [number, number, number][] = [[0.4, 0.3, 0.3], [0.5, 0.4, 0.3], [0.6, 0.4, 0.4], [0.3, 0.3, 0.25], [0.6, 0.5, 0.35], [0.45, 0.33, 0.45]];

/** Filled sack: a low-poly box whose faces bulge and whose edges pinch in (≈40 vertices). */
function sack(w: number, h: number, d: number) {
  const g = new THREE.BoxGeometry(w, h, d, 2, 1, 2);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2), y = pos.getY(i) / (h / 2), z = pos.getZ(i) / (d / 2);
    const middle = (1 - Math.abs(x)) * (1 - Math.abs(z));
    pos.setY(i, pos.getY(i) * (0.6 + 0.55 * middle));
    pos.setX(i, pos.getX(i) * (1 - 0.08 * Math.abs(y)));
    pos.setZ(i, pos.getZ(i) * (1 - 0.1 * Math.abs(y)));
  }
  g.computeVertexNormals();
  return g;
}

/** GMA stringer pallet, 48" × 40" × 5.5". Returns the deck height. */
export function pallet(b: Batch, x: number, y: number, z: number, rotY: number, rand: () => number) {
  const m = warehouseMaterials();
  const f = b.frame(x, y, z, rotY);
  const wood = m.pallet[Math.floor(rand() * m.pallet.length)];
  const L = PALLET.depth, Wd = PALLET.width, H = PALLET.height;
  const board = 0.016, stringer = H - 2 * board;
  for (const s of [-1, 0, 1]) f.box(wood, [L, stringer, 0.038], [0, board + stringer / 2, s * (Wd / 2 - 0.019)]);
  const tops = 7;
  for (let i = 0; i < tops; i++) {
    const w = i === 0 || i === tops - 1 ? 0.14 : 0.09;
    const xc = -L / 2 + 0.07 + ((L - 0.14) * i) / (tops - 1);
    f.box(wood, [w, board, Wd], [xc, H - board / 2, 0]);
  }
  for (const xc of [-L / 2 + 0.07, 0, L / 2 - 0.07]) f.box(wood, [0.14, board, Wd], [xc, board / 2, 0]);
  return H;
}

/**
 * Pallet + load. maxH is the vertical room above the pallet base (beam clearance).
 * Returns the overall height.
 */
export function palletLoad(b: Batch, x: number, y: number, z: number, rotY: number, maxH: number, rand: () => number, kind = pickLoad(rand)) {
  const deck = pallet(b, x, y, z, rotY, rand);
  const room = Math.max(0.2, Math.min(1.45, maxH - deck));
  const h = load(b, kind, x, y + deck, z, rotY, room, rand);
  return deck + h;
}

/** Load on a pallet deck at (x, y, z). Returns its height. */
export function load(b: Batch, kind: LoadKind, x: number, y: number, z: number, rotY: number, room: number, rand: () => number): number {
  const m = warehouseMaterials();
  const f = b.frame(x, y, z, rotY);
  const L = PALLET.depth, Wd = PALLET.width;
  const jitter = (s: number) => (rand() - 0.5) * s;
  switch (kind) {
    case 'empty': return 0;
    case 'cartons': case 'film-cartons': {
      const [cx, cy, cz] = CARTONS[Math.floor(rand() * CARTONS.length)];
      const nx = Math.max(1, Math.floor(L / cx)), nz = Math.max(1, Math.floor(Wd / cz));
      const layers = Math.max(1, Math.min(Math.floor(room / cy), 2 + Math.floor(rand() * 4)));
      const tint = rand() < 0.12 ? m.cardboard[4] : m.cardboard[Math.floor(rand() * 4)];
      const x0 = (-nx * cx) / 2 + cx / 2, z0 = (-nz * cz) / 2 + cz / 2;
      const partial = rand() < 0.4;
      for (let l = 0; l < layers; l++) for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
        const top = l === layers - 1;
        if (top && partial && rand() < 0.35) continue;
        const c: [number, number, number] = [x0 + i * cx + jitter(0.012), l * cy + cy / 2, z0 + k * cz + jitter(0.012)];
        f.box(tint, [cx - 0.006, cy - 0.003, cz - 0.006], c, [0, jitter(0.03), 0]);
        if (top) f.box(m.tape, [cx - 0.004, 0.002, 0.048], [c[0], c[1] + cy / 2, c[2]]);
      }
      if (kind === 'film-cartons') {
        // stretch film over the stack: a glossy skin just outside it, open at the top
        const hh = layers * cy - 0.04;
        const sx = nx * cx + 0.012, sz = nz * cz + 0.012;
        f.box(m.wrap, [sx, hh, 0.003], [0, hh / 2, sz / 2]);
        f.box(m.wrap, [sx, hh, 0.003], [0, hh / 2, -sz / 2]);
        f.box(m.wrap, [0.003, hh, sz], [sx / 2, hh / 2, 0]);
        f.box(m.wrap, [0.003, hh, sz], [-sx / 2, hh / 2, 0]);
      }
      return layers * cy;
    }
    case 'wrapped': {
      const h = Math.min(room, 0.7 + rand() * 0.6);
      f.box(m.wrap, [L - 0.02, h, Wd + 0.01], [0, h / 2, 0]);
      f.box(m.cartonTop, [L - 0.05, 0.004, Wd - 0.02], [0, h + 0.002, 0]);
      return h;
    }
    case 'totes': {
      const th = 0.31, layers = Math.max(1, Math.min(Math.floor(room / th), 3 + Math.floor(rand() * 2)));
      const mat = rand() < 0.5 ? m.toteGray : m.toteBlue;
      for (let l = 0; l < layers; l++) for (const i of [-1, 1]) for (const k of [-1, 1]) {
        const c: [number, number, number] = [i * 0.3, l * th + th / 2, k * 0.205];
        f.box(mat, [0.58, th - 0.03, 0.38], c);
        f.box(mat, [0.6, 0.03, 0.4], [c[0], c[1] + th / 2 - 0.015, c[2]]);
      }
      return layers * th;
    }
    case 'drums': {
      const h = 0.88;
      if (room < h) return load(b, 'wrapped', x, y, z, rotY, room, rand);
      const mat = rand() < 0.7 ? m.drumBlue : m.darkSteel;
      for (const i of [-1, 1]) for (const k of [-1, 1]) {
        const c: [number, number, number] = [i * 0.3, h / 2, k * 0.25];
        f.geo(mat, new THREE.CylinderGeometry(0.285, 0.285, h, 20), c);
        for (const ry of [0.3, 0.6]) f.geo(mat, new THREE.TorusGeometry(0.287, 0.012, 4, 20), [c[0], ry, c[2]], [Math.PI / 2, 0, 0]);
        f.geo(m.chrome, new THREE.CylinderGeometry(0.03, 0.03, 0.015, 8), [c[0] + 0.15, h + 0.007, c[2]]);
      }
      return h;
    }
    case 'crate': {
      const h = Math.min(room, 0.6 + rand() * 0.6);
      const cx = L - 0.08, cz = Wd - 0.06;
      f.box(m.crate, [cx, h, cz], [0, h / 2, 0]);
      const bt = 0.025, bw = 0.07;
      for (const s of [-1, 1]) {
        f.box(m.pallet[2], [cx + bt, bw, bt], [0, bw / 2, s * (cz / 2 + bt / 2)]);
        f.box(m.pallet[2], [cx + bt, bw, bt], [0, h - bw / 2, s * (cz / 2 + bt / 2)]);
        f.box(m.pallet[2], [bt, bw, cz + bt], [s * (cx / 2 + bt / 2), bw / 2, 0]);
        f.box(m.pallet[2], [bt, bw, cz + bt], [s * (cx / 2 + bt / 2), h - bw / 2, 0]);
        for (const t of [-1, 1]) {
          f.box(m.pallet[2], [bw, h, bt], [t * (cx / 2 - bw / 2), h / 2, s * (cz / 2 + bt / 2)]);
          f.box(m.pallet[2], [bt, h, bw], [s * (cx / 2 + bt / 2), h / 2, t * (cz / 2 - bw / 2)]);
        }
      }
      return h;
    }
    case 'sacks': {
      const sh = 0.13, layers = Math.max(1, Math.min(Math.floor(room / sh), 5 + Math.floor(rand() * 4)));
      // 2 × 2 sacks per layer, each layer a little askew like a hand-stacked load
      for (let l = 0; l < layers; l++) {
        const y = l * sh + sh / 2;
        for (const i of [-1, 1]) for (const k of [-1, 1]) {
          f.geo(m.sack, sack(0.58, sh, 0.47), [i * 0.3 + jitter(0.03), y, k * 0.245 + jitter(0.03)], [0, jitter(0.08), 0]);
        }
      }
      return layers * sh;
    }
  }
}
