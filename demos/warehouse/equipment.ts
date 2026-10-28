import * as THREE from 'three';
import { mulberry32 } from '../../packages/room-runtime/materials';
import type { PhysicsTag } from '../../packages/room-physics/tagging';
import type { RoomLayout } from '../../packages/room-runtime/types';
import { DOCKS, SITE } from './config';
import { Batch, type LocalFrame } from './batch';
import { load, palletLoad } from './loads';
import { signMaterial, warehouseMaterials } from './materials';
import type { FloorMark } from './floor';
import { D, DOORS, FRAME_X, OFFICE_RECT, RACK, RACK_Z, RACK_Z_END, RISER_X, SERVICE_X, STAGING, W, addObstacle, uOf } from './plan';
import type { Shell } from './shell';

/**
 * Material handling and operations: forklifts, pallet jacks, packing benches, a stretch wrapper,
 * a vertical baler, a rolling ladder, chargers, staged pallets in the dock lanes, plus safety
 * and building services on the walls. Separable things are their own named objects with
 * physics tags (playground, knolling); everything else is batched.
 */
const v3 = (x: number, y: number, z: number): [number, number, number] => [x, y, z];

function item(name: string, b: Batch, x: number, z: number, rotY: number, physics: PhysicsTag, y = 0) {
  const g = b.build(name);
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  g.userData.physics = physics;
  g.userData.knolling = 'upright';
  return g;
}

// --- vehicles ---------------------------------------------------------------------------

/** Sit-down counterbalance forklift, forks toward local +z, optionally carrying a load. */
export function forklift(lift = 0.15, carrying = false, rand = mulberry32(1), propane = true) {
  const m = warehouseMaterials();
  const b = new Batch();
  const f = b.frame(0, 0, 0);
  const wheel = (x: number, z: number, r: number, w: number) => {
    f.cylinder(m.rubber, r, w, v3(x, r, z), [0, 0, Math.PI / 2], 24);
    f.cylinder(m.grayMachine, r * 0.55, w + 0.01, v3(x, r, z), [0, 0, Math.PI / 2], 16);
  };
  for (const s of [-1, 1]) { wheel(s * 0.43, 0.55, 0.32, 0.24); wheel(s * 0.38, -0.85, 0.26, 0.2); }
  // chassis, fenders, counterweight, hood, step
  f.box(m.forklift, [1.04, 0.42, 1.9], v3(0, 0.42, -0.2));
  for (const s of [-1, 1]) f.box(m.forklift, [0.27, 0.06, 0.75], v3(s * 0.43, 0.68, 0.5));
  f.box(m.darkSteel, [1.1, 0.78, 0.5], v3(0, 0.55, -1.2));
  f.box(m.darkSteel, [1.0, 0.12, 0.4], v3(0, 0.98, -1.18));
  f.box(m.forklift, [0.96, 0.26, 0.95], v3(0, 0.76, -0.25));
  for (const s of [-1, 1]) f.box(m.treadPlate, [0.2, 0.02, 0.35], v3(s * 0.45, 0.35, 0.15));
  // propane tank on the counterweight (electric trucks have a battery hood instead)
  if (propane) {
    f.cylinder(m.laminateWhite, 0.16, 0.78, v3(0, 1.22, -1.15), [0, 0, Math.PI / 2], 18);
    for (const s of [-1, 1]) f.box(m.darkSteel, [0.04, 0.22, 0.34], v3(s * 0.3, 1.1, -1.15));
  } else f.box(m.blackPlastic, [0.3, 0.12, 0.2], v3(0.3, 0.95, -0.95));
  // operator: seat, steering, dash
  f.box(m.rubber, [0.5, 0.1, 0.46], v3(0, 0.94, -0.42));
  f.box(m.rubber, [0.5, 0.46, 0.1], v3(0, 1.18, -0.66), [-0.15, 0, 0]);
  f.box(m.forklift, [0.92, 0.32, 0.26], v3(0, 0.88, 0.42));
  f.pipe(m.darkSteel, v3(0, 1.0, 0.36), v3(0, 1.28, 0.18), 0.03);
  f.geo(m.rubber, new THREE.TorusGeometry(0.17, 0.018, 6, 24), v3(0, 1.3, 0.16), [-1.1, 0, 0]);
  for (const [x, c] of [[-0.18, m.darkSteel], [0.18, m.darkSteel]] as const) f.pipe(c, v3(x, 1.0, 0.45), v3(x * 1.1, 1.25, 0.4), 0.012);
  // overhead guard
  for (const s of [-1, 1]) {
    f.pipe(m.darkSteel, v3(s * 0.46, 0.7, 0.62), v3(s * 0.46, 2.1, 0.45), 0.035);
    f.pipe(m.darkSteel, v3(s * 0.46, 1.0, -0.98), v3(s * 0.46, 2.1, -0.85), 0.035);
    f.box(m.darkSteel, [0.06, 0.06, 1.38], v3(s * 0.46, 2.12, -0.2));
  }
  for (let i = 0; i < 6; i++) f.box(m.darkSteel, [0.94, 0.04, 0.05], v3(0, 2.13, -0.85 + (1.3 * i) / 5));
  f.cylinder(m.beacon, 0.06, 0.1, v3(0.3, 2.21, -0.75), undefined, 12);
  for (const s of [-1, 1]) f.cylinder(m.chrome, 0.05, 0.07, v3(s * 0.4, 2.05, 0.52), [Math.PI / 2, 0, 0], 12);
  // mast: outer and inner channels, lift cylinder, carriage, backrest, forks
  const innerRise = Math.max(0, lift - 0.6);
  for (const s of [-1, 1]) {
    f.box(m.darkSteel, [0.09, 2.15, 0.13], v3(s * 0.37, 1.15, 0.86));
    f.box(m.darkSteel, [0.08, 2.1, 0.11], v3(s * 0.28, 1.12 + innerRise, 0.88));
    f.pipe(m.chrome, v3(s * 0.37, 0.3, 0.75), v3(s * 0.37, 0.75, 0.6), 0.035);
  }
  f.box(m.darkSteel, [0.82, 0.08, 0.1], v3(0, 2.2, 0.86)).box(m.darkSteel, [0.82, 0.08, 0.1], v3(0, 0.35, 0.86));
  f.cylinder(m.chrome, 0.045, 1.6, v3(0, 1.05 + innerRise / 2, 0.82), undefined, 12);
  f.box(m.darkSteel, [1.02, 0.42, 0.05], v3(0, lift + 0.32, 0.98));
  for (let i = 0; i < 5; i++) f.box(m.darkSteel, [0.035, 1.1, 0.035], v3(-0.44 + i * 0.22, lift + 1.05, 0.98));
  f.box(m.darkSteel, [1.02, 0.05, 0.04], v3(0, lift + 1.6, 0.98));
  for (const s of [-1, 1]) {
    f.box(m.darkSteel, [0.12, 0.5, 0.045], v3(s * 0.3, lift + 0.25, 1.02));
    f.box(m.darkSteel, [0.12, 0.045, 1.07], v3(s * 0.3, lift + 0.0225, 1.58));
  }
  if (carrying) palletLoad(b, 0, lift + 0.045, 1.62, -Math.PI / 2, 1.5, rand, 'film-cartons');
  return b;
}

/** Manual pallet jack, forks toward local +z. */
function palletJack(withLoad: boolean, rand: () => number) {
  const m = warehouseMaterials();
  const b = new Batch();
  const f = b.frame(0, 0, 0);
  for (const s of [-1, 1]) {
    f.box(m.red, [0.16, 0.06, 1.15], v3(s * 0.27, 0.05, 0.78));
    f.cylinder(m.rubber, 0.04, 0.07, v3(s * 0.27, 0.04, 1.28), [0, 0, Math.PI / 2], 10);
  }
  f.box(m.red, [0.7, 0.16, 0.22], v3(0, 0.12, 0.12));
  f.cylinder(m.chrome, 0.05, 0.32, v3(0, 0.36, 0.1), undefined, 12);
  f.box(m.red, [0.22, 0.12, 0.2], v3(0, 0.56, 0.1));
  for (const s of [-1, 1]) f.cylinder(m.rubber, 0.09, 0.06, v3(s * 0.09, 0.09, 0.05), [0, 0, Math.PI / 2], 14);
  f.pipe(m.red, v3(0, 0.6, 0.08), v3(0, 1.18, -0.32), 0.022);
  f.box(m.rubber, [0.36, 0.05, 0.05], v3(0, 1.2, -0.34));
  for (const s of [-1, 1]) f.pipe(m.red, v3(0, 1.0, -0.2), v3(s * 0.17, 1.2, -0.33), 0.016);
  if (withLoad) palletLoad(b, 0, 0.085, 0.78, -Math.PI / 2, 1.5, rand, 'wrapped');
  return b;
}

// --- stations -----------------------------------------------------------------------------

/** Packing bench: butcher-block top, pegboard upright, monitor, scale, label printer, paper roll. */
function packingBench(f: LocalFrame) {
  const m = warehouseMaterials();
  f.box(m.pallet[0], [1.8, 0.045, 0.76], v3(0, 0.9, 0));
  for (const x of [-0.85, 0.85]) for (const z of [-0.33, 0.33]) f.box(m.grayMachine, [0.05, 0.88, 0.05], v3(x, 0.44, z));
  f.box(m.grayMachine, [1.72, 0.025, 0.66], v3(0, 0.2, 0));
  for (const x of [-0.85, 0.85]) f.box(m.grayMachine, [0.05, 1.15, 0.05], v3(x, 1.5, 0.35));
  f.box(m.laminateWhite, [1.7, 0.85, 0.012], v3(0, 1.45, 0.36));
  f.box(m.grayMachine, [1.8, 0.025, 0.3], v3(0, 1.95, 0.24));
  f.box(m.troffer, [1.4, 0.01, 0.06], v3(0, 1.93, 0.18));
  f.box(m.blackPlastic, [0.5, 0.31, 0.03], v3(-0.45, 1.3, 0.3)).box(m.screen, [0.47, 0.28, 0.005], v3(-0.45, 1.3, 0.283));
  f.box(m.grayMachine, [0.42, 0.05, 0.42], v3(0.35, 0.95, -0.05)).box(m.blackPlastic, [0.14, 0.08, 0.04], v3(0.35, 1.0, 0.2));
  f.box(m.laminateWhite, [0.22, 0.2, 0.28], v3(-0.75, 1.02, 0.15));
  f.cylinder(m.cardboard[0], 0.1, 0.9, v3(0.3, 1.66, 0.26), [0, 0, Math.PI / 2], 16);
  for (const x of [-0.15, 0.75]) f.box(m.grayMachine, [0.02, 0.18, 0.18], v3(x, 1.66, 0.26));
  for (let i = 0; i < 6; i++) f.box(m.cardboard[i % 4], [0.9, 0.012, 0.6], v3(0, 0.22 + i * 0.013, 0));
  f.box(m.darkSteel, [0.1, 0.12, 0.06], v3(0.75, 0.97, -0.15));
}

function wrapper(b: Batch, x: number, z: number, rand: () => number) {
  const m = warehouseMaterials();
  const f = b.frame(x, 0, z);
  f.cylinder(m.grayMachine, 0.86, 0.06, v3(0, 0.03, 0), undefined, 40);
  f.cylinder(m.darkSteel, 0.82, 0.02, v3(0, 0.07, 0), undefined, 40);
  f.box(m.grayMachine, [0.5, 0.06, 0.9], v3(1.1, 0.03, 0));
  f.box(m.blueMachine, [0.32, 2.6, 0.32], v3(1.15, 1.3, 0));
  f.box(m.darkSteel, [0.3, 0.38, 0.42], v3(1.0, 1.15, 0));
  f.cylinder(m.laminateWhite, 0.07, 0.5, v3(0.82, 1.15, 0), undefined, 16);
  f.box(m.laminateWhite, [0.28, 0.4, 0.14], v3(1.15, 1.4, 0.25));
  f.box(m.blackPlastic, [0.2, 0.25, 0.01], v3(1.15, 1.42, 0.325));
  load(b, 'wrapped', x, 0.08 + 0.14, z, 0, 1.3, rand);
  palletLoad(b, x, 0.08, z, 0, 0.14, rand, 'empty');
}

function baler(b: Batch, x: number, z: number, rotY: number) {
  const m = warehouseMaterials();
  const f = b.frame(x, 0, z, rotY);
  f.box(m.blueMachine, [1.7, 2.9, 1.05], v3(0, 1.45, 0));
  f.box(m.safetyYellow, [1.35, 1.1, 0.04], v3(0, 0.75, -0.54));
  f.box(m.darkSteel, [0.06, 0.5, 0.06], v3(0.55, 0.75, -0.58));
  for (let i = 0; i < 8; i++) f.box(m.darkSteel, [0.03, 0.62, 0.03], v3(-0.6 + (1.2 * i) / 7, 1.85, -0.54));
  f.box(m.darkSteel, [1.3, 0.04, 0.04], v3(0, 2.16, -0.54)).box(m.darkSteel, [1.3, 0.04, 0.04], v3(0, 1.54, -0.54));
  f.box(m.blueMachine, [1.1, 0.5, 0.75], v3(0, 3.15, 0));
  f.cylinder(m.chrome, 0.08, 0.4, v3(0, 3.55, 0), undefined, 12);
  f.box(m.grayMachine, [0.4, 0.6, 0.5], v3(1.05, 0.5, 0));
  f.box(m.safetyYellow, [0.4, 0.25, 0.01], v3(-0.4, 2.55, -0.53));
  // a finished bale, strapped, beside it
  f.box(m.cardboard[1], [1.15, 0.75, 0.75], v3(1.85, 0.375, 0.05));
  for (const xx of [1.45, 1.75, 2.05, 2.3]) f.box(m.galv, [0.01, 0.77, 0.77], v3(xx, 0.375, 0.05));
}

function ladder(f: LocalFrame) {
  const m = warehouseMaterials();
  const steps = 7, rise = 0.25, run = 0.2;
  for (let i = 0; i < steps; i++) f.box(m.treadPlate, [0.6, 0.03, run + 0.02], v3(0, rise * (i + 1), 0.7 - run * (i + 0.5)));
  const top = rise * steps, back = 0.7 - run * steps;
  f.box(m.treadPlate, [0.6, 0.03, 0.55], v3(0, top, back - 0.25));
  for (const s of [-1, 1]) {
    f.strut(m.orange, v3(s * 0.33, 0, 0.8), v3(s * 0.33, top, back + 0.02), 0.05, 0.12);
    f.box(m.orange, [0.05, top, 0.05], v3(s * 0.33, top / 2, back - 0.5));
    f.pipe(m.orange, v3(s * 0.36, 0.95, 0.75), v3(s * 0.36, top + 0.95, back), 0.02);
    f.pipe(m.orange, v3(s * 0.36, top + 0.95, back), v3(s * 0.36, top + 0.95, back - 0.5), 0.02);
    f.pipe(m.orange, v3(s * 0.36, top, back - 0.5), v3(s * 0.36, top + 0.95, back - 0.5), 0.02);
    for (const z of [0.75, back - 0.5]) f.cylinder(m.rubber, 0.05, 0.04, v3(s * 0.33, 0.05, z), [0, 0, Math.PI / 2], 10);
  }
  f.pipe(m.orange, v3(-0.36, top + 0.95, back - 0.5), v3(0.36, top + 0.95, back - 0.5), 0.02);
}

function cone(): Batch {
  const m = warehouseMaterials();
  const b = new Batch();
  const f = b.frame(0, 0, 0);
  f.box(m.rubber, [0.36, 0.03, 0.36], v3(0, 0.015, 0));
  f.cylinder(m.orange, 0.15, 0.68, v3(0, 0.37, 0), undefined, 16, 0.025);
  f.cylinder(m.laminateWhite, 0.1, 0.1, v3(0, 0.42, 0), undefined, 16, 0.083);
  return b;
}

function box(material: THREE.Material, size: [number, number, number], tape = true): Batch {
  const m = warehouseMaterials();
  const b = new Batch();
  b.box(material, size, [0, size[1] / 2, 0]);
  if (tape) b.box(m.tape, [size[0] + 0.002, 0.002, 0.048], [0, size[1] + 0.001, 0]);
  return b;
}

function tote(material: THREE.Material): Batch {
  const b = new Batch();
  b.box(material, [0.58, 0.28, 0.38], [0, 0.14, 0]);
  b.box(material, [0.6, 0.03, 0.4], [0, 0.285, 0]);
  return b;
}

function trashCan(): Batch {
  const m = warehouseMaterials();
  const b = new Batch();
  b.cylinder(m.grayMachine, 0.25, 0.8, [0, 0.4, 0], undefined, 24, 0.28);
  b.add(m.grayMachine, new THREE.TorusGeometry(0.28, 0.02, 6, 24), new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 0.8, 0));
  return b;
}

// --- walls: chargers, extinguishers, panels, riser -------------------------------------

function wallServices(shell: Shell) {
  const m = warehouseMaterials();
  // fire extinguishers beside every other main column on the long walls, and by the exits
  const ext = (wall: 'north' | 'south' | 'east' | 'west', u: number) => {
    const b = new Batch();
    b.box(m.darkSteel, [0.12, 0.2, 0.04], [0, 1.15, 0.02]);
    b.cylinder(m.red, 0.08, 0.48, [0, 0.95, 0.11], undefined, 16);
    b.cylinder(m.darkSteel, 0.03, 0.08, [0, 1.23, 0.11], undefined, 8);
    b.pipe(m.rubber, new THREE.Vector3(0.04, 1.24, 0.13), new THREE.Vector3(0.09, 0.9, 0.16), 0.012);
    const s = new THREE.PlaneGeometry(0.3, 0.3);
    b.add(signMaterial('FIRE\nEXT.', { w: 0.3, h: 0.3, bg: '#c4161c', fg: '#ffffff' }), s, new THREE.Matrix4().makeTranslation(0, 1.75, 0.006));
    shell.mount(wall, b.build('fire-extinguisher'), u, 0, 0);
  };
  FRAME_X.slice(1, -1).forEach((x, i) => {
    if (i % 2) return;
    ext('north', uOf('north', x) + 0.55);
    if (x > OFFICE_RECT.x1 + 1) ext('south', uOf('south', x) + 0.55);
  });
  for (const d of DOORS.filter((d) => d.kind === 'man')) ext(d.wall, uOf(d.wall, d.at) + d.width / 2 + 0.5);

  // electrical service: switchgear, panels and conduit up the north wall
  {
    const b = new Batch();
    b.box(m.grayMachine, [0.9, 2.0, 0.5], [0, 1.0, 0.25]);
    for (const [x, w, h] of [[-1.05, 0.55, 1.2], [1.0, 0.5, 1.0], [1.6, 0.4, 0.6]] as const) b.box(m.grayMachine, [w, h, 0.22], [x, 1.0 + h / 2, 0.11]);
    for (let i = 0; i < 6; i++) b.cylinder(m.galv, 0.025, 6.0 - (i % 3) * 0.6, [-0.3 + i * 0.12, 2.0 + (6 - (i % 3) * 0.6) / 2, 0.05], undefined, 8);
    b.box(m.hazard, [0.9, 0.02, 0.9], [0, 0.01, 0.95]);
    const s = new THREE.PlaneGeometry(0.4, 0.2);
    b.add(signMaterial('DANGER\n480V', { w: 0.4, h: 0.2, bg: '#ffffff', fg: '#c4161c', border: '#c4161c' }), s, new THREE.Matrix4().makeTranslation(0, 1.65, 0.502));
    const g = b.build('electrical-service');
    g.userData.physics = { type: 'static' };
    shell.mount('north', g, uOf('north', SERVICE_X), 0, 0);
  }
  // fire sprinkler riser with its control valve and gauges
  {
    const b = new Batch();
    b.cylinder(m.red, 0.085, 7.4, [0, 3.7, 0.18], undefined, 16);
    b.box(m.red, [0.32, 0.3, 0.3], [0, 1.2, 0.18]);
    b.cylinder(m.red, 0.03, 0.5, [0, 1.6, 0.18], undefined, 8);
    b.add(m.red, new THREE.TorusGeometry(0.16, 0.015, 6, 20), new THREE.Matrix4().makeTranslation(0, 1.85, 0.18));
    for (const y of [0.9, 1.45]) b.cylinder(m.chrome, 0.045, 0.02, [0.12, y, 0.27], [Math.PI / 2, 0, 0], 12);
    const s = new THREE.PlaneGeometry(0.4, 0.25);
    b.add(signMaterial('SPRINKLER\nRISER', { w: 0.4, h: 0.25, bg: '#c4161c', fg: '#ffffff' }), s, new THREE.Matrix4().makeTranslation(0.4, 1.9, 0.006));
    shell.mount('north', b.build('sprinkler-riser'), uOf('north', RISER_X), 0, 0);
  }
}

export function buildEquipment(shell: Shell) {
  const m = warehouseMaterials();
  const rand = mulberry32(SITE.seed + 11);
  const group = new THREE.Group();
  group.name = 'equipment';
  const layout: RoomLayout['objects'] = [];
  const marks: FloorMark[] = [];
  const add = (obj: THREE.Object3D, category: string, size: [number, number, number]) => {
    group.add(obj);
    layout.push({ category, center: [obj.position.x, size[1] / 2, obj.position.z], size, rotY: obj.rotation.y });
    const c = Math.cos(obj.rotation.y), s = Math.sin(obj.rotation.y);
    const hx = (Math.abs(c) * size[0] + Math.abs(s) * size[2]) / 2, hz = (Math.abs(s) * size[0] + Math.abs(c) * size[2]) / 2;
    addObstacle(obj.position.x - hx, obj.position.x + hx, obj.position.z - hz, obj.position.z + hz);
  };

  // forklift working an aisle with a load; a second on charge by the east wall
  const aisle = RACK.aisles[Math.min(2, RACK.aisles.length - 1)];
  add(item('forklift', forklift(0.35, true, rand), (aisle.x0 + aisle.x1) / 2, (RACK_Z[1] + RACK_Z[2]) / 2, Math.PI, { type: 'static' }), 'forklift', [1.15, 2.2, 3.4]);
  const chargeZ = Math.min(DOORS.find((d) => d.kind === 'drive-in')?.at ?? D / 2, D / 2) - 3.6;
  // electric truck backed up to its charger
  const chargeX = W / 2 - 1.8;
  add(item('forklift-charging', forklift(0.02, false, rand, false), chargeX, chargeZ, -Math.PI / 2, { type: 'static' }), 'forklift', [1.15, 2.2, 3.4]);
  marks.push({ rect: [chargeX - 2.4, W / 2 - 0.3, chargeZ - 1.0, chargeZ + 1.0], kind: 'hatch' });
  {
    const b = new Batch();
    b.box(m.grayMachine, [0.6, 0.85, 0.36], [0, 1.25, 0.18]);
    for (let i = 0; i < 5; i++) b.box(m.darkSteel, [0.4, 0.02, 0.01], [0, 1.0 + i * 0.08, 0.365]);
    b.box(m.screen, [0.18, 0.1, 0.01], [0.12, 1.5, 0.365]);
    b.pipe(m.rubber, new THREE.Vector3(-0.15, 0.85, 0.2), new THREE.Vector3(-0.3, 0.3, 0.8), 0.02);
    b.pipe(m.rubber, new THREE.Vector3(-0.3, 0.3, 0.8), new THREE.Vector3(-0.2, 0.75, 1.25), 0.02);
    const sign = new THREE.PlaneGeometry(0.9, 0.3);
    b.add(signMaterial('FORKLIFT\nCHARGING', { w: 0.9, h: 0.3, bg: '#f1bd12', fg: '#151515' }), sign, new THREE.Matrix4().makeTranslation(0, 2.1, 0.006));
    const g = b.build('forklift-charger');
    g.userData.physics = { type: 'static' };
    shell.mount('east', g, uOf('east', chargeZ), 0, 0);
  }

  // pallet jacks: one staging a load at an open dock, one parked
  const open = DOORS.filter((d) => d.kind === 'dock' && d.open);
  if (open[0]) add(item('pallet-jack', palletJack(true, rand), open[0].at - 0.2, D / 2 - DOCKS.leveler[1] - 0.4, 0.08, { type: 'dynamic', mass: 80, shape: 'box', surface: 'metal' }), 'pallet jack', [0.7, 1.2, 1.6]);
  const parkZ = (DOORS.find((d) => d.kind === 'drive-in')?.at ?? 0) + 3.2;
  add(item('pallet-jack-parked', palletJack(false, rand), W / 2 - 1.2, Math.min(parkZ, D / 2 - 1), Math.PI + 0.15, { type: 'dynamic', mass: 70, shape: 'box', surface: 'metal' }), 'pallet jack', [0.7, 1.2, 1.6]);

  // staged pallets in the dock lanes: full lanes at the open doors
  const staged = new Batch();
  for (const s of STAGING) {
    const isOpen = open.some((d) => d.index === s.index);
    const count = isOpen ? 6 : Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      const col = i % 2 ? 0.6 : -0.6, row = Math.floor(i / 2);
      const z = s.z0 - 0.75 - row * 1.4;
      if (z < s.z1 + 0.6) break;
      palletLoad(staged, s.x + col, 0, z, Math.PI / 2 + (rand() - 0.5) * 0.06, 1.9, rand, rand() < 0.6 ? 'wrapped' : 'film-cartons');
    }
  }
  group.add(staged.build('staged-pallets'));

  // packing area west of the docks: benches against the front wall, wrapper, baler
  const px0 = OFFICE_RECT.x1 + 1.6;
  const benches = [0, 1, 2].map((i) => px0 + 1.1 + i * 2.3);
  benches.forEach((x, i) => {
    const b = new Batch();
    packingBench(b.frame(0, 0, 0));
    add(item(`packing-station-${i + 1}`, b, x, D / 2 - 0.6, 0, { type: 'static' }), 'packing station', [1.8, 2.0, 0.76]);
    const stool = new Batch();
    stool.cylinder(m.rubber, 0.18, 0.06, [0, 0.66, 0], undefined, 16).cylinder(m.grayMachine, 0.025, 0.63, [0, 0.32, 0], undefined, 8);
    stool.add(m.grayMachine, new THREE.TorusGeometry(0.2, 0.012, 6, 20), new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 0.25, 0));
    group.add(item(`stool-${i + 1}`, stool, x - 0.3, D / 2 - 1.45, 0, { type: 'dynamic', mass: 6, shape: 'cylinder', surface: 'metal' }));
    // cartons being packed, flat stock on the floor
    group.add(item(`carton-${i * 3 + 1}`, box(m.cardboard[i % 4], [0.45, 0.3, 0.35]), x + 0.05, D / 2 - 0.65, 0.2, { type: 'dynamic', mass: 4, shape: 'box', surface: 'cardboard' }, 0.923));
    group.add(item(`carton-${i * 3 + 2}`, box(m.cardboard[(i + 1) % 4], [0.35, 0.25, 0.3]), x + 0.95 + 0.25, D / 2 - 1.15, -0.4, { type: 'dynamic', mass: 3, shape: 'box', surface: 'cardboard' }));
    group.add(item(`carton-${i * 3 + 3}`, box(m.cardboard[(i + 2) % 4], [0.6, 0.4, 0.4]), x + 0.95 + 0.2, D / 2 - 1.2, 0.1, { type: 'dynamic', mass: 6, shape: 'box', surface: 'cardboard' }, 0.25));
  });
  marks.push({ rect: [px0, benches[2] + 1.3, D / 2 - 2.3, D / 2 - 0.2], kind: 'walk' });
  const misc = new Batch();
  const wx = benches[1], wz = D / 2 - 4.6;
  wrapper(misc, wx, wz, rand);
  addObstacle(wx - 1, wx + 1.4, wz - 1, wz + 1);
  layout.push({ category: 'stretch wrapper', center: [wx + 0.2, 1.3, wz], size: [2.2, 2.6, 1.8], rotY: 0 });
  const balerX = benches[2] + 2.4;
  baler(misc, balerX, D / 2 - 0.75, 0);
  addObstacle(balerX - 0.9, balerX + 2.5, D / 2 - 1.3, D / 2);
  layout.push({ category: 'baler', center: [balerX, 1.5, D / 2 - 0.75], size: [1.7, 3.0, 1.05], rotY: 0 });
  group.add(misc.build('packing-machines'));

  // rolling ladder parked at the north end of an aisle
  const la = RACK.aisles[0];
  {
    const b = new Batch();
    ladder(b.frame(0, 0, 0));
    add(item('rolling-ladder', b, (la.x0 + la.x1) / 2 + 0.6, RACK_Z[0] + 1.0, Math.PI, { type: 'dynamic', mass: 45, shape: 'box', surface: 'metal', wakeOnImpact: false }), 'rolling ladder', [0.8, 2.7, 1.6]);
  }

  // cones by the drive-in door, totes on a cart, trash cans
  const di = DOORS.find((d) => d.kind === 'drive-in');
  if (di) for (let i = 0; i < 3; i++) group.add(item(`traffic-cone-${i + 1}`, cone(), W / 2 - 2.2, di.at - 1.2 + i * 1.2, rand() * 3, { type: 'dynamic', mass: 1.5, shape: 'box', surface: 'rubber' }));
  {
    const b = new Batch();
    const f = b.frame(0, 0, 0);
    f.box(m.pallet[1], [1.2, 0.04, 0.75], v3(0, 0.2, 0));
    for (const x of [-0.5, 0.5]) for (const z of [-0.3, 0.3]) f.cylinder(m.rubber, 0.075, 0.05, v3(x, 0.075, z), [0, 0, Math.PI / 2], 12).box(m.grayMachine, [0.06, 0.08, 0.06], v3(x, 0.15, z));
    f.pipe(m.grayMachine, v3(-0.58, 0.22, -0.33), v3(-0.58, 1.0, -0.33), 0.016).pipe(m.grayMachine, v3(-0.58, 0.22, 0.33), v3(-0.58, 1.0, 0.33), 0.016).pipe(m.grayMachine, v3(-0.58, 1.0, -0.33), v3(-0.58, 1.0, 0.33), 0.016);
    const cx = benches[0] + 0.2, cz = D / 2 - 3.0;
    add(item('platform-cart', b, cx, cz, 0.3, { type: 'dynamic', mass: 25, shape: 'box', surface: 'wood' }), 'cart', [1.2, 1.0, 0.75]);
    for (let i = 0; i < 4; i++) {
      const lx = (i % 2 ? 0.27 : -0.27), ly = 0.22 + Math.floor(i / 2) * 0.3;
      const p = new THREE.Vector3(lx, ly, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.3);
      group.add(item(`tote-${i + 1}`, tote(i % 3 ? m.toteBlue : m.toteGray), cx + p.x, cz + p.z, 0.3, { type: 'dynamic', mass: 3, shape: 'box', surface: 'plastic' }, ly));
    }
  }
  for (const [x, z] of [[benches[0] - 0.75, D / 2 - 0.45], [benches[2] + 1.15, D / 2 - 1.6]]) group.add(item('trash-can', trashCan(), x, z, 0, { type: 'dynamic', mass: 12, shape: 'cylinder', surface: 'plastic' }));
  // a few empty pallets stacked by the baler
  const empties = new Batch();
  const ex = benches[2] + 0.6, ez = D / 2 - 4.6;
  for (let i = 0; i < 7; i++) palletLoad(empties, ex, i * 0.142, ez, Math.PI / 2 + (rand() - 0.5) * 0.08, 0.14, rand, 'empty');
  group.add(empties.build('empty-pallet-stack'));
  addObstacle(ex - 0.6, ex + 0.6, ez - 0.7, ez + 0.7);

  // overflow pallets on the floor at the west end of the cross aisle
  const overflow = new Batch();
  const ox = -W / 2 + 2.4;
  for (let i = 0; i < 4; i++) palletLoad(overflow, ox + i * 1.3, 0, RACK_Z_END + 1.0, 0, 1.6, rand, i % 2 ? 'sacks' : 'crate');
  group.add(overflow.build('floor-storage'));
  addObstacle(ox - 0.7, ox + 3 * 1.3 + 0.7, RACK_Z_END + 0.4, RACK_Z_END + 1.6);

  wallServices(shell);
  return { group, layout, marks };
}
