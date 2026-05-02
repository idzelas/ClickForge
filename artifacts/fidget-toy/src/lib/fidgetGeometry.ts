import * as THREE from "three";

export interface FidgetSettings {
  totalDepth: number;         // outer wall total height (mm), e.g. 22
  innerFillDepth: number;     // total inner fill block height (pocket + floor), e.g. 12
  keycapPocketDepth: number;  // keycap cavity depth from the top of inner fill (mm), e.g. 10
  insetAmount: number;        // how much inner fill is inset from outer wall edge (mm each side), e.g. 1
  keycapSize: number;         // keycap square pocket side length (mm), e.g. 14
  pegRadius: number;          // inner clicker peg radius (mm), e.g. 3.5
  targetSizeMm: number;       // target mm for the locked SVG dimension
  lockDimension: "width" | "height";
  // MX-style contact pin holes punched through the pocket walls (NOT the floor)
  pinHolesEnabled: boolean;
  pinHoleRadius: number;      // print clearance added to each MX spec radius (mm), e.g. 0.1
}

export const DEFAULT_SETTINGS: FidgetSettings = {
  totalDepth: 22,
  innerFillDepth: 12,   // total housing block (pocket cavity + solid floor)
  keycapPocketDepth: 10, // keycap cavity depth; floor = innerFillDepth − keycapPocketDepth = 2 mm
  insetAmount: 1,
  keycapSize: 14,
  pegRadius: 3.5,
  targetSizeMm: 50,
  lockDimension: "width",
  pinHolesEnabled: false,
  pinHoleRadius: 0.1,
};

/**
 * Outer shell geometry broken into 3 meshes:
 *
 *  outerWall      – the ring (SVG perimeter minus inset hole), full totalDepth tall
 *  innerFillFloor – solid bottom cap, floorDepth = computeFloorDepth(innerFillDepth) (~15%)
 *  innerFillWalls – ring above the floor up to innerFillDepth, leaving the square pocket open
 *
 * `innerFillDepth` is the TOTAL pocket block height (pocket cavity + floor).
 * All three share z=0 as their bottom face. Use zOffsets to position them correctly.
 */
export interface OuterShellGeometries {
  outerWall: THREE.BufferGeometry;
  innerFillFloor: THREE.BufferGeometry;   // solid — no pocket yet
  innerFillWalls: THREE.BufferGeometry;   // walls around the blind square pocket
  zOffsets: {
    outerWall: number;
    innerFillFloor: number;
    innerFillWalls: number;
  };
  /** Thickness of solid material under the pocket */
  floorDepth: number;
}

export interface InnerClickerGeometries {
  body: THREE.BufferGeometry;
  peg: THREE.BufferGeometry;
  /** Depth of the clicker body */
  clickerDepth: number;
  /** Height of the peg */
  pegHeight: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createOuterShellGeometries(
  svgShapes: THREE.Shape[],
  settings: FidgetSettings,
  svgWidth: number,
  svgHeight: number
): OuterShellGeometries {
  const { scale } = computeScale(settings, svgWidth, svgHeight);
  const scaledW = svgWidth * scale;
  const scaledH = svgHeight * scale;

  const baseShape = svgShapes.length > 0 ? svgShapes[0] : createDefaultShape(40);
  const { totalDepth, innerFillDepth, keycapPocketDepth, insetAmount, keycapSize } = settings;

  // Floor = solid material below the keycap cavity.  Never less than 1 mm.
  // Pocket walls sit on top of the floor and form the cavity opening.
  const pocketDepth = Math.min(keycapPocketDepth, innerFillDepth - 1);
  const floorDepth = innerFillDepth - pocketDepth; // e.g. 12 - 10 = 2 mm solid floor

  // Scale factor to shrink the shape inward by insetAmount on each side
  const insetFactor = computeInsetFactor(scaledW, scaledH, insetAmount);

  // ── 1. Outer wall: full SVG shape with inset shape punched as a hole → ring ──
  const outerShape = transformShape(baseShape, scale, svgWidth, svgHeight);
  const insetShapeForHole = transformShape(baseShape, scale * insetFactor, svgWidth, svgHeight);
  outerShape.holes.push(new THREE.Path(insetShapeForHole.getPoints(64)));
  const outerWallGeo = extrudeShape(outerShape, totalDepth);

  // ── 2. Inner fill floor: always solid — pin holes do NOT penetrate this layer ──
  const floorShape = transformShape(baseShape, scale * insetFactor, svgWidth, svgHeight);
  const innerFillFloorGeo = extrudeShape(floorShape, floorDepth);

  // ── 3. Inner fill walls: keycap square hole + optional MX pin holes, pocketDepth tall ──
  //    Sits on top of the floor.  MX holes stop at the floor surface — they never
  //    exit the bottom of the model.  All standard MX pin positions (±5.08 mm,
  //    ±3.81 mm / −2.54 mm) fall within the keycap square for default 14 mm size,
  //    but at smaller keycapSize values the peg holes may extend outside the square
  //    and become visible as separate guide holes in the cavity walls.
  const wallsShape = transformShape(baseShape, scale * insetFactor, svgWidth, svgHeight);
  addSquareHole(wallsShape, keycapSize);
  if (settings.pinHolesEnabled) {
    addMXPinHoles(wallsShape, settings.pinHoleRadius);
  }
  const innerFillWallsGeo = extrudeShape(wallsShape, pocketDepth);

  return {
    outerWall: outerWallGeo,
    innerFillFloor: innerFillFloorGeo,
    innerFillWalls: innerFillWallsGeo,
    zOffsets: {
      outerWall: 0,
      innerFillFloor: 0,           // flush with bottom of outer wall
      innerFillWalls: floorDepth,  // sits directly on top of the floor
    },
    floorDepth,
  };
}

export function createInnerClickerGeometries(
  svgShapes: THREE.Shape[],
  settings: FidgetSettings,
  svgWidth: number,
  svgHeight: number
): InnerClickerGeometries {
  const { scale } = computeScale(settings, svgWidth, svgHeight);
  const scaledW = svgWidth * scale;
  const scaledH = svgHeight * scale;

  const baseShape = svgShapes.length > 0 ? svgShapes[0] : createDefaultShape(40);
  const { totalDepth, innerFillDepth, insetAmount, keycapSize, pegRadius } = settings;

  // Recess is the open space above the inner fill where the clicker sits
  const recessDepth = totalDepth - innerFillDepth;
  const clickerDepth = Math.max(1, recessDepth - 1); // 1mm clearance at top

  // Clicker fits inside the inset area with 0.3mm clearance
  const insetFactor = computeInsetFactor(scaledW, scaledH, insetAmount);
  const clickerScale = scale * insetFactor * 0.988;

  const clickerShape = transformShape(baseShape, clickerScale, svgWidth, svgHeight);
  // The clicker also has the keycap square opening so the keycap stem can pass through
  addSquareHole(clickerShape, keycapSize);
  const bodyGeo = extrudeShape(clickerShape, clickerDepth);

  // Peg: drops into the keycap cavity; sized at 60% of the pocket depth
  const pegHeight = settings.keycapPocketDepth * 0.6;
  const pegGeo = new THREE.CylinderGeometry(pegRadius, pegRadius, pegHeight, 32);

  return { body: bodyGeo, peg: pegGeo, clickerDepth, pegHeight };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeScale(s: FidgetSettings, w: number, h: number): { scale: number } {
  const base = s.lockDimension === "width" ? w : h;
  return { scale: base > 0 ? s.targetSizeMm / base : 1 };
}

function computeInsetFactor(scaledW: number, scaledH: number, inset: number): number {
  return Math.max(0.5, Math.min(scaledW - 2 * inset, scaledH - 2 * inset) / Math.max(scaledW, scaledH));
}

function transformShape(shape: THREE.Shape, scale: number, svgWidth: number, svgHeight: number): THREE.Shape {
  const cx = (svgWidth * scale) / 2;
  const cy = (svgHeight * scale) / 2;
  const pts = shape.getPoints(64).map((p) => new THREE.Vector2(p.x * scale - cx, -(p.y * scale - cy)));
  const out = new THREE.Shape();
  out.setFromPoints(pts);
  for (const hole of shape.holes) {
    const hp = hole.getPoints(32).map((p) => new THREE.Vector2(p.x * scale - cx, -(p.y * scale - cy)));
    const h = new THREE.Path();
    h.setFromPoints(hp);
    out.holes.push(h);
  }
  return out;
}

/**
 * Punches the official Cherry MX 5-pin PCB footprint holes through a shape.
 * All positions are the fixed hardware spec (relative to switch centre):
 *
 *   Center guide pin:       ( 0.00,  0.00)  Ø 4.0 mm  r = 2.00
 *   Left  retention peg:    (-5.08,  0.00)  Ø 1.8 mm  r = 0.90
 *   Right retention peg:    (+5.08,  0.00)  Ø 1.8 mm  r = 0.90
 *   Left  electrical pin:   (-3.81, -2.54)  Ø 1.5 mm  r = 0.75
 *   Right electrical pin:   (+3.81, -2.54)  Ø 1.5 mm  r = 0.75
 *
 * `tolerance` (mm) is added to every radius to compensate for FDM over-extrusion.
 * Source: Cherry MX datasheet · KiCad SW_Cherry_MX_PCB footprint
 */
function addMXPinHoles(shape: THREE.Shape, tolerance: number): void {
  // [x, y, baseRadius]
  const pins: [number, number, number][] = [
    [  0.00,  0.00, 2.00 ],  // center guide pin
    [ -5.08,  0.00, 0.90 ],  // left  retention peg
    [  5.08,  0.00, 0.90 ],  // right retention peg
    [ -3.81, -2.54, 0.75 ],  // left  electrical contact
    [  3.81, -2.54, 0.75 ],  // right electrical contact
  ];

  for (const [x, y, r] of pins) {
    const h = new THREE.Path();
    h.absarc(x, y, r + tolerance, 0, Math.PI * 2, false);
    shape.holes.push(h);
  }
}

function addSquareHole(shape: THREE.Shape, size: number): void {
  const half = size / 2;
  const hole = new THREE.Path();
  hole.moveTo(-half, -half);
  hole.lineTo(half, -half);
  hole.lineTo(half, half);
  hole.lineTo(-half, half);
  hole.closePath();
  shape.holes.push(hole);
}

function extrudeShape(shape: THREE.Shape, depth: number): THREE.BufferGeometry {
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.15,
    bevelSize: 0.15,
    bevelSegments: 2,
  });
}

function createDefaultShape(size: number): THREE.Shape {
  const half = size / 2;
  const r = size * 0.1;
  const s = new THREE.Shape();
  s.moveTo(-half + r, -half);
  s.lineTo(half - r, -half);
  s.quadraticCurveTo(half, -half, half, -half + r);
  s.lineTo(half, half - r);
  s.quadraticCurveTo(half, half, half - r, half);
  s.lineTo(-half + r, half);
  s.quadraticCurveTo(-half, half, -half, half - r);
  s.lineTo(-half, -half + r);
  s.quadraticCurveTo(-half, -half, -half + r, -half);
  s.closePath();
  return s;
}
