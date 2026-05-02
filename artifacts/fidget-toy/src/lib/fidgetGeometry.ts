import * as THREE from "three";

export interface FidgetSettings {
  totalDepth: number;         // outer wall total height (mm), e.g. 22
  innerFillDepth: number;     // total inner fill block height (pocket + floor), e.g. 12
  keycapPocketDepth: number;  // total pocket depth from top of inner fill (mm), e.g. 10
  insetAmount: number;        // how much inner fill is inset from outer wall edge (mm each side), e.g. 1
  keycapSize: number;         // keycap square pocket side length (mm), e.g. 14
  pegRadius: number;          // inner clicker peg radius (mm), e.g. 3.5
  targetSizeMm: number;       // target mm for the locked SVG dimension
  lockDimension: "width" | "height";
  // MX-style switch pin holes
  pinHolesEnabled: boolean;
  pinHoleRadius: number;      // print clearance added to each MX spec radius (mm), e.g. 0.1
  pinHoleDepth: number;       // depth of the pin-hole section at the deepest end of the pocket (mm), e.g. 3
}

export const DEFAULT_SETTINGS: FidgetSettings = {
  totalDepth: 22,
  innerFillDepth: 12,    // total housing block (pocket + solid floor)
  keycapPocketDepth: 10, // floor = innerFillDepth − keycapPocketDepth = 2 mm solid
  insetAmount: 1,
  keycapSize: 14,
  pegRadius: 3.5,
  targetSizeMm: 50,
  lockDimension: "width",
  pinHolesEnabled: false,
  pinHoleRadius: 0.1,
  pinHoleDepth: 3,       // lowest 3 mm of the 10 mm pocket = pin section; upper 7 mm = keycap square
};

/**
 * Pocket cross-section from the CLOSED END (floor surface) upward to the OPENING:
 *
 *   ┌─────────────────────────────┐  ← z = innerFillDepth (pocket opening, faces clicker)
 *   │   keycap square cavity      │  keycapSquareDepth = keycapPocketDepth − pinHoleDepth
 *   │   (14 × 14 mm aperture)     │
 *   ├─────────────────────────────┤  ← z = floorDepth + pinHoleDepth
 *   │   MX pin holes              │  pinHoleDepth  (e.g. 3 mm)
 *   │   (5 cylinders, no square)  │
 *   ├─────────────────────────────┤  ← z = floorDepth (solid floor surface)
 *   │   solid floor               │  floorDepth = innerFillDepth − keycapPocketDepth
 *   └─────────────────────────────┘  ← z = 0  (bottom of toy)
 *
 * Outer shell geometry: 4 meshes when pin holes enabled, 3 when disabled.
 *   outerWall         – SVG ring, full totalDepth
 *   innerFillFloor    – solid base cap, floorDepth
 *   innerFillPinSection – (pin-holes-only), pinHoleDepth   [null when disabled]
 *   innerFillWalls    – keycap square aperture, keycapSquareDepth
 */
export interface OuterShellGeometries {
  outerWall: THREE.BufferGeometry;
  innerFillFloor: THREE.BufferGeometry;
  /** null when pinHolesEnabled = false */
  innerFillPinSection: THREE.BufferGeometry | null;
  innerFillWalls: THREE.BufferGeometry;
  zOffsets: {
    outerWall: number;
    innerFillFloor: number;
    innerFillPinSection: number;
    innerFillWalls: number;
  };
  floorDepth: number;
}

export interface InnerClickerGeometries {
  body: THREE.BufferGeometry;
  peg: THREE.BufferGeometry;
  clickerDepth: number;
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
  const {
    totalDepth, innerFillDepth,
    insetAmount, keycapSize, pinHolesEnabled,
  } = settings;
  const keycapPocketDepth = settings.keycapPocketDepth ?? DEFAULT_SETTINGS.keycapPocketDepth;
  const pinHoleRadius = settings.pinHoleRadius ?? DEFAULT_SETTINGS.pinHoleRadius;
  const pinHoleDepth = settings.pinHoleDepth ?? DEFAULT_SETTINGS.pinHoleDepth;

  // Clamp pocket so the floor is at least 1 mm.
  const pocketDepth = Math.min(keycapPocketDepth, innerFillDepth - 1);
  const floorDepth = innerFillDepth - pocketDepth;

  // Pin section lives at the deepest end of the pocket.
  // keycap square section = the remaining shallower portion.
  const pinDepth = pinHolesEnabled ? Math.min(pinHoleDepth, pocketDepth - 1) : 0;
  const squareDepth = pocketDepth - pinDepth;

  const insetFactor = computeInsetFactor(scaledW, scaledH, insetAmount);

  // ── 1. Outer wall ring ──────────────────────────────────────────────────
  const outerShape = transformShape(baseShape, scale, svgWidth, svgHeight);
  const insetShapeForHole = transformShape(baseShape, scale * insetFactor, svgWidth, svgHeight);
  outerShape.holes.push(new THREE.Path(insetShapeForHole.getPoints(64)));
  const outerWallGeo = extrudeShape(outerShape, totalDepth);

  // ── 2. Inner fill floor — always 100% solid ─────────────────────────────
  const floorShape = transformShape(baseShape, scale * insetFactor, svgWidth, svgHeight);
  const innerFillFloorGeo = extrudeShape(floorShape, floorDepth);

  // ── 3. Pin-hole section (deepest part of pocket) ────────────────────────
  //    Only present when pinHolesEnabled.  Has 5 MX cylinders, NO keycap square.
  //    Sits directly on top of the solid floor.
  let innerFillPinSectionGeo: THREE.BufferGeometry | null = null;
  if (pinHolesEnabled && pinDepth > 0) {
    const pinShape = transformShape(baseShape, scale * insetFactor, svgWidth, svgHeight);
    addMXPinHoles(pinShape, pinHoleRadius);
    innerFillPinSectionGeo = extrudeShape(pinShape, pinDepth);
  }

  // ── 4. Keycap square section (upper / shallower part of pocket) ─────────
  //    Sits on top of the pin section (or floor when pins disabled).
  //    The 14×14 mm square aperture is the keycap pocket opening.
  const wallsShape = transformShape(baseShape, scale * insetFactor, svgWidth, svgHeight);
  addSquareHole(wallsShape, keycapSize);
  const innerFillWallsGeo = extrudeShape(wallsShape, squareDepth);

  return {
    outerWall: outerWallGeo,
    innerFillFloor: innerFillFloorGeo,
    innerFillPinSection: innerFillPinSectionGeo,
    innerFillWalls: innerFillWallsGeo,
    zOffsets: {
      outerWall: 0,
      innerFillFloor: 0,
      innerFillPinSection: floorDepth,
      innerFillWalls: floorDepth + pinDepth,
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

  const recessDepth = totalDepth - innerFillDepth;
  const clickerDepth = Math.max(1, recessDepth - 1);

  const insetFactor = computeInsetFactor(scaledW, scaledH, insetAmount);
  const clickerScale = scale * insetFactor * 0.988;

  const clickerShape = transformShape(baseShape, clickerScale, svgWidth, svgHeight);
  addSquareHole(clickerShape, keycapSize);
  const bodyGeo = extrudeShape(clickerShape, clickerDepth);

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
 *
 *   Center guide pin:       ( 0.00,  0.00)  Ø 4.0 mm  r = 2.00
 *   Left  retention peg:    (-5.08,  0.00)  Ø 1.8 mm  r = 0.90
 *   Right retention peg:    (+5.08,  0.00)  Ø 1.8 mm  r = 0.90
 *   Left  electrical pin:   (-3.81, -2.54)  Ø 1.5 mm  r = 0.75
 *   Right electrical pin:   (+3.81, -2.54)  Ø 1.5 mm  r = 0.75
 *
 * `tolerance` (mm) is added to every radius for FDM over-extrusion compensation.
 * Source: Cherry MX datasheet · KiCad SW_Cherry_MX_PCB footprint
 */
function addMXPinHoles(shape: THREE.Shape, tolerance: number): void {
  const pins: [number, number, number][] = [
    [  0.00,  0.00, 2.00 ],
    [ -5.08,  0.00, 0.90 ],
    [  5.08,  0.00, 0.90 ],
    [ -3.81, -2.54, 0.75 ],
    [  3.81, -2.54, 0.75 ],
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
  hole.lineTo(-half, -half);
  shape.holes.push(hole);
}

function extrudeShape(shape: THREE.Shape, depth: number): THREE.BufferGeometry {
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });
}

function createDefaultShape(size: number): THREE.Shape {
  const s = new THREE.Shape();
  const r = size / 2;
  s.moveTo(-r, -r);
  s.lineTo(r, -r);
  s.lineTo(r, r);
  s.lineTo(-r, r);
  s.lineTo(-r, -r);
  return s;
}
