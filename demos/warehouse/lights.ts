import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { OFFICE } from './config';
import { D, DOORS, OFFICE_RECT, T } from './plan';

/**
 * Light budget (forward rendering pays per light per pixel): a soft sky/ground fill, one
 * near-vertical shadowed key that stands in for the grid of high-bay fixtures, daylight spilling
 * through the open dock doors, and the office troffers as one area light.
 * The room's own environment capture adds the bounce off the white liner and roof insulation.
 */
export function buildLights(extent: { x0: number; x1: number; z0: number; z1: number }, q: URLSearchParams) {
  const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
  const lights = new THREE.Group();
  lights.name = 'warehouse-lights';
  RectAreaLightUniformsLib.init();

  lights.add(new THREE.HemisphereLight('#eef2f6', '#8f8b82', num('hemi', 1.15)));

  const key = new THREE.DirectionalLight('#fff6ea', num('key', 2.4));
  key.position.set(4, 60, 7);
  key.target.position.set(0, 0, 0);
  if (q.get('shadows') !== '0') {
    key.castShadow = true;
    const cx = (extent.x0 + extent.x1) / 2, cz = (extent.z0 + extent.z1) / 2;
    const half = Math.max(extent.x1 - extent.x0, extent.z1 - extent.z0) / 2;
    key.position.set(cx + 4, 60, cz + 7);
    key.target.position.set(cx, 0, cz);
    Object.assign(key.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 20, far: 90 });
    key.shadow.mapSize.set(4096, 4096);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    key.shadow.radius = 2;
  }
  lights.add(key, key.target);

  // daylight through each open dock door, facing into the building
  for (const d of DOORS.filter((d) => d.kind === 'dock' && d.open)) {
    const rect = new THREE.RectAreaLight('#dfe8ff', num('dock', 9), d.width, d.height);
    rect.position.set(d.at, d.height / 2, D / 2 + T * 0.5);
    rect.lookAt(d.at, d.height / 2 - 0.6, 0);
    lights.add(rect);
  }

  // office troffers
  const office = new THREE.RectAreaLight('#fff6ec', num('office', 3.2), OFFICE_RECT.x1 - OFFICE_RECT.x0 - 1, OFFICE_RECT.z1 - OFFICE_RECT.z0 - 1);
  office.position.set((OFFICE_RECT.x0 + OFFICE_RECT.x1) / 2, OFFICE.ceiling - 0.05, (OFFICE_RECT.z0 + OFFICE_RECT.z1) / 2);
  office.lookAt(office.position.x, 0, office.position.z);
  lights.add(office);
  return lights;
}
