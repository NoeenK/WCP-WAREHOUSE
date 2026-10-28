/**
 * Every dimension of the warehouse, in meters (feet/inches in the comments).
 *
 * Nothing here is measured yet. These are typical values for a mid-size pre-engineered metal
 * building with dock-high loading, selective pallet racking and a front office. Replace them
 * with the real building's numbers (laser measure, drawings or a scan) and the whole model,
 * floor markings and plan view rebuild around them. BRIEF.md lists what to measure first.
 *
 * Frame: meters, +y up, floor at 0, building centered on x/z. −z is the north (back) wall,
 * +z the south (front) wall with the docks. "Along x" runs west → east.
 */
export const FT = 0.3048;
export const IN = 0.0254;

export const BUILDING = {
  label: 'WCP Warehouse',
  /** lettering on the front wall above the office entrance */
  sign: 'WCP WAREHOUSE',
  /** interior face to face, west → east (south and north walls) */
  width: 160 * FT,
  /** interior face to face, north → south (east and west walls) */
  depth: 100 * FT,
  /** floor to the underside of the roof at the long walls */
  eave: 30 * FT,
  /** roof rise per run; the ridge runs along x at z = 0 */
  pitch: 1 / 12,
  /** girts + metal panel + liner */
  wallThickness: 0.2,
  /** main rigid-frame bays along x (frame lines at both end walls and between) */
  bays: 6,
  /** end-wall columns between the corners (east and west walls) */
  endwallBays: 4,
  roofThickness: 0.06,
  purlinDepth: 8 * IN,
  purlinSpacing: 5 * FT,
  /** rafter depth at the eave knee and at the ridge (tapered) */
  rafterDepth: [0.62, 0.42] as const,
  /** column depth at the floor and at the knee (tapered), and flange width */
  columnDepth: [0.36, 0.62] as const,
  flangeWidth: 0.25,
  overhang: 0.35,
  /** floor slab height above the surrounding pavement */
  slabAbovePavement: 0.15,
};

/** Dock-high truck doors on the south wall. Centers are x positions. */
export const DOCKS = {
  /** two doors in each of the three east bays, one in the last: spaced clear of the frame columns */
  centers: [0.25, 0.75, 1.25, 1.75, 2.5].map((f) => -BUILDING.width / 2 + (BUILDING.width / BUILDING.bays) * (3 + f)),
  width: 9 * FT,
  height: 10 * FT,
  /** truck court depth below the floor (dock height) */
  dockHeight: 4 * FT,
  /** index into centers: doors drawn open, each with a trailer backed in */
  open: [1, 3],
  /** leveler pit (width across the door, depth into the building) */
  leveler: [6 * FT, 8 * FT] as const,
  /** truck well: flat apron length, then the ramp back up to the pavement */
  apron: 60 * FT,
  ramp: 45 * FT,
};

/** At-grade drive-in door on the east wall (center z). */
export const DRIVE_IN = { wall: 'east' as const, at: 10.5, width: 12 * FT, height: 14 * FT };

/** Personnel doors (center x on north/south walls, center z on east/west walls). 'aisle' snaps to a rack aisle. */
export const MAN_DOORS: { wall: 'north' | 'south' | 'east' | 'west'; at: number | 'aisle-west' | 'aisle-east'; exit?: boolean }[] = [
  { wall: 'north', at: 'aisle-west', exit: true },
  { wall: 'north', at: 'aisle-east', exit: true },
  { wall: 'east', at: 4.6, exit: true },
  { wall: 'west', at: 4.7, exit: true },
  { wall: 'south', at: 23.2, exit: true },
];
export const MAN_DOOR = { width: 3 * FT, height: 7 * FT };

/** Front office in the south-west corner: storefront entrance and windows on the south wall. */
export const OFFICE = {
  width: 40 * FT,
  depth: 28 * FT,
  /** partition and drop-ceiling height */
  height: 12 * FT,
  ceiling: 9 * FT,
  /** storefront entrance on the south wall (center x) */
  entrance: -17.6,
  /** exterior windows: south wall (center x), west wall (center z) */
  southWindows: [-22.0, -20.0, -14.2],
  westWindows: [13.2, 11.2],
  window: { width: 1.5, sill: 0.9, head: 2.3 },
  /** door from the office into the warehouse, on the office's north partition (center x) */
  warehouseDoor: -16.4,
  /** interior windows looking into the warehouse: north partition (center x), east partition (center z) */
  partitionWindows: { north: [-18.7], east: [9.0, 13.3] },
};

/** Selective pallet racking: rows run north → south, back-to-back doubles between single wall rows. */
export const RACKS = {
  frameDepth: 42 * IN,
  /** gap between back-to-back rows */
  flue: 6 * IN,
  /** clear opening between uprights (beam length) */
  bayClear: 108 * IN,
  upright: 3 * IN,
  height: 24 * FT,
  /** beam tops above the floor; the floor is a pallet position too */
  levels: [5 * FT, 10 * FT, 15 * FT, 20 * FT],
  beamHeight: 4.5 * IN,
  bays: 6,
  /** clearance from the north wall to the first upright, and from the side walls */
  northClear: 1.0,
  sideClear: 0.9,
  /** narrowest aisle allowed; spare width is shared between all aisles */
  aisleMin: 12 * FT,
  /** share of pallet positions that hold a load */
  fill: 0.86,
  seed: 7,
};

/** Standard GMA pallet: 48" deep (into the rack) × 40" wide. */
export const PALLET = { depth: 48 * IN, width: 40 * IN, height: 5.5 * IN };

/** Rendering and site extents. */
export const SITE = {
  /** pavement margin around the building (north, east, west) */
  margin: 14,
  /** extra pavement beyond the truck well ramp */
  frontMargin: 10,
  /** seed for loads, scuffs and staging */
  seed: 2026,
};
