import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

export interface ParsedSVG {
  shapes: THREE.Shape[];
  width: number;
  height: number;
}

export function parseSVGContent(svgContent: string): ParsedSVG {
  const loader = new SVGLoader();
  const data = loader.parse(svgContent);

  const shapes: THREE.Shape[] = [];

  for (const path of data.paths) {
    const pathShapes = SVGLoader.createShapes(path);
    shapes.push(...pathShapes);
  }

  // Parse viewBox or width/height to get dimensions
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");
  const svgEl = doc.querySelector("svg");

  let width = 100;
  let height = 100;

  if (svgEl) {
    const vb = svgEl.getAttribute("viewBox");
    if (vb) {
      const parts = vb.split(/[\s,]+/).map(Number);
      if (parts.length === 4) {
        width = parts[2];
        height = parts[3];
      }
    } else {
      const w = parseFloat(svgEl.getAttribute("width") || "100");
      const h = parseFloat(svgEl.getAttribute("height") || "100");
      if (!isNaN(w)) width = w;
      if (!isNaN(h)) height = h;
    }
  }

  return { shapes, width, height };
}

/**
 * Create a square hole shape (for the keycap negative space)
 * centered at the given position with the given size
 */
export function createSquareHole(centerX: number, centerY: number, size: number): THREE.Path {
  const half = size / 2;
  const hole = new THREE.Path();
  hole.moveTo(centerX - half, centerY - half);
  hole.lineTo(centerX + half, centerY - half);
  hole.lineTo(centerX + half, centerY + half);
  hole.lineTo(centerX - half, centerY + half);
  hole.closePath();
  return hole;
}

/**
 * Create a circle shape for the peg
 */
export function createCircle(centerX: number, centerY: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.absarc(centerX, centerY, radius, 0, Math.PI * 2, false);
  return shape;
}
