import * as THREE from 'three';
import { mulberry32 } from '../../packages/room-runtime/materials';
import { BUILDING, DOCKS, SITE } from './config';
import { Batch } from './batch';
import { palletLoad } from './loads';
import { warehouseMaterials } from './materials';
import { D, DOORS, OFFICE_RECT, T, W } from './plan';

/**
 * Outside the walls: the slab edge, pavement, the depressed truck well in front of the docks
 * with its ramp and retaining walls, trailers backed into the open doors, parking, a dumpster
 * and a few trees for scale.
 */
const PAVE = -BUILDING.slabAbovePavement;

export function wellExtent() {
  const docks = DOORS.filter((d) => d.kind === 'dock');
  const x0 = Math.min(...docks.map((d) => d.at)) - DOCKS.width / 2 - 2.2;
  const x1 = Math.max(...docks.map((d) => d.at)) + DOCKS.width / 2 + 2.2;
  const z0 = D / 2 + T, z1 = z0 + DOCKS.apron, z2 = z1 + DOCKS.ramp;
  return { x0, x1, z0, z1, z2 };
}

/** 53 ft dry van, rear at local z = 0 facing −z, floor at y = 0 (dock height). */
function trailer(b: Batch, x: number, zRear: number, rand: () => number, loaded: number) {
  const m = warehouseMaterials();
  const L = 16.15, Wd = 2.59, H = 2.79, wall = 0.03, ground = -DOCKS.dockHeight;
  const z = (t: number) => zRear + t;
  // hollow body so the open rear shows the inside
  b.box(m.pallet[0], [Wd - 0.06, 0.03, L], [x, -0.015, z(L / 2)]);
  for (const s of [-1, 1]) b.box(m.trailerSide, [wall, H, L], [x + s * (Wd / 2 - wall / 2), H / 2 - 0.03, z(L / 2)]);
  b.box(m.trailerSide, [Wd, wall, L], [x, H - 0.03, z(L / 2)]);
  b.box(m.trailerSide, [Wd, H, wall], [x, H / 2 - 0.03, z(L - wall / 2)]);
  b.box(m.laminateWhite, [Wd - 0.08, H - 0.1, 0.01], [x, H / 2, z(L - wall - 0.01)]);
  // rear frame and doors swung open against the sides
  b.box(m.darkSteel, [Wd + 0.04, 0.16, 0.12], [x, H + 0.02, z(0.06)]);
  b.box(m.darkSteel, [Wd + 0.04, 0.2, 0.12], [x, -0.12, z(0.06)]);
  for (const s of [-1, 1]) {
    b.box(m.darkSteel, [0.12, H + 0.2, 0.12], [x + s * (Wd / 2 - 0.04), H / 2 - 0.04, z(0.06)]);
    b.box(m.trailerSide, [0.04, H - 0.1, Wd / 2], [x + s * (Wd / 2 + 0.05), H / 2, z(Wd / 4 + 0.1)]);
    for (const t of [0.25, 0.5, 0.75]) b.box(m.chrome, [0.02, 0.03, Wd / 2 - 0.1], [x + s * (Wd / 2 + 0.075), H * t, z(Wd / 4 + 0.1)]);
    // lights
    b.box(m.beacon, [0.18, 0.08, 0.02], [x + s * (Wd / 2 - 0.15), -0.12, z(-0.005)]);
  }
  // underframe, bumper, tandem axles, landing gear
  for (const s of [-1, 1]) b.box(m.darkSteel, [0.12, 0.3, L - 1.5], [x + s * 0.5, -0.2, z(L / 2 + 0.6)]);
  b.box(m.darkSteel, [2.3, 0.1, 0.12], [x, ground + 0.55, z(0.05)]);
  for (const s of [-1, 1]) b.box(m.darkSteel, [0.08, -ground - 0.6, 0.08], [x + s * 0.8, (ground + 0.55 - 0.05) / 2 - 0.025, z(0.15)]);
  const r = 0.51;
  for (const az of [2.3, 3.6]) {
    b.cylinder(m.darkSteel, 0.06, Wd - 0.1, [x, ground + r, z(az)], [0, 0, Math.PI / 2], 10);
    for (const s of [-1, 1]) for (const dual of [0.55, 0.85]) {
      b.cylinder(m.rubber, r, 0.27, [x + s * dual * (Wd / 2 + 0.05), ground + r, z(az)], [0, 0, Math.PI / 2], 24);
      b.cylinder(m.chrome, r * 0.55, 0.28, [x + s * dual * (Wd / 2 + 0.05), ground + r, z(az)], [0, 0, Math.PI / 2], 16);
    }
  }
  b.box(m.darkSteel, [Wd - 0.2, 0.25, 2.2], [x, -0.42, z(2.95)]);
  for (const s of [-1, 1]) b.box(m.rubber, [0.6, 0.6, 0.01], [x + s * 0.85, ground + 0.45, z(4.3)]);
  for (const s of [-1, 1]) {
    b.box(m.darkSteel, [0.1, -ground - 0.25, 0.1], [x + s * 0.9, ground + (-ground - 0.25) / 2 + 0.03, z(L - 3.6)]);
    b.box(m.darkSteel, [0.25, 0.05, 0.25], [x + s * 0.9, ground + 0.025, z(L - 3.6)]);
  }
  b.box(m.darkSteel, [1.9, 0.06, 0.06], [x, -0.9, z(L - 3.6)]);
  // partly loaded from the nose: pallets two wide
  for (let i = 0; i < loaded; i++) {
    const row = Math.floor(i / 2), side = i % 2 ? 1 : -1;
    palletLoad(b, x + side * 0.62, 0, z(L - 0.75 - row * 1.25), Math.PI / 2, 2.4, rand, rand() < 0.5 ? 'wrapped' : 'film-cartons');
  }
}

function tree(b: Batch, x: number, z: number, s: number, rand: () => number) {
  const m = warehouseMaterials();
  b.cylinder(m.bark, 0.12 * s, 2.2 * s, [x, PAVE + 1.1 * s, z], undefined, 8, 0.09 * s);
  for (let i = 0; i < 4; i++) {
    const g = new THREE.IcosahedronGeometry((1.1 + rand() * 0.6) * s, 1);
    b.add(m.foliage, g, new THREE.Matrix4().makeTranslation(x + (rand() - 0.5) * 1.4 * s, PAVE + (2.6 + rand() * 1.4) * s, z + (rand() - 0.5) * 1.4 * s));
  }
}

export function buildSite() {
  const m = warehouseMaterials();
  const rand = mulberry32(SITE.seed + 5);
  const group = new THREE.Group();
  group.name = 'site';
  const w = wellExtent();
  const ext = { x0: -W / 2 - T - SITE.margin, x1: W / 2 + T + SITE.margin, z0: -D / 2 - T - SITE.margin, z1: w.z2 + SITE.frontMargin };

  // pavement with the truck well cut out (shape in x, −z so it faces up after rotation)
  const shape = new THREE.Shape([new THREE.Vector2(ext.x0, -ext.z0), new THREE.Vector2(ext.x0, -ext.z1), new THREE.Vector2(ext.x1, -ext.z1), new THREE.Vector2(ext.x1, -ext.z0)]);
  shape.holes.push(new THREE.Path([new THREE.Vector2(w.x0, -w.z0), new THREE.Vector2(w.x1, -w.z0), new THREE.Vector2(w.x1, -w.z2), new THREE.Vector2(w.x0, -w.z2)]));
  const pave = new THREE.ShapeGeometry(shape);
  pave.rotateX(-Math.PI / 2);
  const pavement = new THREE.Mesh(pave, m.asphalt);
  pavement.position.y = PAVE;
  pavement.receiveShadow = true;
  pavement.name = 'pavement';
  group.add(pavement);
  // grass beyond the pavement: a ring, so the sunken truck well stays open
  const g = 8;
  const lawn = new THREE.Shape([new THREE.Vector2(ext.x0 - g, -ext.z0 + g), new THREE.Vector2(ext.x0 - g, -ext.z1 - g), new THREE.Vector2(ext.x1 + g, -ext.z1 - g), new THREE.Vector2(ext.x1 + g, -ext.z0 + g)]);
  lawn.holes.push(new THREE.Path([new THREE.Vector2(ext.x0, -ext.z0), new THREE.Vector2(ext.x1, -ext.z0), new THREE.Vector2(ext.x1, -ext.z1), new THREE.Vector2(ext.x0, -ext.z1)]));
  const grass = new THREE.Mesh(new THREE.ShapeGeometry(lawn).rotateX(-Math.PI / 2), m.grass);
  grass.position.y = PAVE - 0.03;
  grass.receiveShadow = true;
  grass.name = 'grass';
  group.add(grass);

  const b = new Batch();
  // slab edge / foundation around the building; the dock face drops to the truck well
  const e = T + 0.06;
  b.box(m.concrete, [W + 2 * e, -PAVE + 0.3, 0.06], [0, (PAVE - 0.3) / 2, -D / 2 - T - 0.03]);
  for (const s of [-1, 1]) b.box(m.concrete, [0.06, -PAVE + 0.3, D + 2 * e], [s * (W / 2 + T + 0.03), (PAVE - 0.3) / 2, 0]);
  const dh = DOCKS.dockHeight;
  for (const [a, c] of [[-W / 2 - e, w.x0], [w.x1, W / 2 + e]]) b.box(m.concrete, [c - a, -PAVE + 0.3, 0.06], [(a + c) / 2, (PAVE - 0.3) / 2, D / 2 + T + 0.03]);
  b.box(m.concrete, [w.x1 - w.x0, dh + 0.1, 0.5], [(w.x0 + w.x1) / 2, -dh / 2 - 0.05, D / 2 + T - 0.25]);
  // truck well apron (concrete) and ramp (asphalt)
  b.box(m.concrete, [w.x1 - w.x0, 0.1, w.z1 - w.z0], [(w.x0 + w.x1) / 2, -dh - 0.05, (w.z0 + w.z1) / 2]);
  const rampLen = Math.hypot(w.z2 - w.z1, dh + PAVE);
  const ramp = new THREE.PlaneGeometry(w.x1 - w.x0, rampLen).rotateX(-Math.PI / 2);
  b.add(m.asphalt, ramp, new THREE.Matrix4().makeRotationX(Math.atan2(-(dh + PAVE), w.z2 - w.z1)).setPosition((w.x0 + w.x1) / 2, (-dh + PAVE) / 2, (w.z1 + w.z2) / 2));
  // trench drain at the foot of the dock face
  b.box(m.darkSteel, [w.x1 - w.x0 - 0.4, 0.02, 0.3], [(w.x0 + w.x1) / 2, -dh + 0.005, w.z0 + 3]);
  // retaining walls along both sides of the well, stepping down with the ramp, with pipe rails
  for (const [x, s] of [[w.x0, -1], [w.x1, 1]] as const) {
    const top = PAVE + 0.12;
    const outline = new THREE.Shape([
      new THREE.Vector2(w.z0, -dh - 0.1), new THREE.Vector2(w.z1, -dh - 0.1), new THREE.Vector2(w.z2, PAVE - 0.1),
      new THREE.Vector2(w.z2, top), new THREE.Vector2(w.z0, top),
    ]);
    const g = new THREE.ExtrudeGeometry(outline, { depth: 0.3, bevelEnabled: false });
    // shape x → z, shape y → up, extrusion → −x (a rotation, so the winding survives); walls sit outside the well
    g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)).setPosition(s < 0 ? x : x + 0.3, 0, 0));
    b.add(m.concrete, g);
    for (let zz = w.z0 + 0.3; zz < w.z1 + 2; zz += 2.4) {
      const px = x + s * 0.15;
      b.cylinder(m.safetyYellow, 0.025, 1.05, [px, top + 0.525, zz], undefined, 8);
    }
    for (const h of [0.55, 1.05]) b.pipe(m.safetyYellow, new THREE.Vector3(x + s * 0.15, top + h, w.z0 + 0.3), new THREE.Vector3(x + s * 0.15, top + h, w.z0 + 0.3 + 2.4 * Math.floor((w.z1 + 1.7 - w.z0) / 2.4)), 0.022);
  }
  // trailers at the open doors
  for (const d of DOORS.filter((d) => d.kind === 'dock' && d.open)) trailer(b, d.at, w.z0 + 0.32, rand, d.index! % 2 ? 10 : 4);

  // drive-in apron ramp and bollards outside it
  for (const d of DOORS.filter((d) => d.kind === 'drive-in')) {
    const sx = d.wall === 'east' ? 1 : -1, x = sx * (W / 2 + T);
    const len = 2.2;
    const g = new THREE.PlaneGeometry(len + 0.02, d.width + 1.2).rotateX(-Math.PI / 2);
    b.add(m.concrete, g, new THREE.Matrix4().makeRotationZ(-sx * Math.atan2(-PAVE, len)).setPosition(x + sx * len / 2, PAVE / 2 + 0.003, d.at));
    for (const s of [-1, 1]) {
      const bz = d.at + s * (d.width / 2 + 0.45), bx = x + sx * 0.5;
      b.cylinder(m.safetyYellow, 0.084, 1.2, [bx, PAVE + 0.6, bz], undefined, 16);
    }
  }

  // employee parking in front of the office, sidewalk to the entrance
  const sw0 = OFFICE_RECT.x0 - T - 6, sw1 = w.x0 - 1.5;
  b.box(m.concrete, [sw1 - sw0, 0.15, 2.2], [(sw0 + sw1) / 2, PAVE + 0.075, D / 2 + T + 1.1]);
  const py0 = D / 2 + T + 3.0, stall = 2.75, depth = 5.5;
  for (let x = sw0 + 0.5; x <= sw1 - 0.5; x += stall) b.box(m.paintWhite, [0.1, 0.004, depth], [x, PAVE + 0.002, py0 + depth / 2]);
  for (let x = sw0 + 0.5 + stall / 2; x < sw1 - 0.5; x += stall) b.box(m.concrete, [1.8, 0.12, 0.15], [x, PAVE + 0.06, py0 + 0.6]);
  // accessible stall marking
  b.box(m.drumBlue, [stall - 0.2, 0.004, depth - 0.2], [sw0 + 0.5 + stall * 1.5, PAVE + 0.003, py0 + depth / 2]);
  // dumpster by the east end of the truck court
  const dx = w.x1 + 2.4, dz = D / 2 + T + 3;
  b.box(m.blueMachine, [1.9, 1.3, 1.6], [dx, PAVE + 0.75, dz]);
  b.box(m.darkSteel, [1.95, 0.06, 1.65], [dx, PAVE + 1.43, dz], [0.12, 0, 0]);
  for (const s of [-1, 1]) b.cylinder(m.rubber, 0.08, 0.06, [dx + s * 0.8, PAVE + 0.08, dz + 0.6], [0, 0, Math.PI / 2], 10);
  // trees along the west and north edges of the site
  for (let z = ext.z0 + 4; z < ext.z1 - 4; z += 7 + rand() * 3) tree(b, ext.x0 - 3.5 - rand() * 2, z, 0.9 + rand() * 0.4, rand);
  for (let x = ext.x0 + 2; x < ext.x1 - 2; x += 8 + rand() * 3) tree(b, x, ext.z0 - 3.5 - rand() * 2, 0.9 + rand() * 0.4, rand);

  group.add(b.build('site-parts'));
  return { group, extent: ext };
}
