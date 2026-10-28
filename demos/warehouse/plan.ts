import * as THREE from 'three';
import type { Opening, WallDef } from '../../packages/room-runtime/walls';
import type { RoomLayout } from '../../packages/room-runtime/types';
import { BUILDING, DOCKS, DRIVE_IN, MAN_DOOR, MAN_DOORS, OFFICE, RACKS } from './config';

/**
 * Everything derived from config.ts: wall definitions and openings, frame lines, rack rows and
 * aisles, the office footprint, and the walkable test. Geometry modules read positions from here,
 * never from hard-coded numbers, so editing the config moves the whole building consistently.
 */
export const W = BUILDING.width;
export const D = BUILDING.depth;
export const T = BUILDING.wallThickness;
export const EAVE = BUILDING.eave;
export const RIDGE = EAVE + BUILDING.pitch * (D / 2);

/** underside of the roof panel at z (interior) */
export const roofY = (z: number) => EAVE + BUILDING.pitch * (D / 2 - Math.min(Math.abs(z), D / 2));

export type WallName = 'north' | 'east' | 'south' | 'west';

/** Frame lines along x (main rigid frames), including both end walls. */
export const FRAME_X = Array.from({ length: BUILDING.bays + 1 }, (_, i) => -W / 2 + (W / BUILDING.bays) * i);
/** End-wall column lines along z, excluding the corners. */
export const ENDWALL_Z = Array.from({ length: BUILDING.endwallBays - 1 }, (_, i) => -D / 2 + (D / BUILDING.endwallBays) * (i + 1));

// --- racking -----------------------------------------------------------------------------

export interface RackLine {
  /** x range of the frame depth */
  x0: number;
  x1: number;
  /** side(s) facing an aisle: -1 = west face, +1 = east face */
  faces: (-1 | 1)[];
  row: number;
}
export interface Aisle { x0: number; x1: number; letter: string }

const RACK_Z0 = -D / 2 + RACKS.northClear;
const RACK_PITCH = RACKS.bayClear + RACKS.upright;
export const RACK_Z = Array.from({ length: RACKS.bays + 1 }, (_, i) => RACK_Z0 + RACKS.upright / 2 + i * RACK_PITCH);
export const RACK_Z_END = RACK_Z[RACK_Z.length - 1] + RACKS.upright / 2;

function rackLayout() {
  const fd = RACKS.frameDepth, dbl = 2 * fd + RACKS.flue;
  const x0 = -W / 2 + RACKS.sideClear, x1 = W / 2 - RACKS.sideClear;
  const span = x1 - x0;
  // single rows against both side walls, as many back-to-back doubles as fit between
  const doubles = Math.max(0, Math.floor((span - 2 * fd - RACKS.aisleMin) / (dbl + RACKS.aisleMin)));
  const aisle = (span - 2 * fd - doubles * dbl) / (doubles + 1);
  const lines: RackLine[] = [], aisles: Aisle[] = [];
  let x = x0, row = 0;
  lines.push({ x0: x, x1: x + fd, faces: [1], row: row++ });
  x += fd;
  for (let i = 0; i <= doubles; i++) {
    aisles.push({ x0: x, x1: x + aisle, letter: String.fromCharCode(65 + i) });
    x += aisle;
    if (i === doubles) break;
    lines.push({ x0: x, x1: x + fd, faces: [-1], row });
    lines.push({ x0: x + fd + RACKS.flue, x1: x + dbl, faces: [1], row: row++ });
    x += dbl;
  }
  lines.push({ x0: x, x1: x + fd, faces: [-1], row });
  return { lines, aisles, aisle };
}
export const RACK = rackLayout();

/** Pallet slots per bay, as z centers within the bay starting at RACK_Z[k]. */
export function slotCenters(k: number) {
  const a = RACK_Z[k] + RACKS.upright / 2, b = RACK_Z[k + 1] - RACKS.upright / 2;
  return [a + (b - a) * 0.25, a + (b - a) * 0.75];
}

// --- doors and openings ----------------------------------------------------------------

/** Keep personnel doors off frame columns. */
function clearOfColumns(x: number, lines: number[], half: number) {
  for (const c of lines) if (Math.abs(x - c) < half + 0.35) return c + Math.sign(x - c || 1) * (half + 0.4);
  return x;
}

function resolveAt(at: number | 'aisle-west' | 'aisle-east') {
  if (typeof at === 'number') return at;
  const list = RACK.aisles;
  const a = at === 'aisle-west' ? list[1] ?? list[0] : list[Math.max(0, list.length - 2)];
  return clearOfColumns((a.x0 + a.x1) / 2, FRAME_X, MAN_DOOR.width / 2);
}

export interface Door {
  wall: WallName;
  kind: 'dock' | 'drive-in' | 'man' | 'entrance';
  /** world coordinate along the wall: x for north/south, z for east/west */
  at: number;
  width: number;
  height: number;
  open?: boolean;
  exit?: boolean;
  index?: number;
}

export const DOORS: Door[] = [
  ...DOCKS.centers.map((x, i): Door => ({ wall: 'south', kind: 'dock', at: x, width: DOCKS.width, height: DOCKS.height, open: DOCKS.open.includes(i), index: i })),
  { wall: DRIVE_IN.wall, kind: 'drive-in', at: DRIVE_IN.at, width: DRIVE_IN.width, height: DRIVE_IN.height },
  ...MAN_DOORS.map((d): Door => ({ wall: d.wall, kind: 'man', at: resolveAt(d.at), width: MAN_DOOR.width, height: MAN_DOOR.height, exit: d.exit })),
  { wall: 'south', kind: 'entrance', at: OFFICE.entrance, width: 6 * 0.3048, height: 7.5 * 0.3048 },
];

export interface Window { wall: WallName; at: number; width: number; sill: number; head: number }
export const WINDOWS: Window[] = [
  ...OFFICE.southWindows.map((x): Window => ({ wall: 'south', at: x, width: OFFICE.window.width, sill: OFFICE.window.sill, head: OFFICE.window.head })),
  ...OFFICE.westWindows.map((z): Window => ({ wall: 'west', at: z, width: OFFICE.window.width, sill: OFFICE.window.sill, head: OFFICE.window.head })),
];

// --- walls -------------------------------------------------------------------------------

/** wall origin/u/n per the modeling reference (origin = interior face, left end, floor) */
const FRAMES: Record<WallName, { origin: THREE.Vector3; u: THREE.Vector3; n: THREE.Vector3; length: number }> = {
  north: { origin: new THREE.Vector3(-W / 2, 0, -D / 2), u: new THREE.Vector3(1, 0, 0), n: new THREE.Vector3(0, 0, 1), length: W },
  east: { origin: new THREE.Vector3(W / 2, 0, -D / 2), u: new THREE.Vector3(0, 0, 1), n: new THREE.Vector3(-1, 0, 0), length: D },
  south: { origin: new THREE.Vector3(W / 2, 0, D / 2), u: new THREE.Vector3(-1, 0, 0), n: new THREE.Vector3(0, 0, -1), length: W },
  west: { origin: new THREE.Vector3(-W / 2, 0, D / 2), u: new THREE.Vector3(0, 0, -1), n: new THREE.Vector3(1, 0, 0), length: D },
};
export const WALL_ORDER: WallName[] = ['north', 'east', 'south', 'west'];

/** world position along a wall (x on north/south, z on east/west) → wall u */
export function uOf(wall: WallName, at: number) {
  switch (wall) {
    case 'north': return at + W / 2;
    case 'east': return at + D / 2;
    case 'south': return W / 2 - at;
    case 'west': return D / 2 - at;
  }
}

/** gable end walls (east/west) rise with the roof; the long walls stop at the eave */
export const isGable = (wall: WallName) => wall === 'east' || wall === 'west';
/** wall top at u, to the top of the roof panel */
export function wallTopAt(wall: WallName, u: number) {
  const top = EAVE + BUILDING.roofThickness;
  if (!isGable(wall)) return top;
  return top + BUILDING.pitch * (D / 2 - Math.abs(u - D / 2));
}

export const WALLS: WallDef[] = WALL_ORDER.map((name) => {
  const f = FRAMES[name];
  const openings: Opening[] = [
    ...DOORS.filter((d) => d.wall === name).map((d): Opening => {
      const u = uOf(name, d.at);
      return { kind: 'rect', u0: u - d.width / 2, u1: u + d.width / 2, v0: 0, v1: d.height };
    }),
    ...WINDOWS.filter((w) => w.wall === name).map((w): Opening => {
      const u = uOf(name, w.at);
      return { kind: 'rect', u0: u - w.width / 2, u1: u + w.width / 2, v0: w.sill, v1: w.head };
    }),
  ];
  return {
    name,
    origin: f.origin.clone(),
    u: f.u.clone(),
    n: f.n.clone(),
    length: f.length,
    thickness: T,
    openings,
    panels: [],
    height: wallTopAt(name, f.length / 2),
    crown: false,
    // the long walls wrap the corners; the gable ends butt into them
    ext: isGable(name) ? [0, 0] : [T, T],
  };
});
export const wallByName = (name: WallName) => WALLS[WALL_ORDER.indexOf(name)];

// --- office ------------------------------------------------------------------------------

export const OFFICE_RECT = { x0: -W / 2, x1: -W / 2 + OFFICE.width, z0: D / 2 - OFFICE.depth, z1: D / 2 };
export const PARTITION = 0.13;

// --- dock staging, equipment spots -------------------------------------------------------

/** Staging lane per dock door, from the leveler back toward the racks. */
export const STAGING = DOORS.filter((d) => d.kind === 'dock').map((d) => ({
  x: d.at,
  z0: D / 2 - DOCKS.leveler[1] - 0.9,
  z1: Math.max(RACK_Z_END + 4.2, D / 2 - DOCKS.leveler[1] - 7.8),
  index: d.index!,
}));

/** Footprints that walkers stay out of (x0, x1, z0, z1). */
export const OBSTACLES: [number, number, number, number][] = [];
export function addObstacle(x0: number, x1: number, z0: number, z1: number) {
  OBSTACLES.push([Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1)]);
}

/** Office partition segments with the door gap, as [x0, z0, x1, z1]. */
export function partitionSegments(): [number, number, number, number][] {
  const { x0, x1, z0, z1 } = OFFICE_RECT;
  const d0 = OFFICE.warehouseDoor - 0.5, d1 = OFFICE.warehouseDoor + 0.5;
  return [[x0, z0, d0, z0], [d1, z0, x1, z0], [x1, z0, x1, z1]];
}

const segmentDistance = (px: number, pz: number, [ax, az, bx, bz]: [number, number, number, number]) => {
  const dx = bx - ax, dz = bz - az, len = dx * dx + dz * dz;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
};

export function walkable(x: number, z: number) {
  const m = 0.35;
  if (x < -W / 2 + m || x > W / 2 - m || z < -D / 2 + m || z > D / 2 - m) return false;
  for (const l of RACK.lines) if (x > l.x0 - 0.2 && x < l.x1 + 0.2 && z > RACK_Z0 - 0.2 && z < RACK_Z_END + 0.2) return false;
  for (const s of partitionSegments()) if (segmentDistance(x, z, s) < 0.3) return false;
  for (const [a, b, c, d] of OBSTACLES) if (x > a - 0.25 && x < b + 0.25 && z > c - 0.25 && z < d + 0.25) return false;
  return true;
}

// --- overhead plan -----------------------------------------------------------------------

export function layout(objects: RoomLayout['objects']): RoomLayout {
  const plan = (v: THREE.Vector3) => [+v.x.toFixed(3), +v.z.toFixed(3)];
  return {
    note: `Planning model from config.ts (not yet measured). ${RACK.lines.length} rack rows × ${RACKS.bays} bays × ${RACKS.levels.length + 1} levels; ${RACK.aisles.length} aisles of ${RACK.aisle.toFixed(2)} m; ${DOCKS.centers.length} dock doors.`,
    polygon: [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]],
    walls: WALLS.map((w) => ({
      a: plan(w.origin),
      b: plan(w.origin.clone().addScaledVector(w.u, w.length)),
      u: w.u.toArray(),
      length: w.length,
      openings: w.openings.map((o) => ({ kind: o.kind === 'rect' && o.v0 > 0 ? 'window' : 'door', u0: o.u0, u1: o.u1 })),
    })),
    objects,
  };
}


/** Fire sprinkler riser on the north wall, in the aisle east of center. */
export const RISER_X = (() => {
  const a = RACK.aisles[Math.min(RACK.aisles.length - 1, Math.floor(RACK.aisles.length / 2) + 1)];
  return clearOfColumns(a.x0 + (a.x1 - a.x0) * 0.3, FRAME_X, 0.15);
})();
/** Electrical service on the north wall, in the aisle west of center. */
export const SERVICE_X = (() => {
  const a = RACK.aisles[Math.max(0, Math.floor(RACK.aisles.length / 2) - 1)];
  return clearOfColumns((a.x0 + a.x1) / 2, FRAME_X, 0.9);
})();
