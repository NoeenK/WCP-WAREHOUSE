import * as THREE from 'three';
import {
  asphalt, carpetTile, cartonTops, ceilingGrid, concreteMaps, fbm, fieldCanvas, hazardStripes, heightStrip,
  neutralNoise, normalCanvas, profileNormal, PROFILES, sign, toTexture, uprightSlots, wireMesh, woodGrain, wrapMaps,
} from './textures';
import { FT } from './config';

/**
 * The warehouse palette. Created inside build() (canvas textures need the DOM), then shared.
 * Colors are typical finishes, not sampled from photographs: adjust them to match the building.
 */
let palette: ReturnType<typeof createPalette> | undefined;
export const warehouseMaterials = () => (palette ??= createPalette());
export type WarehouseMaterials = ReturnType<typeof createPalette>;

const std = (o: THREE.MeshStandardMaterialParameters & { name: string }) => new THREE.MeshStandardMaterial(o);

function diamondPlate() {
  const size = 128;
  const field = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // two staggered rows of raised lozenges at right angles
    const lozenge = (cx: number, cy: number, ax: number, ay: number) => {
      const dx = (((x - cx) % size) + size * 1.5) % size - size / 2, dy = (((y - cy) % size) + size * 1.5) % size - size / 2;
      const u = (dx * ax + dy * ay) / 22, v = (-dx * ay + dy * ax) / 5;
      return Math.max(0, 1 - Math.sqrt(u * u + v * v));
    };
    const s = Math.SQRT1_2;
    field[y * size + x] = Math.min(1, lozenge(32, 32, s, s) + lozenge(96, 96, s, -s) * 1 + lozenge(96, 32, s, -s) + lozenge(32, 96, s, s));
  }
  return normalCanvas(field.map((v) => Math.min(1, v * 2)), size, size, 3);
}

function createPalette() {
  const concrete = concreteMaps();
  const concreteRough = toTexture(concrete.rough, false, [0.5, 0.5]);
  const concreteNormal = toTexture(concrete.normal, false, [0.5, 0.5]);

  // walls: exterior wainscot band and panel color by height, R-panel ribs every 12"
  const exteriorStrip = toTexture(heightStrip([{ to: 1.05, color: '#6d7276' }, { to: 1.12, color: '#3e4246' }, { to: 12, color: '#d9d6cc' }], 12,
    { to: 0.6, color: 'rgba(60,55,45,0.35)' }), true, [1, 1 / 12]);
  exteriorStrip.wrapT = THREE.ClampToEdgeWrapping;
  const interiorStrip = toTexture(heightStrip([{ to: 2.44, color: '#c9ccce' }, { to: 2.5, color: '#9da2a6' }, { to: 12, color: '#f1f1ee' }], 12,
    { to: 0.35, color: 'rgba(70,70,70,0.25)' }), true, [1, 1 / 12]);
  interiorStrip.wrapT = THREE.ClampToEdgeWrapping;
  const rPanel = toTexture(profileNormal(PROFILES.rPanel, 128, 9), false, [1 / FT, 1]);
  const liner = toTexture(profileNormal(PROFILES.liner, 64, 4), false, [1 / (0.305), 1]);
  const seam = toTexture(profileNormal(PROFILES.standingSeam, 128, 10), false, [1 / (2 * FT), 1]);

  const insulation = toTexture(neutralNoise(41, [[4, 0.4], [32, 0.6]], 0.95, 0.06), true, [0.25, 0.25]);

  const uprightMap = toTexture(uprightSlots('#24569f'), true, [1 / (3 * 0.0254), 1 / (2 * 0.0254)]);
  uprightMap.offset.set(0.5, 0.5);
  const wire = toTexture(wireMesh(), true, [1 / 0.127, 1 / 0.1016]);

  const woods = [41, 42, 43].map((seed) => toTexture(woodGrain(seed), true, [1 / 0.8, 1 / 0.8]));
  const cardboard = toTexture(neutralNoise(51, [[6, 0.2], [40, 0.3], [160, 0.5]], 0.9, 0.16, [0.4, 2.5]), true, [1 / 0.45, 1 / 0.45]);
  const wrap = wrapMaps(61);
  const wrapColor = toTexture(wrap.color, true, [1 / 1.1, 1 / 1.1]);
  const wrapNormal = toTexture(wrap.normal, false, [1 / 1.1, 1 / 1.1]);
  const cartonTop = toTexture(cartonTops(3, 2), true, [1 / 1.016, 1 / 1.219]);
  const woven = toTexture(neutralNoise(71, [[64, 0.5], [128, 0.5]], 0.92, 0.12), true, [3, 3]);

  const hazard = toTexture(hazardStripes(), true, [1 / 0.3, 1 / 0.3]);
  const doorGroove = toTexture(profileNormal(PROFILES.doorGroove, 128, 6), false, [1 / 0.762, 1]);
  doorGroove.rotation = Math.PI / 2;
  const trailerPosts = toTexture(profileNormal(PROFILES.trailerPost, 64, 5), false, [1 / 0.6, 1]);
  const plate = toTexture(diamondPlate(), false, [1 / 0.05, 1 / 0.05]);

  const asphaltMap = toTexture(asphalt(), true, [0.2, 0.2]);
  const grassMap = toTexture(fieldCanvas(fbm(256, 81, [[8, 0.3], [64, 0.3], [256, 0.4]]), 256, (v) => {
    const g = 0.75 + (v - 0.5) * 0.4;
    return [Math.round(g * 255), Math.round(g * 255), Math.round(g * 255)];
  }), true, [0.25, 0.25]);

  const exitFace = toTexture(sign('EXIT', { w: 0.32, h: 0.16, bg: '#f4f4ef', fg: '#d0161b' }), true);

  return {
    // shell
    wallExterior: std({ name: 'wall-exterior', map: exteriorStrip, normalMap: rPanel, normalScale: new THREE.Vector2(1, 1), roughness: 0.48, metalness: 0.35 }),
    wallInterior: std({ name: 'wall-liner', map: interiorStrip, normalMap: liner, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.62, metalness: 0.15 }),
    wallTrim: std({ name: 'wall-trim', color: '#575c61', roughness: 0.45, metalness: 0.45, side: THREE.DoubleSide }),
    roofTop: std({ name: 'roof-panel', color: '#c3c7c9', normalMap: seam, roughness: 0.38, metalness: 0.65 }),
    roofUnder: std({ name: 'roof-insulation', color: '#f1f2f0', map: insulation, roughness: 0.9 }),
    frame: std({ name: 'steel-frame', color: '#9aa1a6', roughness: 0.55, metalness: 0.35 }),
    galv: std({ name: 'galvanized-steel', color: '#b5babd', roughness: 0.42, metalness: 0.75 }),
    concrete: std({ name: 'concrete', color: '#b2b0aa', roughnessMap: concreteRough, normalMap: concreteNormal, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 1 }),
    asphalt: std({ name: 'asphalt', color: '#55585b', map: asphaltMap, roughness: 0.92 }),
    grass: std({ name: 'grass', color: '#5f7a3f', map: grassMap, roughness: 1 }),
    paintWhite: std({ name: 'paint-white', color: '#e9e8e1', roughness: 0.7 }),
    paintYellow: std({ name: 'paint-yellow', color: '#e8b61a', roughness: 0.65 }),
    skylight: std({ name: 'skylight', color: '#e7eef3', emissive: '#e3edf5', emissiveIntensity: 1.6, roughness: 0.6 }),
    // racking
    upright: std({ name: 'rack-upright', map: uprightMap, roughness: 0.42, metalness: 0.25 }),
    brace: std({ name: 'rack-brace', color: '#24569f', roughness: 0.42, metalness: 0.25 }),
    beam: std({ name: 'rack-beam', color: '#e2561c', roughness: 0.38, metalness: 0.2 }),
    wireDeck: std({ name: 'wire-deck', map: wire, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.7 }),
    // loads
    pallet: woods.map((map, i) => std({ name: `pallet-wood-${i}`, map, color: ['#e2c08c', '#cfa774', '#b0916a'][i], roughness: 0.88 })),
    cardboard: ['#c49a6a', '#b88a58', '#d3ae7f', '#a97b4d', '#e7e1d6'].map((color, i) => std({ name: `carton-${i}`, map: cardboard, color, roughness: 0.92 })),
    tape: std({ name: 'packing-tape', color: '#b07f45', roughness: 0.35 }),
    wrap: std({ name: 'stretch-wrap', map: wrapColor, normalMap: wrapNormal, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.25, metalness: 0.05 }),
    cartonTop: std({ name: 'carton-tops', map: cartonTop, color: '#c9a171', roughness: 0.85 }),
    crate: std({ name: 'crate-plywood', map: woods[1], color: '#d8b98a', roughness: 0.85 }),
    sack: std({ name: 'woven-sack', map: woven, color: '#ece7da', roughness: 0.95 }),
    drumBlue: std({ name: 'drum-blue', color: '#1f5fae', roughness: 0.45, metalness: 0.1 }),
    toteGray: std({ name: 'tote-gray', color: '#5d646d', roughness: 0.6 }),
    toteBlue: std({ name: 'tote-blue', color: '#2a63b5', roughness: 0.55 }),
    // equipment + safety
    safetyYellow: std({ name: 'safety-yellow', color: '#f1bd12', roughness: 0.45, metalness: 0.1 }),
    hazard: std({ name: 'hazard-stripes', map: hazard, roughness: 0.55 }),
    forklift: std({ name: 'forklift-paint', color: '#f0a10e', roughness: 0.35, metalness: 0.15 }),
    red: std({ name: 'red-paint', color: '#b8231b', roughness: 0.4, metalness: 0.1 }),
    orange: std({ name: 'orange-paint', color: '#e66a12', roughness: 0.42, metalness: 0.1 }),
    blueMachine: std({ name: 'machine-blue', color: '#2b5f9e', roughness: 0.45, metalness: 0.15 }),
    grayMachine: std({ name: 'machine-gray', color: '#7a8187', roughness: 0.5, metalness: 0.3 }),
    rubber: std({ name: 'rubber', color: '#161616', roughness: 0.92 }),
    darkSteel: std({ name: 'dark-steel', color: '#2c3035', roughness: 0.5, metalness: 0.55 }),
    chrome: std({ name: 'chrome', color: '#d9dcdf', roughness: 0.18, metalness: 1 }),
    treadPlate: std({ name: 'tread-plate', color: '#6d7175', normalMap: plate, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.42, metalness: 0.75 }),
    doorPanel: std({ name: 'door-panel', color: '#e3e6e8', normalMap: doorGroove, roughness: 0.4, metalness: 0.3 }),
    manDoor: std({ name: 'man-door', color: '#6c7378', roughness: 0.45, metalness: 0.35 }),
    trailerSide: std({ name: 'trailer-side', color: '#eceeee', normalMap: trailerPosts, roughness: 0.35, metalness: 0.4 }),
    glass: std({ name: 'glass', color: '#a9c2cf', roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.32, depthWrite: false }),
    storefront: std({ name: 'storefront-aluminum', color: '#3a3d40', roughness: 0.35, metalness: 0.7 }),
    lens: std({ name: 'hi-bay-lens', color: '#ffffff', emissive: '#fff4e4', emissiveIntensity: 7, roughness: 0.3 }),
    troffer: std({ name: 'troffer-lens', color: '#ffffff', emissive: '#fffaf2', emissiveIntensity: 2.6, roughness: 0.5 }),
    beacon: std({ name: 'beacon', color: '#ff9a1a', emissive: '#ff8a00', emissiveIntensity: 3, roughness: 0.3 }),
    exitSign: std({ name: 'exit-sign', map: exitFace, emissiveMap: exitFace, emissive: '#ffffff', emissiveIntensity: 1.4, roughness: 0.5 }),
    // office
    drywall: std({ name: 'drywall', color: '#e7e3da', roughness: 0.92 }),
    carpet: std({ name: 'carpet-tile', map: toTexture(carpetTile(), true, [1 / 0.61, 1 / 0.61]), roughness: 1 }),
    ceilingTile: (() => { const map = toTexture(ceilingGrid(), true, [1 / 1.22, 1 / 1.22]); return std({ name: 'ceiling-tile', map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.95 }); })(),
    woodDesk: std({ name: 'desk-laminate', map: woods[0], color: '#b98c5e', roughness: 0.55 }),
    laminateWhite: std({ name: 'laminate-white', color: '#efede7', roughness: 0.5 }),
    fabric: std({ name: 'chair-fabric', color: '#2a2e35', roughness: 0.95 }),
    screen: std({ name: 'monitor-screen', color: '#0b0e12', emissive: '#203a58', emissiveIntensity: 0.9, roughness: 0.15 }),
    blackPlastic: std({ name: 'black-plastic', color: '#1b1d20', roughness: 0.55 }),
    foliage: std({ name: 'foliage', color: '#4d6a35', roughness: 0.95 }),
    bark: std({ name: 'bark', color: '#5a4532', roughness: 0.95 }),
  };
}

/** One-off sign material: canvas text, optionally glowing. */
export function signMaterial(text: string, o: { w: number; h: number; bg: string; fg: string; border?: string; glow?: number }) {
  const map = toTexture(sign(text, o), true);
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  return new THREE.MeshStandardMaterial({
    name: `sign-${text.toLowerCase().replace(/\W+/g, '-')}`, map, roughness: 0.55,
    ...(o.glow ? { emissiveMap: map, emissive: '#ffffff', emissiveIntensity: o.glow } : {}),
  });
}

