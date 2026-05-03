import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

export interface ParsedSVG {
  shapes: THREE.Shape[];
  width: number;
  height: number;
}

/**
 * Returns true when a <rect> element is invisible — no fill and no visible stroke.
 * These are artboard boundary markers from Illustrator / Figma / Affinity Designer.
 */
function isInvisibleRect(el: Element): boolean {
  const fill   = (el.getAttribute("fill")   ?? "").trim();
  const stroke = (el.getAttribute("stroke") ?? "").trim();
  const sw     = parseFloat(el.getAttribute("stroke-width") ?? "0");

  // Also check inline style overrides
  const style = (el.getAttribute("style") ?? "");
  const styleFill   = style.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i)?.[1]?.trim() ?? "";
  const styleStroke = style.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/i)?.[1]?.trim() ?? "";
  const styleSW     = parseFloat(style.match(/(?:^|;)\s*stroke-width\s*:\s*([^;]+)/i)?.[1] ?? "0");

  const effectiveFill   = styleFill   || fill;
  const effectiveStroke = styleStroke || stroke;
  const effectiveSW     = isNaN(styleSW) ? sw : styleSW;

  const noFill   = effectiveFill   === "" || effectiveFill   === "none";
  const noStroke = effectiveStroke === "" || effectiveStroke === "none" || effectiveSW === 0;

  return noFill && noStroke;
}

export function parseSVGContent(svgContent: string): ParsedSVG {
  // ── 1. Strip invisible artboard rects before parsing ───────────────────
  // Illustrator / Figma / Affinity often emit a <rect> that spans the
  // artboard (fill="none", no stroke) as a bounding-box placeholder.
  // These are NOT visual content — strip them before anything else so they
  // don't inflate the bounding box.
  const domParser = new DOMParser();
  const doc       = domParser.parseFromString(svgContent, "image/svg+xml");
  const svgEl     = doc.querySelector("svg");

  if (svgEl) {
    for (const rect of Array.from(doc.querySelectorAll("rect"))) {
      if (isInvisibleRect(rect)) rect.parentElement?.removeChild(rect);
    }
  }

  const cleanedSvg = new XMLSerializer().serializeToString(doc);

  // ── 2. Parse visible paths with Three.js SVGLoader ─────────────────────
  const loader = new SVGLoader();
  const data   = loader.parse(cleanedSvg);

  const rawShapes: THREE.Shape[] = [];
  for (const path of data.paths) {
    rawShapes.push(...SVGLoader.createShapes(path));
  }

  // ── 3. Fallback dimensions from viewBox / width+height ─────────────────
  // Used only when there is no visible content at all.
  let fallbackW = 100, fallbackH = 100;
  if (svgEl) {
    const vb = svgEl.getAttribute("viewBox");
    if (vb) {
      const parts = vb.split(/[\s,]+/).map(Number);
      if (parts.length === 4) { fallbackW = parts[2]; fallbackH = parts[3]; }
    } else {
      const w = parseFloat(svgEl.getAttribute("width")  ?? "100");
      const h = parseFloat(svgEl.getAttribute("height") ?? "100");
      if (!isNaN(w)) fallbackW = w;
      if (!isNaN(h)) fallbackH = h;
    }
  }

  if (rawShapes.length === 0) {
    return { shapes: rawShapes, width: fallbackW, height: fallbackH };
  }

  // ── 4. Compute tight bounding box across all visible shape points ───────
  // Sample at 128 to match the downstream fidgetGeometry.ts pipeline which
  // also calls shape.getPoints(128).  Using the same resolution avoids
  // creating over-dense LineCurve polylines (Three.js LineCurves return all
  // their endpoints regardless of the `divisions` arg, so 256 sample points
  // would double the vertex count compared to 128).
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const shape of rawShapes) {
    for (const pt of shape.getPoints(128)) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  if (!isFinite(minX)) {
    return { shapes: rawShapes, width: fallbackW, height: fallbackH };
  }

  const tightW = maxX - minX;
  const tightH = maxY - minY;

  // ── 5. Translate shapes so tight bbox origin → (0, 0) ──────────────────
  // transformToMm in fidgetGeometry.ts centres using (svgWidth/2, svgHeight/2)
  // as the shape's centre.  After translation, (tightW/2, tightH/2) is the
  // true content centre, so the existing formula works correctly without any
  // changes to the geometry pipeline.
  // Using getPoints(128) keeps the translated shape at 128 segments — matching
  // the downstream sampling resolution and avoiding vertex-count doubling.
  const shapes = rawShapes.map(shape => {
    const outerPts = shape.getPoints(128).map(
      (p: THREE.Vector2) => new THREE.Vector2(p.x - minX, p.y - minY)
    );
    const s = new THREE.Shape();
    s.setFromPoints(outerPts);

    for (const hole of shape.holes) {
      const holePts = hole.getPoints(128).map(
        (p: THREE.Vector2) => new THREE.Vector2(p.x - minX, p.y - minY)
      );
      const h = new THREE.Path();
      h.setFromPoints(holePts);
      s.holes.push(h);
    }
    return s;
  });

  return { shapes, width: tightW, height: tightH };
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
