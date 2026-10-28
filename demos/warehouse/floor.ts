import * as THREE from 'three';
import { mulberry32 } from '../../packages/room-runtime/materials';
import { DOCKS, FT, SITE } from './config';
import { canvas, concreteMaps, toTexture } from './textures';
import { D, DOORS, OFFICE_RECT, RACK, RACK_Z, RACK_Z_END, STAGING, W } from './plan';

/**
 * The sealed concrete slab with everything painted on it, drawn into one canvas from the plan:
 * saw-cut joints, aisle lines, dock safety zones, staging lanes, the pedestrian walkway, tire
 * marks and wear. The map spans the whole floor (uv), micro detail tiles in meters (uv1).
 */
export interface FloorMark { rect: [number, number, number, number]; kind: 'hatch' | 'walk' }

/** `marks`: extra zones from the equipment layout (x0, x1, z0, z1) */
export function buildFloor(marks: FloorMark[] = []) {
  const ppm = Math.min(80, 4096 / Math.max(W, D));
  const cw = Math.round(W * ppm), ch = Math.round(D * ppm);
  const X = (x: number) => (x + W / 2) * ppm, Z = (z: number) => (z + D / 2) * ppm;
  const rand = mulberry32(SITE.seed);

  const map = canvas(cw, ch, (ctx) => {
    ctx.fillStyle = '#b9b7b1';
    ctx.fillRect(0, 0, cw, ch);
    // mottling and trowel variation
    for (let i = 0; i < 700; i++) {
      const x = rand() * cw, y = rand() * ch, r = (0.6 + rand() * 3.5) * ppm;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const light = rand() < 0.5;
      g.addColorStop(0, light ? 'rgba(235,233,226,0.10)' : 'rgba(110,106,98,0.08)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // speckle
    const speck = ctx.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) {
      const v = 128 + (rand() - 0.5) * 120;
      speck.data.set([v, v, v, 18], i * 4);
    }
    const tile = canvas(256, 256, (c) => c.putImageData(speck, 0, 0));
    ctx.fillStyle = ctx.createPattern(tile, 'repeat')!;
    ctx.fillRect(0, 0, cw, ch);

    // tire marks: aisles, the cross aisle and the dock staging area
    ctx.lineCap = 'round';
    const tire = (pts: [number, number][], alpha: number) => {
      ctx.strokeStyle = `rgba(35,33,30,${alpha})`;
      ctx.lineWidth = 0.17 * ppm;
      ctx.beginPath();
      ctx.moveTo(X(pts[0][0]), Z(pts[0][1]));
      for (let i = 1; i < pts.length - 1; i += 2) ctx.quadraticCurveTo(X(pts[i][0]), Z(pts[i][1]), X(pts[i + 1][0]), Z(pts[i + 1][1]));
      ctx.stroke();
    };
    for (const a of RACK.aisles) {
      for (let i = 0; i < 6; i++) {
        const x = a.x0 + (a.x1 - a.x0) * (0.3 + rand() * 0.4);
        tire([[x, RACK_Z[0] + 0.5], [x + (rand() - 0.5) * 0.4, 0], [x + (rand() - 0.5) * 0.2, RACK_Z_END + 1.5]], 0.035 + rand() * 0.03);
        // turns out of the aisle into the cross aisle
        const s = rand() < 0.5 ? -1 : 1;
        tire([[x, RACK_Z_END - 1], [x, RACK_Z_END + 2], [x + s * 3, RACK_Z_END + 2.4]], 0.04);
      }
    }
    for (let i = 0; i < 40; i++) {
      const x = -10 + rand() * (W / 2 + 8), z = RACK_Z_END + 1 + rand() * 3;
      tire([[x - 6, z], [x, z + (rand() - 0.5) * 2], [x + 6, z + (rand() - 0.5)]], 0.03);
    }
    for (const d of DOORS.filter((d) => d.kind === 'dock')) for (let i = 0; i < 5; i++) {
      const x = d.at + (rand() - 0.5) * 1.2;
      tire([[x, D / 2 - 0.3], [x + (rand() - 0.5) * 2, D / 2 - 4], [x + (rand() - 0.5) * 6, RACK_Z_END + 2]], 0.05);
    }
    // oil drips and wear
    for (let i = 0; i < 90; i++) {
      const x = rand() * cw, y = rand() * ch, r = (0.05 + rand() * 0.35) * ppm;
      ctx.fillStyle = `rgba(60,55,48,${0.05 + rand() * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.5 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // saw-cut control joints every 15 ft
    ctx.strokeStyle = 'rgba(70,68,64,0.55)';
    ctx.lineWidth = Math.max(1.5, 0.008 * ppm);
    const joint = 15 * FT;
    ctx.beginPath();
    for (let x = -W / 2 + joint; x < W / 2; x += joint) { ctx.moveTo(X(x), 0); ctx.lineTo(X(x), ch); }
    for (let z = -D / 2 + joint; z < D / 2; z += joint) { ctx.moveTo(0, Z(z)); ctx.lineTo(cw, Z(z)); }
    ctx.stroke();

    // --- painted markings
    const line = (x0: number, z0: number, x1: number, z1: number, color: string, w = 0.1) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w * ppm;
      ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(X(x0), Z(z0)); ctx.lineTo(X(x1), Z(z1)); ctx.stroke();
    };
    const yellow = 'rgba(232,182,26,0.92)', white = 'rgba(236,236,230,0.9)';
    const hatch = (x0: number, z0: number, x1: number, z1: number, a = yellow, b = 'rgba(25,25,25,0.85)') => {
      ctx.save();
      ctx.beginPath(); ctx.rect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0)); ctx.clip();
      ctx.fillStyle = a; ctx.fillRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));
      ctx.strokeStyle = b; ctx.lineWidth = 0.12 * ppm;
      const span = (X(x1) - X(x0)) + (Z(z1) - Z(z0));
      for (let s = -span; s < span; s += 0.3 * ppm) { ctx.beginPath(); ctx.moveTo(X(x0) + s, Z(z0)); ctx.lineTo(X(x0) + s + (Z(z1) - Z(z0)), Z(z1)); ctx.stroke(); }
      ctx.restore();
    };
    // aisle edge lines along every rack face that meets an aisle, with returns at the row ends
    for (const l of RACK.lines) for (const f of l.faces) {
      const x = f < 0 ? l.x0 - 0.12 : l.x1 + 0.12;
      line(x, RACK_Z[0] - 0.05, x, RACK_Z_END + 0.32, yellow);
    }
    for (const l of RACK.lines) line(l.x0 - 0.17, RACK_Z_END + 0.32, l.x1 + 0.17, RACK_Z_END + 0.32, yellow);
    // dock zones: hatched strip ahead of each leveler, staging lanes back toward the racks
    for (const d of DOORS.filter((d) => d.kind === 'dock')) {
      const z0 = D / 2 - DOCKS.leveler[1];
      hatch(d.at - DOCKS.leveler[0] / 2 - 0.15, z0 - 0.75, d.at + DOCKS.leveler[0] / 2 + 0.15, z0 - 0.15);
    }
    for (const s of STAGING) {
      for (const dx of [-1.3, 1.3]) line(s.x + dx, s.z1, s.x + dx, s.z0, white);
      line(s.x - 1.3, s.z1, s.x + 1.3, s.z1, white);
      ctx.fillStyle = white;
      ctx.font = `800 ${0.7 * ppm}px "Helvetica Neue", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`D${s.index + 1}`, X(s.x), Z(s.z1 + 0.95));
    }
    // pedestrian walkway along the office and to the west exit door
    const walk = (x0: number, z0: number, x1: number, z1: number) => {
      ctx.fillStyle = 'rgba(46,130,72,0.55)';
      ctx.fillRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));
      ctx.strokeStyle = yellow; ctx.lineWidth = 0.1 * ppm;
      ctx.strokeRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));
    };
    walk(OFFICE_RECT.x0 + 0.4, OFFICE_RECT.z0 - 1.5, OFFICE_RECT.x1 + 1.5, OFFICE_RECT.z0 - 0.35);
    walk(OFFICE_RECT.x1 + 0.35, OFFICE_RECT.z0 - 1.5, OFFICE_RECT.x1 + 1.5, OFFICE_RECT.z1 - 0.4);
    // crosswalk where the walkway meets the cross aisle
    ctx.fillStyle = white;
    for (let x = OFFICE_RECT.x1 + 0.45; x < OFFICE_RECT.x1 + 1.45; x += 0.3) ctx.fillRect(X(x), Z(OFFICE_RECT.z0 - 2.9), 0.15 * ppm, 1.3 * ppm);
    // equipment zones: hatched (charging bay, keep-clear) or outlined walk areas
    for (const m of marks) {
      if (m.kind === 'hatch') hatch(m.rect[0], m.rect[2], m.rect[1], m.rect[3]);
      else walk(m.rect[0], m.rect[2], m.rect[1], m.rect[3]);
    }
    // STOP at the aisle ends
    ctx.save();
    ctx.fillStyle = white;
    ctx.font = `800 ${0.55 * ppm}px "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    for (const a of RACK.aisles) {
      const x = (a.x0 + a.x1) / 2;
      ctx.fillText('STOP', X(x), Z(RACK_Z_END - 0.25));
      line(a.x0 + 0.3, RACK_Z_END - 0.05, a.x1 - 0.3, RACK_Z_END - 0.05, white, 0.15);
    }
    ctx.restore();
  });

  const color = toTexture(map, true);
  color.wrapS = color.wrapT = THREE.ClampToEdgeWrapping;
  const maps = concreteMaps(17);
  const rough = toTexture(maps.rough, false, [0.35, 0.35]);
  const normal = toTexture(maps.normal, false, [0.35, 0.35]);
  rough.channel = normal.channel = 1;
  const material = new THREE.MeshStandardMaterial({ name: 'floor-slab', map: color, roughnessMap: rough, roughness: 0.95, normalMap: normal, normalScale: new THREE.Vector2(0.35, 0.35) });

  const geo = new THREE.PlaneGeometry(W, D, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position');
  geo.setAttribute('uv1', new THREE.BufferAttribute(Float32Array.from({ length: pos.count * 2 }, (_, i) => (i % 2 ? pos.getZ(i >> 1) : pos.getX(i >> 1))), 2));
  const floor = new THREE.Mesh(geo, material);
  floor.name = 'floor';
  floor.receiveShadow = true;
  return floor;
}
