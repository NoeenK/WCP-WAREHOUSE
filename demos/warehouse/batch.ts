import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boxUV } from '../../packages/room-runtime/helpers';

/**
 * Collects thousands of small parts (rack members, pallet boards, cartons) as transformed
 * geometry per material and merges them into one mesh per material: a whole rack row is a
 * handful of draw calls and no per-part Object3D overhead. Use real Object3Ds for anything
 * that must stay separable (physics props, knolling items).
 */
export class Batch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3(1, 1, 1);
  private p = new THREE.Vector3();

  /** add any geometry with a world (batch-local) matrix; geometry must not be reused afterwards */
  add(material: THREE.Material, geometry: THREE.BufferGeometry, matrix?: THREE.Matrix4) {
    if (matrix) geometry.applyMatrix4(matrix);
    // merging needs matching attribute sets
    if (!geometry.getAttribute('uv')) boxUV(geometry);
    for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
    const g = geometry.index ? geometry : indexed(geometry);
    let list = this.parts.get(material);
    if (!list) this.parts.set(material, (list = []));
    list.push(g);
    return this;
  }

  /** box by size + center, optional Euler rotation (radians, XYZ); UVs in meters */
  box(material: THREE.Material, size: [number, number, number], center: [number, number, number], rot?: [number, number, number], uvScale = 1) {
    const g = boxUV(new THREE.BoxGeometry(...size), uvScale);
    return this.add(material, g, this.matrix(center, rot));
  }

  /** box spanning two points (a beam/brace from a to b) with the given cross-section */
  strut(material: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, w: number, h: number, up = new THREE.Vector3(0, 1, 0)) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const g = boxUV(new THREE.BoxGeometry(w, h, len));
    const z = dir.normalize();
    const x = new THREE.Vector3().crossVectors(Math.abs(z.dot(up)) > 0.99 ? new THREE.Vector3(1, 0, 0) : up, z).normalize();
    const y = new THREE.Vector3().crossVectors(z, x);
    const m = new THREE.Matrix4().makeBasis(x, y, z).setPosition(a.clone().add(b).multiplyScalar(0.5));
    return this.add(material, g, m);
  }

  /** cylinder along y by default; rot rotates it */
  cylinder(material: THREE.Material, r: number, h: number, center: [number, number, number], rot?: [number, number, number], segments = 16, rTop = r) {
    return this.add(material, new THREE.CylinderGeometry(rTop, r, h, segments), this.matrix(center, rot));
  }

  /** pipe between two points */
  pipe(material: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, r: number, segments = 10) {
    const dir = b.clone().sub(a);
    const g = new THREE.CylinderGeometry(r, r, dir.length(), segments, 1, true);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return this.add(material, g, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  }

  matrix(center: [number, number, number], rot?: [number, number, number]) {
    this.e.set(...(rot ?? [0, 0, 0]));
    return this.m.compose(this.p.set(...center), this.q.setFromEuler(this.e), this.s).clone();
  }

  /** a local frame (position + yaw) to build an object's parts in its own coordinates */
  frame(x: number, y: number, z: number, rotY = 0) { return new LocalFrame(this, x, y, z, rotY); }

  get size() { let n = 0; for (const l of this.parts.values()) n += l.length; return n; }

  /** one mesh per material */
  build(name: string, { cast = true, receive = true } = {}) {
    const group = new THREE.Group();
    group.name = name;
    for (const [material, list] of this.parts) {
      const geo = mergeGeometries(list, false);
      if (!geo) continue;
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, material);
      mesh.name = `${name}:${material.name || 'part'}`;
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      group.add(mesh);
      for (const g of list) g.dispose();
    }
    this.parts.clear();
    return group;
  }
}

/** Parts placed relative to an object's origin and yaw, drawn into the parent batch. */
export class LocalFrame {
  readonly base: THREE.Matrix4;
  constructor(private b: Batch, x: number, y: number, z: number, rotY: number) {
    this.base = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(1, 1, 1));
  }
  private local(c: [number, number, number], rot?: [number, number, number]) {
    return new THREE.Matrix4().compose(new THREE.Vector3(...c), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot ?? [0, 0, 0]))), new THREE.Vector3(1, 1, 1)).premultiply(this.base);
  }
  point(x: number, y: number, z: number) { return new THREE.Vector3(x, y, z).applyMatrix4(this.base); }
  box(material: THREE.Material, size: [number, number, number], c: [number, number, number], rot?: [number, number, number]) {
    this.b.add(material, boxUV(new THREE.BoxGeometry(...size)), this.local(c, rot));
    return this;
  }
  cylinder(material: THREE.Material, r: number, h: number, c: [number, number, number], rot?: [number, number, number], segments = 16, rTop = r) {
    this.b.add(material, new THREE.CylinderGeometry(rTop, r, h, segments), this.local(c, rot));
    return this;
  }
  geo(material: THREE.Material, g: THREE.BufferGeometry, c: [number, number, number] = [0, 0, 0], rot?: [number, number, number]) {
    this.b.add(material, g, this.local(c, rot));
    return this;
  }
  strut(material: THREE.Material, a: [number, number, number], b: [number, number, number], w: number, h: number) {
    this.b.strut(material, this.point(...a), this.point(...b), w, h);
    return this;
  }
  pipe(material: THREE.Material, a: [number, number, number], b: [number, number, number], r: number, segments = 10) {
    this.b.pipe(material, this.point(...a), this.point(...b), r, segments);
    return this;
  }
}

function indexed(g: THREE.BufferGeometry) {
  const count = g.getAttribute('position').count;
  g.setIndex(Array.from({ length: count }, (_, i) => i));
  return g;
}

/** Transform helper: place a part group in a parent frame (x, y, z, rotY). */
export function at<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number, rotY = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = rotY;
  return obj;
}
