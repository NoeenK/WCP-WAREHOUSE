import * as THREE from 'three';
import { BUILDING, RACKS } from './config';
import { Batch } from './batch';
import { signMaterial, warehouseMaterials } from './materials';
import { D, EAVE, FRAME_X, OFFICE_RECT, RACK, RACK_Z, RACK_Z_END, RISER_X, W, roofY } from './plan';

/**
 * Everything hung from the roof: LED high-bay fixtures over the aisles and the dock floor,
 * two big HVLS fans on frame lines over the staging area, the ESFR sprinkler grid with its
 * cross mains, and aisle signs. All of it lives in the roof group (hidden from above) and casts
 * no shadow: the shadowed key light stands in for the fixtures.
 */
const P = BUILDING.purlinDepth;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const FANS = [FRAME_X[Math.floor(FRAME_X.length / 2)], FRAME_X[FRAME_X.length - 2]].map((x) => ({ x, z: (RACK_Z_END + D / 2) / 2 + 0.4, r: 3.65 }));

export function fixtureSpots() {
  const spots: [number, number][] = [];
  for (const a of RACK.aisles) for (let i = 0; i < 3; i++) spots.push([(a.x0 + a.x1) / 2, RACK_Z[0] + 1.6 + i * ((RACK_Z_END - RACK_Z[0] - 3.2) / 2)]);
  for (let x = -W / 2 + 4; x < W / 2 - 2; x += 6) for (const z of [RACK_Z_END + 2.4, D / 2 - 3.2]) {
    if (x < OFFICE_RECT.x1 + 1 && z > OFFICE_RECT.z0 - 1) continue;
    if (FANS.some((f) => Math.hypot(x - f.x, z - f.z) < f.r + 0.6)) continue;
    spots.push([x, z]);
  }
  return spots;
}

export function buildOverhead() {
  const m = warehouseMaterials();
  const b = new Batch();
  const hang = EAVE - 1.1;

  // LED high bays: round heat sink, lens, hook and chain to the purlin
  for (const [x, z] of fixtureSpots()) {
    const top = roofY(z) - P;
    b.cylinder(m.darkSteel, 0.008, top - hang - 0.12, [x, (top + hang + 0.12) / 2, z], undefined, 4);
    b.cylinder(m.darkSteel, 0.21, 0.08, [x, hang + 0.08, z], undefined, 24, 0.14);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      b.box(m.darkSteel, [0.012, 0.05, 0.05], [x + Math.sin(a) * 0.22, hang + 0.08, z + Math.cos(a) * 0.22], [0, a, 0]);
    }
    b.cylinder(m.grayMachine, 0.2, 0.03, [x, hang + 0.025, z], undefined, 24);
    b.cylinder(m.lens, 0.17, 0.01, [x, hang + 0.005, z], undefined, 24);
  }

  // HVLS fans: drop tube from the rafter, gearbox, hub, six blades with winglets
  for (const f of FANS) {
    const top = roofY(f.z) - P - 0.5, y = EAVE - 1.6;
    b.box(m.darkSteel, [0.35, 0.08, 0.35], [f.x, top, f.z]);
    b.cylinder(m.darkSteel, 0.05, top - y - 0.4, [f.x, (top + y + 0.4) / 2, f.z], undefined, 10);
    b.cylinder(m.safetyYellow, 0.32, 0.45, [f.x, y + 0.25, f.z], undefined, 20);
    b.cylinder(m.darkSteel, 0.42, 0.12, [f.x, y, f.z], undefined, 24);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const len = f.r - 0.4;
      const cx = f.x + Math.cos(a) * (0.4 + len / 2), cz = f.z - Math.sin(a) * (0.4 + len / 2);
      b.box(m.galv, [len, 0.025, 0.2], [cx, y - 0.01, cz], [0, a, 0]);
      b.box(m.safetyYellow, [0.03, 0.12, 0.2], [f.x + Math.cos(a) * f.r, y + 0.03, f.z - Math.sin(a) * f.r], [0, a, 0]);
    }
    // safety cables to the rafter
    for (const s of [-1, 1]) b.pipe(m.galv, v(f.x, y + 0.5, f.z), v(f.x + s * 0.8, top, f.z), 0.006, 4);
  }

  // ESFR sprinklers: cross mains at the quarter points, branch lines every 10 ft, heads every 10 ft
  const below = 0.45;
  for (const side of [-1, 1]) {
    const zm = side * (D / 4);
    b.pipe(m.red, v(-W / 2 + 0.6, roofY(zm) - below - 0.15, zm), v(W / 2 - 0.6, roofY(zm) - below - 0.15, zm), 0.075, 12);
    for (let x = -W / 2 + 1.5; x < W / 2 - 1; x += 3.05) {
      const za = side * (D / 2 - 0.9), zb = side * 0.6;
      b.pipe(m.red, v(x, roofY(za) - below, za), v(x, roofY(zb) - below, zb), 0.025, 8);
      b.pipe(m.red, v(x, roofY(zm) - below, zm), v(x, roofY(zm) - below - 0.15, zm), 0.025, 8);
      for (let z = 0.6 + 1.3; z < D / 2 - 0.9; z += 3.05) {
        const zz = side * z, y = roofY(zz) - below;
        b.cylinder(m.chrome, 0.018, 0.12, [x, y - 0.07, zz], undefined, 8);
        b.cylinder(m.chrome, 0.045, 0.01, [x, y - 0.13, zz], undefined, 10);
      }
    }
  }
  // feed from the riser on the north wall to the north cross main
  const zr = -D / 2 + 0.18, ztop = roofY(zr) - below - 0.15;
  b.pipe(m.red, v(RISER_X, 7.4, zr + 0.0), v(RISER_X, ztop, zr), 0.085, 12);
  b.pipe(m.red, v(RISER_X, ztop, zr), v(RISER_X, roofY(-D / 4) - below - 0.15, -D / 4), 0.085, 12);

  // aisle signs over the cross-aisle end of every aisle
  for (const a of RACK.aisles) {
    const x = (a.x0 + a.x1) / 2, z = RACK_Z_END + 0.4, y = RACKS.height - 0.2;
    const mat = signMaterial(`AISLE ${a.letter}`, { w: 1.2, h: 0.5, bg: '#1f4f9c', fg: '#ffffff', border: '#ffffff' });
    for (const flip of [false, true]) {
      const g = new THREE.PlaneGeometry(1.2, 0.5);
      if (flip) g.rotateY(Math.PI);
      b.add(mat, g, new THREE.Matrix4().makeTranslation(x, y, z + (flip ? -0.012 : 0.012)));
    }
    b.box(m.laminateWhite, [1.24, 0.54, 0.02], [x, y, z]);
    for (const s of [-1, 1]) b.cylinder(m.darkSteel, 0.005, roofY(z) - P - y - 0.27, [x + s * 0.5, (roofY(z) - P + y + 0.27) / 2, z], undefined, 4);
  }
  return b.build('overhead', { cast: false });
}
