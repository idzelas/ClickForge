import * as THREE from "three";

export interface FidgetSettings {
  totalDepth: number;         // outer wall total height (mm), e.g. 22
  innerFillDepth: number;     // inner fill total height (mm), e.g. 12
  keycapPocketDepth: number;  // how deep the blind pocket goes from the TOP of inner fill (mm), e.g. 10
  insetAmount: number;        // how much inner fill is inset from outer wall edge (mm each side), e.g. 1
  keycapSize: number;         // keycap square pocket side length (mm), e.g. 14
  pegRadius: number;          // inner clicker peg radius (mm), e.g. 3.5
  targetSizeMm: number;       // target mm for the locked SVG dimension
  lockDimension: "width" | "height";
}

export const DEFAULT_SETTINGS: FidgetSettings = {
  totalDepth: 22,
  innerFillDepth: 12,
  keycapPocketDepth: 10,
  insetAmount: 1,
  keycapSize: 14,
  pegRadius: 3.5,
  targetSizeMm: 50,
  lockDimension: "width",
};

/**
 * Outer shell geometry broken into 3 meshes:
 *
 *  outerWall      – the ring (SVG perimeter minus inset hole), full totalDepth tall
 *  innerFillFloor – solid bottom cap of the inner fill, floorDepth = innerFillDepth - keycapPocketDepth
 *  innerFillWalls – ring above the floor up to innerFillDepth, leaving the square pocket open
 *
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

  // Clamp pocket depth so it never exceeds innerFillDepth (leave at least 1mm floor)
  const pocketDepth = Math.min(keycapPocketDepth, innerFillDepth - 1);
  const floorDepth = innerFillDepth - pocketDepth; // e.g. 12 - 10 = 2mm

  // Scale factor to shrink the shape inward by insetAmount on each side
  const insetFactor = computeInsetFactor(scaledW, scaledH, insetAmount);

  // ── 1. Outer wall: full SVG shape with inset shape punched as a hole → ring ──
  const outerShape = transformShape(baseShape, scale, svgWidth, svgHeight);
  const insetShapeForHole = transformShape(baseShape, scale * insetFactor, svgWidth, svgHeight);
  outerShape.holes.push(new THREE.Path(insetShapeForHole.getPoints(64)));
  const outerWallGeo = extrudeShape(outerShape, totalDepth);

  // ── 2. Inner fill floor: solid inset shape (NO holes), floorDepth tall ──
  //    This is the material beneath the keycap pocket — pocket does not poke through.
  const floorShape = transformShape(baseShape, scale * insetFactor, svgWidth, svgHeight);
  const innerFillFloorGeo = extrudeShape(floorShape, floorDepth);

  // ── 3. Inner fill walls: inset shape WITH square pocket hole, pocketDepth tall ──
  //    Sits on top of the floor. The square opening is the keycap pocket cavity.
  const wallsShape = transformShape(baseShape, scale * insetFactor, svgWidth, svgHeight);
  addSquareHole(wallsShape, keycapSize);
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

  // Peg: drops down from the bottom of the clicker into the keycap pocket
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
