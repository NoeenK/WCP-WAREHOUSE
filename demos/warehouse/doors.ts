import * as THREE from 'three';
import { BUILDING, DOCKS, OFFICE } from './config';
import { Batch } from './batch';
import { signMaterial, warehouseMaterials } from './materials';
import { D, DOORS, T, WINDOWS, uOf, addObstacle, type Door } from './plan';
import type { Shell } from './shell';

/**
 * Doors and windows. Everything fixed to a wall is built in that wall's local frame
 * (x along the wall, y up, z into the building, origin at the opening's center on the floor)
 * and mounted into the wall group so the cutaway hides it with the wall. Dock levelers and
 * bollards sit in the floor, outside the wall groups.
 */
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** a sign face: a 0..1-UV plane, facing +z (or −z when flipped) */
function signFace(b: Batch, material: THREE.Material, w: number, h: number, c: [number, number, number], flip = false) {
  const g = new THREE.PlaneGeometry(w, h);
  if (flip) g.rotateY(Math.PI);
  b.add(material, g, new THREE.Matrix4().makeTranslation(...c));
}

function sectionalDoor(b: Batch, w: number, h: number, open: boolean, windows: number) {
  const m = warehouseMaterials();
  const sections = Math.max(4, Math.round(h / 0.76));
  const sh = h / sections;
  if (!open) {
    for (let i = 0; i < sections; i++) {
      b.box(m.doorPanel, [w + 0.08, sh - 0.004, 0.045], [0, (i + 0.5) * sh, 0.05]);
      if (i === sections - 2 && windows) for (let k = 0; k < windows; k++) {
        const x = -w / 2 + (w * (k + 0.5)) / windows;
        b.box(m.blackPlastic, [0.55, 0.13, 0.05], [x, (i + 0.5) * sh, 0.05]);
      }
    }
    b.box(m.rubber, [w + 0.04, 0.03, 0.05], [0, 0.015, 0.05]);
    b.box(m.darkSteel, [0.12, 0.03, 0.04], [0, 0.55, 0.09]);
  } else {
    // raised: the sections ride the horizontal tracks overhead
    b.box(m.doorPanel, [w + 0.08, 0.045, h], [0, h + 0.33, 0.14 + h / 2]);
    b.box(m.rubber, [w + 0.04, 0.05, 0.03], [0, h + 0.33, 0.13]);
  }
  // tracks, torsion spring shaft and operator
  for (const s of [-1, 1]) {
    const x = s * (w / 2 + 0.07);
    b.box(m.galv, [0.05, h + 0.32, 0.06], [x, (h + 0.32) / 2, 0.09]);
    b.box(m.galv, [0.05, 0.06, h + 0.45], [x, h + 0.38, 0.12 + (h + 0.45) / 2]);
    b.box(m.galv, [0.04, 0.9, 0.04], [x, h + 0.85, h + 0.5]);
    b.cylinder(m.darkSteel, 0.06, 0.7, [s * (w / 4), h + 0.55, 0.16], [0, 0, Math.PI / 2], 12);
  }
  b.cylinder(m.galv, 0.025, w + 0.3, [0, h + 0.55, 0.16], [0, 0, Math.PI / 2], 8);
  b.box(m.grayMachine, [0.36, 0.4, 0.3], [w / 2 + 0.36, h + 0.5, 0.2]);
}

function dockDoor(shell: Shell, d: Door) {
  const m = warehouseMaterials();
  const b = new Batch();
  const { width: w, height: h } = d;
  const open = !!d.open;
  sectionalDoor(b, w, h, open, 3);
  // exterior: foam seal pads with guide stripes, bumpers, truck restraint, signal lights
  for (const s of [-1, 1]) {
    b.box(m.rubber, [0.25, h + 0.28, 0.3], [s * (w / 2 + 0.15), (h + 0.28) / 2 + 0.03, -T - 0.15]);
    b.box(m.safetyYellow, [0.05, h * 0.65, 0.006], [s * (w / 2 + 0.15), h * 0.45, -T - 0.302]);
    b.box(m.darkSteel, [0.16, 0.38, 0.012], [s * (w / 2 - 0.12), -0.27, -T - 0.006]);
    b.box(m.rubber, [0.12, 0.32, 0.115], [s * (w / 2 - 0.12), -0.27, -T - 0.07]);
  }
  b.box(m.rubber, [w + 0.55, 0.32, 0.3], [0, h + 0.16, -T - 0.15]);
  b.box(m.safetyYellow, [0.36, 0.22, 0.2], [0, -0.72, -T - 0.1]);
  b.box(m.darkSteel, [0.06, 0.32, 0.08], [0, -0.48, -T - 0.2]);
  const lamp = (color: string, on: boolean) => new THREE.MeshStandardMaterial({ name: `signal-${color}-${on}`, color, emissive: color, emissiveIntensity: on ? 3 : 0.05, roughness: 0.3 });
  b.box(m.darkSteel, [0.14, 0.32, 0.06], [-(w / 2 + 0.5), 1.6, -T - 0.03]);
  b.cylinder(lamp('#e3261c', !open), 0.045, 0.03, [-(w / 2 + 0.5), 1.68, -T - 0.065], [Math.PI / 2, 0, 0], 12);
  b.cylinder(lamp('#2cc443', open), 0.045, 0.03, [-(w / 2 + 0.5), 1.52, -T - 0.065], [Math.PI / 2, 0, 0], 12);
  // numbers: outside above the seal, inside above the spring shaft
  const num = signMaterial(String(d.index! + 1), { w: 0.6, h: 0.6, bg: '#151515', fg: '#f4f4f0', border: '#f1bd12' });
  signFace(b, num, 0.6, 0.6, [0, h + 0.7, -T - 0.004], true);
  signFace(b, num, 0.6, 0.6, [0, h + 1.05, 0.004]);
  // inside: dock light on an articulating arm, leveler controls
  const lx = w / 2 + 0.45;
  b.box(m.darkSteel, [0.1, 0.18, 0.06], [lx, 2.45, 0.03]);
  b.pipe(m.darkSteel, v(lx, 2.45, 0.06), v(lx - 0.25, 2.5, 0.65), 0.018);
  b.pipe(m.darkSteel, v(lx - 0.25, 2.5, 0.65), v(lx - 0.75, 2.35, 0.95), 0.016);
  b.cylinder(m.grayMachine, 0.13, 0.18, [lx - 0.82, 2.33, 0.98], [Math.PI / 2, 0.6, 0], 16, 0.09);
  b.cylinder(open ? m.lens : m.chrome, 0.12, 0.01, [lx - 0.86, 2.33, 0.92], [Math.PI / 2, 0.6, 0], 16);
  b.box(m.grayMachine, [0.26, 0.36, 0.12], [-(w / 2 + 0.5), 1.35, 0.06]);
  for (const [y, c] of [[1.43, '#2cc443'], [1.35, '#e3261c'], [1.27, '#f1bd12']] as const) b.cylinder(lamp(c, false), 0.02, 0.02, [-(w / 2 + 0.5), y, 0.125], [Math.PI / 2, 0, 0], 10);
  shell.mount(d.wall, b.build(`dock-door-${d.index! + 1}`), uOf(d.wall, d.at), 0, 0);
}

function driveIn(shell: Shell, d: Door) {
  const b = new Batch();
  sectionalDoor(b, d.width, d.height, false, 4);
  shell.mount(d.wall, b.build('drive-in-door'), uOf(d.wall, d.at), 0, 0);
}

function manDoor(shell: Shell, d: Door) {
  const m = warehouseMaterials();
  const b = new Batch();
  const { width: w, height: h } = d;
  for (const s of [-1, 1]) b.box(m.wallTrim, [0.05, h + 0.05, T + 0.03], [s * (w / 2 + 0.025), (h + 0.05) / 2, -T / 2]);
  b.box(m.wallTrim, [w + 0.1, 0.05, T + 0.03], [0, h + 0.025, -T / 2]);
  b.box(m.manDoor, [w - 0.006, h - 0.006, 0.045], [0, h / 2, -T / 2]);
  // panic bar inside, lever outside, closer
  b.box(m.chrome, [w * 0.72, 0.05, 0.05], [0.02, 1.0, -T / 2 + 0.06]);
  for (const s of [-1, 1]) b.box(m.darkSteel, [0.08, 0.12, 0.07], [0.02 + s * w * 0.37, 1.0, -T / 2 + 0.05]);
  b.box(m.chrome, [0.12, 0.02, 0.03], [w / 2 - 0.14, 1.0, -T / 2 - 0.05]);
  b.box(m.darkSteel, [0.3, 0.06, 0.06], [-w / 4, h - 0.1, -T / 2 + 0.06]);
  if (d.exit) {
    b.box(m.laminateWhite, [0.36, 0.2, 0.06], [0, h + 0.32, 0.03]);
    signFace(b, m.exitSign, 0.32, 0.16, [0, h + 0.32, 0.061]);
  }
  // bollards inside the door swing on the warehouse side are omitted: personnel doors open out
  shell.mount(d.wall, b.build('man-door'), uOf(d.wall, d.at), 0, 0);
}

function entrance(shell: Shell, d: Door) {
  const m = warehouseMaterials();
  const b = new Batch();
  const { width: w, height: h } = d;
  const z = -T / 2, f = 0.05;
  for (const s of [-1, 1]) b.box(m.storefront, [f, h, 0.12], [s * (w / 2 - f / 2), h / 2, z]);
  b.box(m.storefront, [w, f, 0.12], [0, h - f / 2, z]);
  // two glass leaves with wide stiles and a deep bottom rail
  for (const s of [-1, 1]) {
    const cx = (s * (w / 2 - f)) / 2, lw = w / 2 - f - 0.006, lh = h - f - 0.01;
    b.box(m.storefront, [0.09, lh, 0.045], [cx - lw / 2 + 0.045, lh / 2, z]);
    b.box(m.storefront, [0.09, lh, 0.045], [cx + lw / 2 - 0.045, lh / 2, z]);
    b.box(m.storefront, [lw, 0.09, 0.045], [cx, lh - 0.045, z]);
    b.box(m.storefront, [lw, 0.25, 0.045], [cx, 0.125, z]);
    const glass = new THREE.PlaneGeometry(lw - 0.18, lh - 0.34);
    b.add(m.glass, glass, new THREE.Matrix4().makeTranslation(cx, 0.25 + (lh - 0.34) / 2, z));
    for (const side of [-1, 1]) b.cylinder(m.chrome, 0.014, 0.6, [cx - s * (lw / 2 - 0.16), 1.05, z + side * 0.07], undefined, 10);
  }
  // canopy over the entrance, hung on tie rods
  b.box(m.wallTrim, [w + 1.6, 0.16, 1.5], [0, h + 0.55, -T - 0.75]);
  for (const s of [-1, 1]) b.pipe(m.galv, v(s * (w / 2 + 0.6), h + 0.62, -T - 1.45), v(s * (w / 2 + 0.6), h + 1.6, -T), 0.012);
  shell.mount(d.wall, b.build('office-entrance'), uOf(d.wall, d.at), 0, 0);
}

function windows(shell: Shell) {
  const m = warehouseMaterials();
  for (const win of WINDOWS) {
    const b = new Batch();
    const { width: w } = win, h = win.head - win.sill;
    const f = 0.05;
    for (const s of [-1, 1]) b.box(m.storefront, [f, h, 0.1], [s * (w / 2 - f / 2), win.sill + h / 2, -T / 2]);
    b.box(m.storefront, [w, f, 0.1], [0, win.head - f / 2, -T / 2]);
    b.box(m.storefront, [w, f, 0.1], [0, win.sill + f / 2, -T / 2]);
    b.box(m.storefront, [0.04, h, 0.1], [0, win.sill + h / 2, -T / 2]);
    b.add(m.glass, new THREE.PlaneGeometry(w - 2 * f, h - 2 * f), new THREE.Matrix4().makeTranslation(0, win.sill + h / 2, -T / 2));
    b.box(m.wallTrim, [w + 0.1, 0.03, 0.12], [0, win.sill - 0.015, -T - 0.05]);
    b.box(m.laminateWhite, [w + 0.1, 0.025, 0.16], [0, win.sill - 0.0125, 0.06]);
    shell.mount(win.wall, b.build('office-window'), uOf(win.wall, win.at), 0, 0);
  }
}

/** Building sign above the office entrance (front wall, outside). */
function buildingSign(shell: Shell) {
  const m = warehouseMaterials();
  const b = new Batch();
  const w = Math.min(OFFICE.width - 1.5, 8), h = 1.1;
  b.box(m.storefront, [w + 0.2, h + 0.2, 0.08], [0, 0, -0.04]);
  signFace(b, signMaterial(BUILDING.sign, { w, h, bg: '#1f3a5f', fg: '#ffffff', glow: 0.4 }), w, h, [0, 0, -0.082], true);
  shell.mount('south', b.build('building-sign'), uOf('south', OFFICE.entrance - 0.3), 4.7, -T);
}

export function buildDoors(shell: Shell) {
  const m = warehouseMaterials();
  for (const d of DOORS) {
    if (d.kind === 'dock') dockDoor(shell, d);
    else if (d.kind === 'drive-in') driveIn(shell, d);
    else if (d.kind === 'man') manDoor(shell, d);
    else entrance(shell, d);
  }
  windows(shell);
  buildingSign(shell);

  // floor hardware: dock levelers (lips out at open doors) and bollards
  const b = new Batch();
  const [lw, ld] = DOCKS.leveler;
  for (const d of DOORS.filter((d) => d.kind === 'dock')) {
    const z0 = D / 2 - ld;
    b.box(m.treadPlate, [lw, 0.012, ld], [d.at, 0.006, z0 + ld / 2]);
    b.box(m.darkSteel, [lw + 0.1, 0.008, 0.06], [d.at, 0.004, z0 - 0.03]);
    for (const s of [-1, 1]) b.box(m.hazard, [0.07, 0.008, ld], [d.at + s * (lw / 2 + 0.035), 0.004, z0 + ld / 2]);
    if (d.open) b.box(m.treadPlate, [lw, 0.016, 0.45], [d.at, 0.012, D / 2 + T + 0.15]);
    for (const s of [-1, 1]) {
      const x = d.at + s * (d.width / 2 + 0.32), z = D / 2 - 0.4;
      b.cylinder(m.safetyYellow, 0.084, 1.2, [x, 0.6, z], undefined, 16);
      b.add(m.safetyYellow, new THREE.SphereGeometry(0.084, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.Matrix4().makeTranslation(x, 1.2, z));
      addObstacle(x - 0.1, x + 0.1, z - 0.1, z + 0.1);
    }
  }
  // drive-in door: bollards inside both jambs
  for (const d of DOORS.filter((d) => d.kind === 'drive-in')) for (const s of [-1, 1]) {
    const x = (d.wall === 'east' ? 1 : -1) * (BUILDING.width / 2 - 0.4), z = d.at + s * (d.width / 2 + 0.32);
    b.cylinder(m.safetyYellow, 0.084, 1.2, [x, 0.6, z], undefined, 16);
    b.add(m.safetyYellow, new THREE.SphereGeometry(0.084, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.Matrix4().makeTranslation(x, 1.2, z));
  }
  return b.build('dock-floor-hardware');
}
