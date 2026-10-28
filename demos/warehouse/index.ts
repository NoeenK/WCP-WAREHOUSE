import * as THREE from 'three';
import { batchStatic } from '../../packages/room-runtime/batch';
import type { BuiltRoom, RoomLayout, RoomModule } from '../../packages/room-runtime/types';
import { BUILDING } from './config';
import { buildDoors } from './doors';
import { buildEquipment } from './equipment';
import { buildFloor } from './floor';
import { buildLights } from './lights';
import { warehouseMaterials } from './materials';
import { buildOffice } from './office';
import { buildOverhead } from './overhead';
import { D, EAVE, OBSTACLES, RACK, W, layout, walkable } from './plan';
import { buildRacking } from './racking';
import { buildShell } from './shell';
import { buildSite } from './site';

/**
 * The warehouse as a room module for the viewer. A parametric planning model: every
 * dimension comes from config.ts, so it can be corrected to the real building one number at a
 * time. Debug: ?parts=shell,racking,office,equipment,site,overhead (others are skipped),
 * ?shadows=0, ?hemi=, ?key=, ?env=, ?exp= for lighting A/B, ?nobatch to skip merging.
 */
export async function buildWarehouse(): Promise<BuiltRoom> {
  const q = new URLSearchParams(globalThis.location?.search ?? '');
  const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
  const only = q.get('parts')?.split(',');
  const part = (name: string) => !only || only.includes(name);
  OBSTACLES.length = 0;
  warehouseMaterials();

  const group = new THREE.Group();
  group.name = 'warehouse';
  const shell = buildShell();
  group.add(...shell.walls.map((w) => w.group), shell.roof);
  const objects: RoomLayout['objects'] = [];

  group.add(buildDoors(shell));
  const site = buildSite();
  if (part('site')) group.add(site.group);
  if (part('racking')) {
    const racks = buildRacking();
    group.add(racks.group);
    objects.push(...racks.layout);
  }
  let lid: THREE.Object3D | undefined;
  if (part('office')) {
    const office = buildOffice(shell);
    group.add(office.group);
    lid = office.lid;
    group.add(office.lid);
    objects.push(...office.layout);
  }
  let marks: Parameters<typeof buildFloor>[0] = [];
  if (part('equipment')) {
    const equipment = buildEquipment(shell);
    group.add(equipment.group);
    objects.push(...equipment.layout);
    marks = equipment.marks;
  }
  if (part('overhead')) shell.roof.add(buildOverhead());
  group.add(buildFloor(marks));

  const lights = buildLights(site.extent, q);
  const ceiling: THREE.Object3D[] = [shell.roof, ...(lid ? [lid] : [])];
  let optimized: ReturnType<typeof batchStatic> | undefined;
  return {
    layout: layout(objects),
    group,
    lights,
    walls: shell.walls,
    ceiling,
    wallTop: EAVE,
    exposure: num('exp', 1.0),
    bloom: q.has('nobloom') ? undefined : { strength: 0.3, radius: 0.4, threshold: 4 },
    render: {
      toneMapping: THREE.AgXToneMapping,
      shadowType: THREE.PCFShadowMap,
      ao: { radius: 0.9, distanceExponent: 1.3, thickness: 2.5, scale: 1, samples: 16, intensity: 0.75, halfRes: true },
      envSize: 256,
      envBounces: 2,
      envFar: Math.hypot(W, D) + 10,
    },
    optimize(opts) {
      if (!optimized && !q.has('nobatch')) optimized = batchStatic(group, [...shell.walls.map((w) => w.group), ...ceiling], { mergeDynamic: !!opts?.static });
      return optimized;
    },
    walkable,
    camera: {
      orbit: [W * 0.62, Math.max(W, D) * 0.72, D * 1.55],
      target: [1, 1.5, 2],
      walk: [-14.5, 1.6, 4.3],
      walkLook: [(RACK.aisles[1].x0 + RACK.aisles[1].x1) / 2, 1.8, -10],
    },
    environment: { center: [0, EAVE * 0.55, 0], intensity: num('env', 0.7) },
    loadReference: async () => { throw new Error('No scan is attached to the warehouse yet: it is built from config.ts.'); },
    referenceAvailable: false,
    referenceKind: 'layout',
    photos: [],
  };
}

export const warehouse: RoomModule = { id: 'warehouse', label: BUILDING.label, build: buildWarehouse };
