import * as THREE from 'three';
import type { RoomLayout } from '../../packages/room-runtime/types';
import { OFFICE } from './config';
import { Batch, type LocalFrame } from './batch';
import { signMaterial, warehouseMaterials } from './materials';
import { OFFICE_RECT, PARTITION, WINDOWS, type Window } from './plan';
import type { Shell } from './shell';

/**
 * Front office in the south-west corner: drywall partitions with a door and interior windows
 * onto the warehouse floor, furring on the exterior walls, restrooms, a glass conference room,
 * reception, an open desk pod and a break area. The drop ceiling and the deck above it belong to
 * the "ceiling" list, so the dollhouse view looks down into the rooms.
 */
const { x0, x1, z0, z1 } = OFFICE_RECT;
const CEIL = OFFICE.ceiling;
const H = OFFICE.height;

type Hole = { a0: number; a1: number; v0: number; v1: number };

/** extruded panel along one axis: `a` runs along the panel, holes cut floor-to-head for doors */
function panel(a0: number, a1: number, height: number, holes: Hole[], depth: number) {
  const s = new THREE.Shape();
  const notches = holes.filter((h) => h.v0 === 0).sort((p, q) => p.a0 - q.a0);
  s.moveTo(a0, 0);
  for (const h of notches) { s.lineTo(h.a0, 0); s.lineTo(h.a0, h.v1); s.lineTo(h.a1, h.v1); s.lineTo(h.a1, 0); }
  s.lineTo(a1, 0); s.lineTo(a1, height); s.lineTo(a0, height); s.closePath();
  for (const h of holes) if (h.v0 > 0) s.holes.push(new THREE.Path([new THREE.Vector2(h.a0, h.v0), new THREE.Vector2(h.a1, h.v0), new THREE.Vector2(h.a1, h.v1), new THREE.Vector2(h.a0, h.v1)]));
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
}
/** shape (a along z, y up) extruded toward −x, placed so it spans x ∈ [x − depth, x] */
const alongZ = (g: THREE.BufferGeometry, x: number) =>
  g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)).setPosition(x, 0, 0));

/** glazing + frame in a partition hole; f maps (a, y, offset across the panel) to world */
function glazing(b: Batch, h: Hole, f: (a: number, y: number, o: number) => [number, number, number], along: 'x' | 'z') {
  const m = warehouseMaterials();
  const w = h.a1 - h.a0, hh = h.v1 - h.v0, t = 0.045;
  const rot: [number, number, number] = along === 'x' ? [0, 0, 0] : [0, Math.PI / 2, 0];
  b.box(m.storefront, [w, t, PARTITION + 0.01], f((h.a0 + h.a1) / 2, h.v0 + t / 2, 0), rot);
  b.box(m.storefront, [w, t, PARTITION + 0.01], f((h.a0 + h.a1) / 2, h.v1 - t / 2, 0), rot);
  for (const a of [h.a0 + t / 2, h.a1 - t / 2]) b.box(m.storefront, [t, hh, PARTITION + 0.01], f(a, h.v0 + hh / 2, 0), rot);
  const g = new THREE.PlaneGeometry(w - 2 * t, hh - 2 * t);
  if (along === 'z') g.rotateY(Math.PI / 2);
  b.add(m.glass, g, new THREE.Matrix4().makeTranslation(...f((h.a0 + h.a1) / 2, h.v0 + hh / 2, 0)));
}

function door(f: LocalFrame, w: number, h: number) {
  const m = warehouseMaterials();
  f.box(m.storefront, [0.05, h + 0.05, PARTITION + 0.02], [-w / 2 - 0.025, (h + 0.05) / 2, 0]);
  f.box(m.storefront, [0.05, h + 0.05, PARTITION + 0.02], [w / 2 + 0.025, (h + 0.05) / 2, 0]);
  f.box(m.storefront, [w + 0.1, 0.05, PARTITION + 0.02], [0, h + 0.025, 0]);
  f.box(m.woodDesk, [w - 0.006, h - 0.006, 0.045], [0, h / 2, 0]);
  f.box(m.blackPlastic, [0.12, 0.7, 0.05], [w / 2 - 0.22, 1.5, 0]);
  for (const s of [-1, 1]) f.box(m.chrome, [0.12, 0.02, 0.02], [w / 2 - 0.1, 1.0, s * 0.04]);
}

function chair(f: LocalFrame) {
  const m = warehouseMaterials();
  f.box(m.fabric, [0.5, 0.08, 0.48], [0, 0.47, 0]);
  f.box(m.fabric, [0.46, 0.5, 0.06], [0, 0.82, 0.24], [-0.12, 0, 0]);
  f.cylinder(m.darkSteel, 0.025, 0.36, [0, 0.27, 0], undefined, 8);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    f.box(m.blackPlastic, [0.04, 0.03, 0.3], [Math.sin(a) * 0.14, 0.07, Math.cos(a) * 0.14], [0, a, 0]);
    f.cylinder(m.blackPlastic, 0.025, 0.04, [Math.sin(a) * 0.29, 0.025, Math.cos(a) * 0.29], [Math.PI / 2, 0, a], 8);
  }
}

function desk(f: LocalFrame, w = 1.5, d = 0.75, monitor = true) {
  const m = warehouseMaterials();
  f.box(m.woodDesk, [w, 0.03, d], [0, 0.735, 0]);
  for (const s of [-1, 1]) f.box(m.darkSteel, [0.05, 0.72, d - 0.1], [s * (w / 2 - 0.06), 0.36, 0]);
  f.box(m.darkSteel, [w - 0.15, 0.25, 0.02], [0, 0.5, d / 2 - 0.08]);
  if (monitor) {
    f.box(m.blackPlastic, [0.56, 0.34, 0.03], [0, 1.08, d / 2 - 0.2]);
    f.box(m.screen, [0.53, 0.31, 0.005], [0, 1.08, d / 2 - 0.218]);
    f.box(m.darkSteel, [0.05, 0.16, 0.05], [0, 0.83, d / 2 - 0.18]);
    f.box(m.darkSteel, [0.22, 0.012, 0.16], [0, 0.756, d / 2 - 0.18]);
    f.box(m.blackPlastic, [0.44, 0.015, 0.14], [0, 0.758, d / 2 - 0.42]);
  }
}

export function buildOffice(shell: Shell) {
  const m = warehouseMaterials();
  const group = new THREE.Group();
  group.name = 'office';
  const b = new Batch();
  const layout: RoomLayout['objects'] = [{ category: 'office', center: [(x0 + x1) / 2, H / 2, (z0 + z1) / 2], size: [x1 - x0, H, z1 - z0], rotY: 0 }];

  // --- partitions onto the warehouse floor
  const dw = 0.95, dh = 2.13;
  const north: Hole[] = [
    { a0: OFFICE.warehouseDoor - dw / 2, a1: OFFICE.warehouseDoor + dw / 2, v0: 0, v1: dh },
    ...OFFICE.partitionWindows.north.map((x) => ({ a0: x - 0.9, a1: x + 0.9, v0: 1.0, v1: 2.2 })),
  ];
  const east: Hole[] = OFFICE.partitionWindows.east.map((z) => ({ a0: z - 0.9, a1: z + 0.9, v0: 1.0, v1: 2.2 }));
  const n = panel(x0, x1 + PARTITION, H, north, PARTITION);
  n.translate(0, 0, z0 - PARTITION);
  b.add(m.drywall, n);
  b.add(m.drywall, alongZ(panel(z0, z1, H, east, PARTITION), x1 + PARTITION));
  for (const h of north) if (h.v0 > 0) glazing(b, h, (a, y) => [a, y, z0 - PARTITION / 2], 'x');
  for (const h of east) glazing(b, h, (a, y) => [x1 + PARTITION / 2, y, a], 'z');
  door(b.frame(OFFICE.warehouseDoor, 0, z0 - PARTITION / 2), dw, dh);
  // sign over the door, warehouse side
  const sign = new THREE.PlaneGeometry(1.2, 0.3);
  sign.rotateY(Math.PI);
  b.add(signMaterial('OFFICE', { w: 1.2, h: 0.3, bg: '#1f3a5f', fg: '#ffffff' }), sign, new THREE.Matrix4().makeTranslation(OFFICE.warehouseDoor, dh + 0.35, z0 - PARTITION - 0.006));
  // low guard rail protecting the partitions from forklifts (gap at the door)
  const rail = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az), posts = Math.max(2, Math.ceil(len / 2.4) + 1);
    for (let i = 0; i < posts; i++) {
      const t = i / (posts - 1), x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      b.box(m.safetyYellow, [0.1, 0.55, 0.1], [x, 0.275, z]);
      b.box(m.darkSteel, [0.18, 0.01, 0.18], [x, 0.005, z]);
    }
    b.strut(m.safetyYellow, new THREE.Vector3(ax, 0.42, az), new THREE.Vector3(bx, 0.42, bz), 0.08, 0.16);
  };
  const g = 0.35;
  rail(x0 + 0.5, z0 - PARTITION - g, OFFICE.warehouseDoor - 1.1, z0 - PARTITION - g);
  rail(OFFICE.warehouseDoor + 1.1, z0 - PARTITION - g, x1 + PARTITION + g, z0 - PARTITION - g);
  rail(x1 + PARTITION + g, z0 - PARTITION - g, x1 + PARTITION + g, z1 - 0.6);

  // --- inside: carpet, furring on the exterior walls (in their wall groups), rooms
  const carpet = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
  b.add(m.carpet, carpet, new THREE.Matrix4().makeTranslation((x0 + x1) / 2, 0.004, (z0 + z1) / 2));
  const furring = (wall: 'south' | 'west', list: Window[], extra: Hole[]) => {
    const holes: Hole[] = [...extra, ...list.filter((w) => w.wall === wall).map((w) => ({ a0: w.at - w.width / 2, a1: w.at + w.width / 2, v0: w.sill, v1: w.head }))];
    const fb = new Batch();
    if (wall === 'south') {
      const p = panel(x0, x1, CEIL, holes, 0.016);
      p.translate(0, 0, z1 - 0.016);
      fb.add(m.drywall, p);
    } else fb.add(m.drywall, alongZ(panel(z0, z1, CEIL, holes, 0.016), x0 + 0.016));
    shell.wallGroup(wall).add(fb.build(`office-furring-${wall}`));
  };
  furring('south', WINDOWS, [{ a0: OFFICE.entrance - 0.92, a1: OFFICE.entrance + 0.92, v0: 0, v1: 2.29 }]);
  furring('west', WINDOWS, []);

  // restrooms along the west end of the north partition
  const rz = z0 + 2.6, rx = [x0, x0 + 2.04, x0 + 4.08];
  const rw = (ax: number, az: number, bx: number, bz: number, holes: Hole[] = []) => {
    if (az === bz) { const p = panel(ax, bx, CEIL, holes, 0.1); p.translate(0, 0, az - 0.05); b.add(m.drywall, p); }
    else b.add(m.drywall, alongZ(panel(az, bz, CEIL, holes, 0.1), ax + 0.05));
  };
  rw(rx[0], rz, rx[2], rz, [0, 1].map((i) => ({ a0: rx[i] + 0.5, a1: rx[i] + 1.4, v0: 0, v1: 2.1 })));
  rw(rx[1], z0, rx[1], rz);
  rw(rx[2], z0, rx[2], rz);
  for (const i of [0, 1]) {
    const cx = rx[i] + 0.95;
    b.frame(cx, 0, rz).box(m.woodDesk, [0.88, 2.08, 0.04], [0, 1.04, 0.02]).box(m.chrome, [0.12, 0.02, 0.03], [0.32, 1.0, 0.07]);
    const s = new THREE.PlaneGeometry(0.25, 0.25);
    b.add(signMaterial(i ? 'WOMEN' : 'MEN', { w: 0.25, h: 0.25, bg: '#1f3a5f', fg: '#ffffff' }), s, new THREE.Matrix4().makeTranslation(cx + 0.65, 1.55, rz + 0.055));
    // fixtures: toilet against the partition, wall sink by the door
    const t = b.frame(rx[i] + 0.55, 0, z0 + 0.45);
    t.box(m.laminateWhite, [0.38, 0.4, 0.5], [0, 0.2, 0.1]).box(m.laminateWhite, [0.4, 0.38, 0.2], [0, 0.6, -0.12]).cylinder(m.laminateWhite, 0.2, 0.05, [0, 0.42, 0.18], undefined, 16);
    b.frame(rx[i] + 1.75, 0, z0 + 0.9).box(m.laminateWhite, [0.4, 0.15, 0.45], [0, 0.82, 0]).box(m.chrome, [0.03, 0.15, 0.03], [0, 0.95, -0.15]);
  }

  // conference room in the north-east corner: glass walls, table, chairs, display
  const cx0 = -15.4, cz1 = z0 + 3.5;
  const glassWall = (ax: number, az: number, bx: number, bz: number, gap?: [number, number]) => {
    const along = az === bz ? 'x' : 'z';
    const a0 = along === 'x' ? ax : az, a1 = along === 'x' ? bx : bz;
    const pieces: [number, number][] = gap ? [[a0, gap[0]], [gap[1], a1]] : [[a0, a1]];
    for (const [p0, p1] of pieces) {
      if (p1 - p0 < 0.05) continue;
      glazing(b, { a0: p0, a1: p1, v0: 0.0, v1: CEIL }, (a, y) => (along === 'x' ? [a, y, az] : [ax, y, a]), along);
    }
  };
  glassWall(cx0, z0, cx0, cz1);
  glassWall(cx0, cz1, x1, cz1, [cx0 + 0.3, cx0 + 1.25]);
  const ct = b.frame((cx0 + x1) / 2, 0, (z0 + cz1) / 2, Math.PI / 2);
  ct.box(m.woodDesk, [2.4, 0.04, 1.05], [0, 0.74, 0]);
  for (const s of [-1, 1]) ct.box(m.darkSteel, [0.08, 0.72, 0.6], [s * 0.85, 0.36, 0]);
  for (const s of [-1, 1]) for (const k of [-0.75, 0, 0.75]) chair(b.frame((cx0 + x1) / 2 + s * 0.85, 0, (z0 + cz1) / 2 + k, s > 0 ? Math.PI / 2 : -Math.PI / 2));
  b.box(m.blackPlastic, [1.25, 0.72, 0.05], [(cx0 + x1) / 2, 1.5, z0 + 0.04]);
  b.box(m.screen, [1.2, 0.67, 0.005], [(cx0 + x1) / 2, 1.5, z0 + 0.067]);
  layout.push({ category: 'conference room', center: [(cx0 + x1) / 2, 1, (z0 + cz1) / 2], size: [x1 - cx0, 2, cz1 - z0], rotY: 0 });

  // open desk pod: two pairs facing across a screen
  const podX = -18.7, podZ = z0 + 1.75;
  for (const s of [-1, 1]) for (const k of [-1, 1]) {
    desk(b.frame(podX + k * 0.66, 0, podZ + s * 0.39, s > 0 ? Math.PI : 0), 1.3, 0.75);
    chair(b.frame(podX + k * 0.66, 0, podZ + s * 1.05, s > 0 ? 0 : Math.PI));
  }
  b.box(m.fabric, [2.7, 0.45, 0.04], [podX, 0.98, podZ]);
  layout.push({ category: 'desk pod', center: [podX, 0.4, podZ], size: [2.7, 0.8, 1.6], rotY: 0 });

  // reception counter facing the entrance
  const rc = b.frame(OFFICE.entrance, 0, z1 - 2.9);
  rc.box(m.laminateWhite, [2.4, 1.05, 0.5], [0, 0.525, 0.2]).box(m.woodDesk, [2.5, 0.04, 0.32], [0, 1.07, 0.32]);
  rc.box(m.woodDesk, [2.3, 0.03, 0.7], [0, 0.735, -0.25]);
  rc.box(m.blackPlastic, [0.56, 0.34, 0.03], [0.4, 1.08, -0.18]).box(m.screen, [0.53, 0.31, 0.005], [0.4, 1.08, -0.198]);
  rc.box(m.darkSteel, [0.05, 0.3, 0.05], [0.4, 0.9, -0.15]).box(m.blackPlastic, [0.44, 0.015, 0.14], [0.4, 0.758, -0.42]);
  chair(b.frame(OFFICE.entrance, 0, z1 - 3.75, Math.PI));
  layout.push({ category: 'reception', center: [OFFICE.entrance, 0.5, z1 - 2.9], size: [2.4, 1, 0.9], rotY: 0 });

  // lobby chairs under the west windows
  for (const z of [z1 - 3.3, z1 - 2.45]) {
    const f = b.frame(x0 + 0.55, 0, z, -Math.PI / 2);
    f.box(m.fabric, [0.62, 0.42, 0.6], [0, 0.21, 0]).box(m.fabric, [0.62, 0.45, 0.12], [0, 0.6, 0.25]);
    f.box(m.darkSteel, [0.06, 0.25, 0.6], [-0.33, 0.55, 0]).box(m.darkSteel, [0.06, 0.25, 0.6], [0.33, 0.55, 0]);
  }
  b.frame(x0 + 0.5, 0, z1 - 1.7).cylinder(m.woodDesk, 0.25, 0.03, [0, 0.55, 0], undefined, 20).cylinder(m.darkSteel, 0.03, 0.54, [0, 0.27, 0], undefined, 8);

  // break area: counter with sink along the east partition, fridge, table
  const bk = b.frame(x1 - 0.32, 0, z1 - 2.1, -Math.PI / 2);
  bk.box(m.laminateWhite, [3.0, 0.88, 0.6], [0, 0.44, 0]).box(m.woodDesk, [3.05, 0.04, 0.63], [0, 0.9, 0]);
  bk.box(m.chrome, [0.5, 0.02, 0.4], [-0.5, 0.92, 0]).pipe(m.chrome, [-0.5, 0.92, -0.22], [-0.5, 1.2, -0.2], 0.012);
  bk.box(m.laminateWhite, [0.35, 0.3, 0.4], [0.9, 1.07, 0.05]);
  b.frame(x1 - 0.42, 0, z0 + 4.25, -Math.PI / 2).box(m.grayMachine, [0.75, 1.75, 0.72], [0, 0.875, 0]).box(m.chrome, [0.03, 0.5, 0.03], [0.3, 1.2, 0.37]);
  const tb = b.frame(-14.1, 0, z1 - 2.3);
  tb.cylinder(m.laminateWhite, 0.45, 0.03, [0, 0.74, 0], undefined, 24).cylinder(m.darkSteel, 0.04, 0.72, [0, 0.36, 0], undefined, 8).cylinder(m.darkSteel, 0.25, 0.02, [0, 0.01, 0], undefined, 16);
  for (const a of [0.4, 2.6]) chair(b.frame(-14.1 + Math.sin(a) * 0.75, 0, z1 - 2.3 + Math.cos(a) * 0.75, a));
  layout.push({ category: 'break area', center: [x1 - 1.6, 0.5, z1 - 2.1], size: [3.2, 1, 3.2], rotY: 0 });

  // printer and a plant
  b.frame(-20.6, 0, z0 + 3.4).box(m.laminateWhite, [0.6, 0.95, 0.55], [0, 0.475, 0]).box(m.darkSteel, [0.5, 0.06, 0.4], [0, 0.98, 0]);
  const plant = b.frame(x0 + 0.5, 0, z1 - 0.5);
  plant.cylinder(m.darkSteel, 0.2, 0.45, [0, 0.225, 0], undefined, 16, 0.24);
  for (let i = 0; i < 5; i++) plant.geo(m.foliage, new THREE.IcosahedronGeometry(0.22, 1), [Math.sin(i * 1.3) * 0.15, 0.75 + i * 0.12, Math.cos(i * 1.3) * 0.15]);

  group.add(b.build('office-interior'));

  // --- the lid: drop ceiling with troffers and the deck above (hidden from above)
  const lid = new THREE.Group();
  lid.name = 'office-ceiling';
  const lb = new Batch();
  const ceil = new THREE.PlaneGeometry(x1 - x0 + PARTITION, z1 - z0).rotateX(Math.PI / 2);
  lb.add(m.ceilingTile, ceil, new THREE.Matrix4().makeTranslation((x0 + x1 + PARTITION) / 2, CEIL, (z0 + z1) / 2));
  for (let x = x0 + 1.2; x < x1 - 0.6; x += 2.44) for (let z = z0 + 1.2; z < z1 - 0.6; z += 2.44) {
    lb.box(m.laminateWhite, [0.64, 0.03, 1.25], [x, CEIL - 0.012, z]);
    lb.box(m.troffer, [0.58, 0.005, 1.18], [x, CEIL - 0.03, z]);
  }
  lb.box(m.galv, [x1 - x0 + PARTITION, 0.05, z1 - z0 + PARTITION], [(x0 + x1 + PARTITION) / 2, H + 0.025, (z0 + z1 - PARTITION) / 2]);
  lid.add(lb.build('office-lid', { cast: false }));

  return { group, lid, layout };
}
