import * as THREE from 'three';
import { mulberry32 } from '../../packages/room-runtime/materials';
import type { RoomLayout } from '../../packages/room-runtime/types';
import { RACKS } from './config';
import { Batch } from './batch';
import { palletLoad } from './loads';
import { warehouseMaterials } from './materials';
import { RACK, RACK_Z, RACK_Z_END, slotCenters, type RackLine } from './plan';

/**
 * Selective pallet racking: teardrop uprights with welded bracing, step beams, wire decks,
 * end-of-row guards, and a seeded mix of pallet loads in every position.
 */
const UP_X = 2.75 * 0.0254; // upright depth (across the frame)
const UP_Z = RACKS.upright; // upright face (along the beams)

function frames(b: Batch, l: RackLine) {
  const m = warehouseMaterials();
  const H = RACKS.height;
  const xa = l.x0 + UP_X / 2, xb = l.x1 - UP_X / 2;
  for (const z of RACK_Z) {
    for (const x of [xa, xb]) {
      b.box(m.upright, [UP_X, H, UP_Z], [x, H / 2, z]);
      b.box(m.brace, [0.14, 0.008, 0.14], [x, 0.004, z]);
    }
    // horizontal + diagonal bracing in the frame plane
    const ya = 0.15, yb = H - 0.12;
    const p = (x: number, y: number) => new THREE.Vector3(x, y, z);
    const i0 = xa + UP_X / 2, i1 = xb - UP_X / 2;
    b.strut(m.brace, p(i0, ya), p(i1, ya), 0.035, 0.03);
    b.strut(m.brace, p(i0, yb), p(i1, yb), 0.035, 0.03);
    const steps = Math.max(2, Math.round((yb - ya) / 1.25));
    for (let s = 0; s < steps; s++) {
      const y0 = ya + ((yb - ya) * s) / steps, y1 = ya + ((yb - ya) * (s + 1)) / steps;
      const [from, to] = s % 2 ? [i1, i0] : [i0, i1];
      b.strut(m.brace, p(from, y0), p(to, y1), 0.035, 0.03);
    }
  }
}

function beamsAndDecks(b: Batch, l: RackLine) {
  const m = warehouseMaterials();
  const bh = RACKS.beamHeight;
  const xa = l.x0 + UP_X / 2, xb = l.x1 - UP_X / 2;
  const depth = l.x1 - l.x0;
  for (let k = 0; k < RACK_Z.length - 1; k++) {
    const z0 = RACK_Z[k] + UP_Z / 2, z1 = RACK_Z[k + 1] - UP_Z / 2, zc = (z0 + z1) / 2, len = z1 - z0;
    for (const y of RACKS.levels) {
      for (const x of [xa, xb]) {
        b.box(m.beam, [0.05, bh, len], [x, y - bh / 2, zc]);
        // beam end connectors
        for (const ze of [z0 + 0.03, z1 - 0.03]) b.box(m.darkSteel, [0.058, 0.17, 0.05], [x, y - bh / 2 - 0.02, ze]);
      }
      // wire deck: mesh panel on three channels, waterfalling over both beams
      const deck = new THREE.PlaneGeometry(depth - 0.03, len - 0.03);
      deck.rotateX(-Math.PI / 2);
      b.add(m.wireDeck, deck, new THREE.Matrix4().makeTranslation((l.x0 + l.x1) / 2, y + 0.004, zc));
      for (const t of [0.17, 0.5, 0.83]) b.box(m.galv, [depth - 0.05, 0.035, 0.03], [(l.x0 + l.x1) / 2, y - 0.014, z0 + len * t]);
    }
  }
}

function guards(b: Batch, l: RackLine) {
  const m = warehouseMaterials();
  const z = RACK_Z_END;
  const xa = l.x0 + UP_X / 2, xb = l.x1 - UP_X / 2;
  // end-of-row guard rail in front of the last frame
  b.box(m.safetyYellow, [l.x1 - l.x0 + 0.15, 0.13, 0.1], [(l.x0 + l.x1) / 2, 0.3, z + 0.17]);
  for (const x of [l.x0 - 0.02, l.x1 + 0.02]) {
    b.box(m.safetyYellow, [0.1, 0.45, 0.1], [x, 0.225, z + 0.17]);
    b.box(m.darkSteel, [0.2, 0.01, 0.2], [x, 0.005, z + 0.17]);
  }
  // column protectors on the aisle-side uprights at both ends of the row
  for (const zz of [RACK_Z[0], RACK_Z[RACK_Z.length - 1]]) for (const face of l.faces) {
    const x = face < 0 ? xa : xb;
    b.box(m.safetyYellow, [UP_X + 0.03, 0.6, UP_Z + 0.03], [x + face * 0.012, 0.3, zz]);
  }
}

export function buildRacking() {
  const steel = new Batch(), loads = new Batch();
  const layout: RoomLayout['objects'] = [];
  const rand = mulberry32(RACKS.seed);
  for (const l of RACK.lines) {
    frames(steel, l);
    beamsAndDecks(steel, l);
    guards(steel, l);
    const xc = (l.x0 + l.x1) / 2;
    const levels = [0, ...RACKS.levels];
    for (let k = 0; k < RACK_Z.length - 1; k++) for (let li = 0; li < levels.length; li++) {
      const base = levels[li] + (li ? 0.006 : 0);
      const ceiling = li + 1 < levels.length ? levels[li + 1] - RACKS.beamHeight : RACKS.height + 0.25;
      for (const zc of slotCenters(k)) {
        if (rand() > RACKS.fill) continue;
        palletLoad(loads, xc, base, zc + (rand() - 0.5) * 0.04, (rand() - 0.5) * 0.03, ceiling - base - 0.1, rand);
      }
    }
    const label = RACK.lines.filter((o) => o.row === l.row).length > 1 ? `${l.row + 1}${l.faces[0] < 0 ? 'A' : 'B'}` : `${l.row + 1}`;
    layout.push({ category: `pallet rack ${label}`, center: [xc, RACKS.height / 2, (RACK_Z[0] + RACK_Z_END) / 2], size: [l.x1 - l.x0, RACKS.height, RACK_Z_END - RACK_Z[0] + UP_Z], rotY: 0 });
  }
  const group = new THREE.Group();
  group.name = 'racking';
  group.add(steel.build('rack-steel'), loads.build('rack-loads'));
  return { group, layout };
}
