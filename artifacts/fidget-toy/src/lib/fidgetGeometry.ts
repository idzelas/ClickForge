import * as THREE from "three";

export interface FidgetSettings {
  extrudeDepth: number;
  keycapSize: number;
  pegRadius: number;
}

/**
 * Create the outer shell: SVG shape extruded with a square keycap hole
 */
export function createOuterShellGeometry(
  svgShapes: THREE.Shape[],
  settings: FidgetSettings,
  svgWidth: number,
  svgHeight: number
): THREE.BufferGeometry {
  // Scale shapes to fit nicely (~40mm bounding box)
  const targetSize = 40;
  const scaleX = targetSize / svgWidth;
  const scaleY = targetSize / svgHeight;
  const scale = Math.min(scaleX, scaleY);

  const { extrudeDepth, keycapSize } = settings;

  // Combine all SVG shapes into one
  const mainShape = svgShapes.length > 0 ? svgShapes[0].clone() : createDefaultShape(targetSize);

  // Scale and center the shape
  const scaledShape = scaleShape(mainShape, scale, svgWidth, svgHeight);

  // Add square hole in center
  const half = keycapSize / 2;
  const hole = new THREE.Path();
  hole.moveTo(-half, -half);
  hole.lineTo(half, -half);
  hole.lineTo(half, half);
  hole.lineTo(-half, half);
  hole.closePath();
  scaledShape.holes.push(hole);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: extrudeDepth,
    bevelEnabled: true,
    bevelThickness: 0.3,
    bevelSize: 0.3,
    bevelSegments: 2,
  };

  const geo = new THREE.ExtrudeGeometry(scaledShape, extrudeSettings);
  geo.center();
  return geo;
}

/**
 * Create the inner clicker: smaller shape with square hole + circular peg
 */
export function createInnerClickerGeometry(
  svgShapes: THREE.Shape[],
  settings: FidgetSettings,
  svgWidth: number,
  svgHeight: number
): { body: THREE.BufferGeometry; peg: THREE.BufferGeometry } {
  const targetSize = 28; // Smaller than outer
  const scaleX = targetSize / svgWidth;
  const scaleY = targetSize / svgHeight;
  const scale = Math.min(scaleX, scaleY);

  const { extrudeDepth, keycapSize, pegRadius } = settings;
  const innerDepth = extrudeDepth * 0.7;

  const mainShape = svgShapes.length > 0 ? svgShapes[0].clone() : createDefaultShape(targetSize);
  const scaledShape = scaleShape(mainShape, scale, svgWidth, svgHeight);

  // Square hole
  const half = keycapSize / 2;
  const hole = new THREE.Path();
  hole.moveTo(-half, -half);
  hole.lineTo(half, -half);
  hole.lineTo(half, half);
  hole.lineTo(-half, half);
  hole.closePath();
  scaledShape.holes.push(hole);

  const bodyExtrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: innerDepth,
    bevelEnabled: true,
    bevelThickness: 0.2,
    bevelSize: 0.2,
    bevelSegments: 2,
  };

  const bodyGeo = new THREE.ExtrudeGeometry(scaledShape, bodyExtrudeSettings);
  bodyGeo.center();

  // Circular peg (cylinder)
  const pegGeo = new THREE.CylinderGeometry(pegRadius, pegRadius, extrudeDepth * 0.5, 32);

  return { body: bodyGeo, peg: pegGeo };
}

function scaleShape(shape: THREE.Shape, scale: number, svgWidth: number, svgHeight: number): THREE.Shape {
  const matrix = new THREE.Matrix3();
  // Scale and flip Y (SVG Y is inverted)
  matrix.set(scale, 0, -svgWidth * scale * 0.5, 0, -scale, svgHeight * scale * 0.5, 0, 0, 1);

  const scaledShape = new THREE.Shape();
  const pts = shape.getPoints(32);

  if (pts.length === 0) return scaledShape;

  const transformed = pts.map((p) => {
    const v = new THREE.Vector2(p.x, p.y).applyMatrix3(matrix);
    return v;
  });

  scaledShape.setFromPoints(transformed);

  // Transform holes too
  for (const hole of shape.holes) {
    const holePts = hole.getPoints(16).map((p) => {
      return new THREE.Vector2(p.x, p.y).applyMatrix3(matrix);
    });
    const newHole = new THREE.Path();
    newHole.setFromPoints(holePts);
    scaledShape.holes.push(newHole);
  }

  return scaledShape;
}

function createDefaultShape(size: number): THREE.Shape {
  const half = size / 2;
  const r = size * 0.1;
  const shape = new THREE.Shape();
  shape.moveTo(-half + r, -half);
  shape.lineTo(half - r, -half);
  shape.quadraticCurveTo(half, -half, half, -half + r);
  shape.lineTo(half, half - r);
  shape.quadraticCurveTo(half, half, half - r, half);
  shape.lineTo(-half + r, half);
  shape.quadraticCurveTo(-half, half, -half, half - r);
  shape.lineTo(-half, -half + r);
  shape.quadraticCurveTo(-half, -half, -half + r, -half);
  shape.closePath();
  return shape;
}
