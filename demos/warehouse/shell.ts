import * as THREE from 'three';
import { wallMatrix, type WallDef } from '../../packages/room-runtime/walls';
import { mesh } from '../../packages/room-runtime/helpers';
import { BUILDING } from './config';
import { Batch } from './batch';
import { warehouseMaterials } from './materials';
import { D, EAVE, ENDWALL_Z, FRAME_X, isGable, roofY, T, W, WALL_ORDER, WALLS, wallTopAt, type WallName } from './plan';

/**
 * Building shell: insulated metal-panel walls (liner inside, R-panel and wainscot outside),
 * tapered rigid frames, purlins, the low-slope roof with skylights, gutters and downspouts.
 * Each wall is its own group so the dollhouse cutaway hides it with everything mounted on it;
 * the roof and everything hanging from it is the "ceiling", hidden from above.
 */
export interface Shell {
  walls: { def: WallDef; group: THREE.Group }[];
  roof: THREE.Group;
  /** mount an object on a wall in its local frame (+x along the wall, +y up, +z into the building) */
  mount<T extends THREE.Object3D>(wall: WallName, obj: T, u: number, v: number, out?: number): T;
  wallGroup(wall: WallName): THREE.Group;
}

const P = BUILDING.purlinDepth;

function outline(def: WallDef, name: WallName) {
  const [e0, e1] = def.ext ?? [0, 0];
  const shape = new THREE.Shape();
  const notches = def.openings.filter((o) => o.kind === 'rect' && o.v0 === 0).sort((a, b) => a.u0 - b.u0);
  shape.moveTo(-e0, 0);
  for (const o of notches) {
    if (o.kind !== 'rect') continue;
    shape.lineTo(o.u0, 0);
    shape.lineTo(o.u0, o.v1);
    shape.lineTo(o.u1, o.v1);
    shape.lineTo(o.u1, 0);
  }
  shape.lineTo(def.length + e1, 0);
  shape.lineTo(def.length + e1, wallTopAt(name, def.length + e1));
  if (isGable(name)) shape.lineTo(def.length / 2, wallTopAt(name, def.length / 2));
  shape.lineTo(-e0, wallTopAt(name, -e0));
  shape.closePath();
  for (const o of def.openings) {
    if (o.kind !== 'rect' || o.v0 === 0) continue;
    const hole = new THREE.Path();
    hole.moveTo(o.u0, o.v0);
    hole.lineTo(o.u0, o.v1);
    hole.lineTo(o.u1, o.v1);
    hole.lineTo(o.u1, o.v0);
    hole.closePath();
    shape.holes.push(hole);
  }
  return shape;
}

/** Extruded slab with three material groups: liner (interior face), panel (exterior face and outside-corner ends), trim (jambs, top). */
function slab(def: WallDef, name: WallName) {
  const m = warehouseMaterials();
  const geo = new THREE.ExtrudeGeometry(outline(def, name), { depth: def.thickness, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, -def.thickness);
  const [e0, e1] = def.ext ?? [0, 0];
  const pos = geo.getAttribute('position');
  const groups: number[][] = [[], [], []];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const count = geo.index ? geo.index.count : pos.count;
  const vi = (i: number) => (geo.index ? geo.index.getX(i) : i);
  for (let i = 0; i < count; i += 3) {
    a.fromBufferAttribute(pos, vi(i)); b.fromBufferAttribute(pos, vi(i + 1)); c.fromBufferAttribute(pos, vi(i + 2));
    const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    let g = 2;
    if (n.z > 0.5) g = 0;
    else if (n.z < -0.5) g = 1;
    else if ([a, b, c].every((p) => Math.abs(p.x + e0) < 1e-4) || [a, b, c].every((p) => Math.abs(p.x - def.length - e1) < 1e-4)) g = 1;
    groups[g].push(vi(i), vi(i + 1), vi(i + 2));
  }
  geo.clearGroups();
  geo.setIndex(groups.flat());
  let start = 0;
  groups.forEach((list, k) => { geo.addGroup(start, list.length, k); start += list.length; });
  const s = mesh(geo, [m.wallInterior, m.wallExterior, m.wallTrim], 'slab');
  s.applyMatrix4(wallMatrix(def));
  return s;
}

/** Tapered I-section column in wall-local space: flange at the wall, web, sloped inner flange. */
function column(b: Batch, u: number, height: number, d0: number, d1: number, flange: number) {
  const m = warehouseMaterials();
  const tf = 0.014;
  b.box(m.frame, [flange, height, tf], [u, height / 2, tf / 2]);
  const web = new THREE.Shape([new THREE.Vector2(tf, 0), new THREE.Vector2(d0 - tf, 0), new THREE.Vector2(d1 - tf, height), new THREE.Vector2(tf, height)]);
  const wg = new THREE.ExtrudeGeometry(web, { depth: 0.009, bevelEnabled: false });
  // shape x → wall normal (z), shape y → up, extrusion → along −u (a proper rotation keeps the winding)
  wg.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)).setPosition(u + 0.0045, 0, 0));
  b.add(m.frame, wg);
  b.strut(m.frame, new THREE.Vector3(u, 0, d0 - tf / 2), new THREE.Vector3(u, height, d1 - tf / 2), flange, tf, new THREE.Vector3(0, 0, 1));
  b.box(m.darkSteel, [flange + 0.1, 0.025, d0 + 0.08], [u, 0.0125, d0 / 2]);
  // anchor bolts
  for (const du of [-1, 1]) for (const dz of [0.25, 0.75]) b.cylinder(m.darkSteel, 0.012, 0.06, [u + du * (flange / 2 + 0.02), 0.04, d0 * dz], undefined, 6);
}

function buildWall(def: WallDef, name: WallName) {
  const m = warehouseMaterials();
  const group = new THREE.Group();
  group.name = `wall-${name}`;
  group.add(slab(def, name));

  // structure + panel details in the wall's local frame (u, v, out)
  const b = new Batch();
  const [d0, d1] = BUILDING.columnDepth;
  if (!isGable(name)) {
    // main frame columns at every frame line, the corners included
    for (const x of FRAME_X) {
      const u = name === 'north' ? x + W / 2 : W / 2 - x;
      const uc = Math.min(def.length - BUILDING.flangeWidth / 2, Math.max(BUILDING.flangeWidth / 2, u));
      column(b, uc, EAVE - P, d0, d1, BUILDING.flangeWidth);
    }
    // translucent light-transmitting panels high in each bay, both faces
    const v0 = EAVE - 1.35, v1 = EAVE - 0.45;
    for (let i = 0; i < FRAME_X.length - 1; i++) {
      const u0 = Math.min(Math.abs(FRAME_X[i] + W / 2), Math.abs(FRAME_X[i + 1] + W / 2)) + 0.6;
      const u1 = Math.max(Math.abs(FRAME_X[i] + W / 2), Math.abs(FRAME_X[i + 1] + W / 2)) - 0.6;
      b.box(m.skylight, [u1 - u0, v1 - v0, 0.006], [(u0 + u1) / 2, (v0 + v1) / 2, 0.004]);
      b.box(m.skylight, [u1 - u0, v1 - v0, 0.006], [(u0 + u1) / 2, (v0 + v1) / 2, -def.thickness - 0.004]);
    }
    // gutter and downspouts outside
    const [e0, e1] = def.ext ?? [0, 0];
    b.box(m.wallTrim, [def.length + e0 + e1 + 2 * BUILDING.overhang, 0.16, 0.16], [(def.length + e1 - e0) / 2, EAVE + 0.02, -def.thickness - BUILDING.overhang + 0.08]);
    for (const u of [0.35, def.length / 3, (2 * def.length) / 3, def.length - 0.35]) {
      b.box(m.wallTrim, [0.1, EAVE, 0.075], [u, EAVE / 2 - 0.1, -def.thickness - 0.06]);
      b.box(m.wallTrim, [0.1, 0.075, 0.35], [u, 0.12, -def.thickness - 0.2]);
    }
  } else {
    // end-wall posts up to the rake beam
    for (const z of ENDWALL_Z) {
      const u = name === 'east' ? z + D / 2 : D / 2 - z;
      column(b, u, roofY(z) - P - 0.25, 0.25, 0.25, 0.2);
    }
  }
  const parts = b.build(`wall-${name}-structure`);
  parts.applyMatrix4(wallMatrix(def));
  group.add(parts);
  return group;
}

/** Roof slopes, purlins, rafters, rake beams, skylights, bracing. */
function buildRoof() {
  const m = warehouseMaterials();
  const roof = new THREE.Group();
  roof.name = 'roof';
  const a = Math.atan(BUILDING.pitch);
  const rt = BUILDING.roofThickness, oh = BUILDING.overhang;

  // the two roof slopes: standing seam on top, insulation underneath
  const run = D / 2 + T + oh;
  const len = run / Math.cos(a);
  for (const side of [-1, 1]) {
    const g = new THREE.BoxGeometry(W + 2 * T + 2 * oh, rt, len);
    const pos = g.getAttribute('position');
    // seams run down the slope: project UVs in meters along the panel
    const uv = g.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
    const panel = mesh(g, [m.wallTrim, m.wallTrim, m.roofTop, m.roofUnder, m.wallTrim, m.wallTrim], 'roof-panel');
    const zc = (side * run) / 2;
    panel.position.set(0, roofY(zc) + (rt / 2) / Math.cos(a), zc);
    panel.rotation.x = side * a;
    panel.castShadow = false;
    roof.add(panel);
  }

  const b = new Batch();
  // ridge cap
  b.box(m.roofTop, [W + 2 * T + 2 * oh, 0.06, 0.5], [0, roofY(0) + rt + 0.02, 0]);

  // Z-purlins (drawn as C-sections) from the eave strut to the ridge, both slopes
  const purlinZ: number[] = [];
  for (let s = D / 2 - 0.12; s > 0.25; s -= BUILDING.purlinSpacing) purlinZ.push(s);
  for (const side of [-1, 1]) for (const zz of purlinZ) {
    const z = side * zz, y = roofY(z);
    b.box(m.galv, [W, P, 0.004], [0, y - P / 2, z]);
    b.box(m.galv, [W, 0.004, 0.065], [0, y - 0.002, z + 0.03]);
    b.box(m.galv, [W, 0.004, 0.065], [0, y - P + 0.002, z - 0.03]);
  }

  // tapered rafters on the interior frame lines
  const [r0, r1] = BUILDING.rafterDepth;
  const knee = D / 2 - BUILDING.columnDepth[1];
  const top = (z: number) => roofY(z) - P;
  const bottom = (z: number) => top(z) - (r0 + (r1 - r0) * (1 - Math.abs(z) / knee));
  for (const x of FRAME_X.slice(1, -1)) for (const side of [-1, 1]) {
    const zk = side * knee;
    const web = new THREE.Shape([
      new THREE.Vector2(side * (D / 2 - 0.02), top(zk)), new THREE.Vector2(0, top(0)),
      new THREE.Vector2(0, bottom(0)), new THREE.Vector2(side * (D / 2 - 0.02), bottom(zk) - 0.25),
    ]);
    const wg = new THREE.ExtrudeGeometry(web, { depth: 0.009, bevelEnabled: false });
    wg.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)).setPosition(x + 0.0045, 0, 0));
    b.add(m.frame, wg);
    b.strut(m.frame, new THREE.Vector3(x, top(zk) - 0.007, zk), new THREE.Vector3(x, top(0) - 0.007, 0), 0.22, 0.014);
    b.strut(m.frame, new THREE.Vector3(x, bottom(zk) + 0.007, zk), new THREE.Vector3(x, bottom(0) + 0.007, 0), 0.22, 0.014);
    // knee haunch: sloped flange down to the column's inner face
    b.strut(m.frame, new THREE.Vector3(x, bottom(zk) + 0.007, zk), new THREE.Vector3(x, bottom(zk) - 0.26, side * (D / 2 - 0.02)), 0.22, 0.014);
    // flange braces to the purlins every other purlin
    for (const zz of purlinZ.filter((_, i) => i % 2 === 1)) {
      const z = side * zz;
      b.strut(m.galv, new THREE.Vector3(x - 0.75, roofY(z) - P * 0.5, z), new THREE.Vector3(x, bottom(z) + 0.02, z), 0.03, 0.03);
      b.strut(m.galv, new THREE.Vector3(x + 0.75, roofY(z) - P * 0.5, z), new THREE.Vector3(x, bottom(z) + 0.02, z), 0.03, 0.03);
    }
  }
  for (const x of FRAME_X.slice(1, -1)) b.box(m.darkSteel, [0.3, r1 + 0.06, 0.03], [x, (top(0) + bottom(0)) / 2, 0]);

  // end-wall rake beams
  for (const x of [-W / 2 + 0.13, W / 2 - 0.13]) for (const side of [-1, 1]) {
    b.strut(m.frame, new THREE.Vector3(x, top(side * D / 2) - 0.13, side * D / 2), new THREE.Vector3(x, top(0) - 0.13, 0), 0.2, 0.25);
  }

  // cable X-bracing in the end bays of the roof
  for (const i of [0, FRAME_X.length - 2]) for (const side of [-1, 1]) {
    const x0 = FRAME_X[i], x1 = FRAME_X[i + 1];
    const za = side * (D / 2 - 0.6), zb = side * 0.6;
    b.pipe(m.galv, new THREE.Vector3(x0, roofY(za) - P - 0.05, za), new THREE.Vector3(x1, roofY(zb) - P - 0.05, zb), 0.008, 6);
    b.pipe(m.galv, new THREE.Vector3(x1, roofY(za) - P - 0.05, za), new THREE.Vector3(x0, roofY(zb) - P - 0.05, zb), 0.008, 6);
  }

  // skylight panels: one per bay per slope, in the insulation plane
  for (let i = 0; i < FRAME_X.length - 1; i++) for (const side of [-1, 1]) {
    const xc = (FRAME_X[i] + FRAME_X[i + 1]) / 2, z = side * D / 4;
    b.box(m.skylight, [1.2, 0.01, 3.0], [xc, roofY(z) - 0.006, z], [side * a, 0, 0]);
  }
  const parts = b.build('roof-structure', { cast: false });
  roof.add(parts);
  return roof;
}

export function buildShell(): Shell {
  const walls = WALLS.map((def, i) => ({ def, group: buildWall(def, WALL_ORDER[i]) }));
  const wallGroup = (name: WallName) => walls[WALL_ORDER.indexOf(name)].group;
  return {
    walls,
    roof: buildRoof(),
    wallGroup,
    mount(wall, obj, u, v, out = 0) {
      const def = walls[WALL_ORDER.indexOf(wall)].def;
      obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(def.u, new THREE.Vector3(0, 1, 0), def.n));
      obj.position.copy(def.origin).addScaledVector(def.u, u).add(new THREE.Vector3(0, v, 0)).addScaledVector(def.n, out);
      wallGroup(wall).add(obj);
      return obj;
    },
  };
}
