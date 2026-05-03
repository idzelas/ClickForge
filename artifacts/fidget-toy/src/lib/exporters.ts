import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import JSZip from "jszip";

export type MeshGroups = {
  shell: THREE.Mesh[];
  clicker: THREE.Mesh[];
  /** Optional key-ring lug mesh attached to the outer shell. */
  keyRing?: THREE.Mesh | null;
  /**
   * Optional flat per-color region bodies — always belong to the outer shell
   * assembly.  Each entry's `color` is a 6-char hex string (e.g. "#ff8800").
   */
  colorLayers?: Array<{ name: string; color: string; mesh: THREE.Mesh }>;
};

/**
 * A single export part: one mesh that becomes its own top-level object in
 * 3MF / its own `o` block in OBJ.  No boolean merging is performed — parts
 * are kept fully separate so slicers can assign per-part materials.
 */
type ExportPart = {
  name: string;
  mesh: THREE.Mesh;
  /** Optional 6-char hex color, e.g. "#ff8800". */
  color?: string;
};

// ---------------------------------------------------------------------------
// Build the canonical part list
// ---------------------------------------------------------------------------

/**
 * Convert MeshGroups into a flat ExportPart[].  Color layers are always
 * included as separate parts carrying their hex color so downstream writers
 * can emit per-part material info (3MF basematerials, OBJ vertex colors).
 */
function buildPartsFromGroups(groups: MeshGroups): ExportPart[] {
  const parts: ExportPart[] = [];

  groups.shell.forEach((m, i) =>
    parts.push({ name: m.name || `shell_${i + 1}`, mesh: m }),
  );
  if (groups.keyRing) {
    parts.push({ name: groups.keyRing.name || "key_ring", mesh: groups.keyRing });
  }
  groups.clicker.forEach((m, i) =>
    parts.push({ name: m.name || `clicker_${i + 1}`, mesh: m }),
  );
  (groups.colorLayers ?? []).forEach((c, i) =>
    parts.push({
      name: c.name || `color_layer_${i + 1}`,
      mesh: c.mesh,
      color: c.color,
    }),
  );

  return parts;
}

// ---------------------------------------------------------------------------
// STL — geometry-only, no color support
// ---------------------------------------------------------------------------

/**
 * Single-file STL containing every shell + clicker mesh in one scene.
 * Color layers are intentionally dropped (STL has no color concept); callers
 * should warn the user beforehand when colorLayers are present.
 */
export function exportSTL(groups: MeshGroups): void {
  const exporter = new STLExporter();
  const scene = new THREE.Scene();
  // Color layers omitted — STL is color-blind.
  for (const m of groups.shell) scene.add(cloneMeshForExport(m));
  if (groups.keyRing) scene.add(cloneMeshForExport(groups.keyRing));
  for (const m of groups.clicker) scene.add(cloneMeshForExport(m));
  const stlString = exporter.parse(scene, { binary: false });
  downloadBlob(
    new Blob([stlString], { type: "application/octet-stream" }),
    "fidget-toy.stl",
  );
}

/**
 * Two-file STL zip: outer_shell.stl (shell + key ring) and inner_clicker.stl.
 * Color layers are still dropped — same color-blind limitation as STL itself.
 */
export async function exportSTLMerged(groups: MeshGroups): Promise<void> {
  const exporter = new STLExporter();
  const zip = new JSZip();

  const shellMeshes = groups.keyRing ? [...groups.shell, groups.keyRing] : groups.shell;
  if (shellMeshes.length > 0) {
    const scene = new THREE.Scene();
    for (const m of shellMeshes) scene.add(cloneMeshForExport(m));
    zip.file("outer_shell.stl", exporter.parse(scene, { binary: false }));
  }

  if (groups.clicker.length > 0) {
    const scene = new THREE.Scene();
    for (const m of groups.clicker) scene.add(cloneMeshForExport(m));
    zip.file("inner_clicker.stl", exporter.parse(scene, { binary: false }));
  }

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, "fidget-toy-parts.zip");
}

// ---------------------------------------------------------------------------
// 3MF — per-part objects with optional color via the m: material extension
// ---------------------------------------------------------------------------

/**
 * Emit a 3MF where every shell/clicker mesh and every color layer is its own
 * top-level <object> in the build list.  Colored parts reference a single
 * <m:basematerials> resource via `pid` + `pindex` so slicers (PrusaSlicer,
 * Bambu Studio, Cura, etc.) pick up the per-part color.
 *
 * No boolean merging happens here — keeping parts separate is precisely what
 * makes per-part color work in slicers.
 */
export async function export3MF(groups: MeshGroups): Promise<void> {
  const parts = buildPartsFromGroups(groups);
  if (parts.length === 0) return;
  const xml = buildPartsXml(parts);
  const blob = await buildZip(xml);
  downloadBlob(blob, "fidget-toy.3mf");
}

// ---------------------------------------------------------------------------
// OBJ — per-part `o` blocks; colored parts use the vertex-color extension
// ---------------------------------------------------------------------------

/**
 * Emit a single .obj file where every part is its own `o name` block.  Color
 * layers use the widely-supported OBJ extension `v x y z r g b` so loaders
 * like Blender, MeshLab, and Bambu Studio render the per-vertex color.  No
 * boolean merging happens; uncolored parts (shell/clicker) use the standard
 * `v x y z` form.
 */
export function exportOBJ(groups: MeshGroups): void {
  const parts = buildPartsFromGroups(groups);
  if (parts.length === 0) return;

  let text = "# fidget-toy.obj\n";
  let vertexOffset = 0;

  for (const part of parts) {
    const written = writeObjPart(part, vertexOffset);
    text += written.text;
    vertexOffset += written.vertexCount;
  }

  downloadBlob(new Blob([text], { type: "text/plain" }), "fidget-toy.obj");
}

// ---------------------------------------------------------------------------
// Backwards-compat aliases
// ---------------------------------------------------------------------------
//
// Older call sites pass through a "merged" toggle.  With the new per-part
// path there's no actual difference — colors and per-part separation are
// always preserved — so the *Merged variants are thin aliases.

export const export3MFMerged = export3MF;
export const exportOBJMerged: (g: MeshGroups) => void = exportOBJ;

// ---------------------------------------------------------------------------
// 3MF builder
// ---------------------------------------------------------------------------

function buildPartsXml(parts: ExportPart[]): string {
  // One basematerials resource shared by all colored parts; index = order of
  // first appearance.  Uncolored parts simply omit pid/pindex.
  const colorIndex = new Map<string, number>();
  const colorOrder: string[] = [];
  for (const p of parts) {
    if (!p.color) continue;
    const key = p.color.toLowerCase();
    if (!colorIndex.has(key)) {
      colorIndex.set(key, colorOrder.length);
      colorOrder.push(p.color);
    }
  }

  let resourcesXml = "";
  let buildXml = "";
  let nextId = 1;

  let basematerialsId = 0;
  if (colorOrder.length > 0) {
    basematerialsId = nextId++;
    let basesXml = "";
    for (const hex of colorOrder) {
      const display = normalizeHexForDisplay(hex);
      basesXml += `<m:base name="${xmlAttrEscape(display)}" displaycolor="${xmlAttrEscape(display)}" />`;
    }
    resourcesXml += `<m:basematerials id="${basematerialsId}">${basesXml}</m:basematerials>`;
  }

  for (const part of parts) {
    const id = nextId++;
    const { vertices, triangles } = meshToVerticesAndTriangles(part.mesh);

    const colorAttrs =
      part.color && colorIndex.has(part.color.toLowerCase())
        ? ` pid="${basematerialsId}" pindex="${colorIndex.get(part.color.toLowerCase())}"`
        : "";

    // pid/pindex on both <object> and <mesh> for max slicer compatibility.
    resourcesXml += `<object id="${id}" name="${xmlAttrEscape(part.name)}" type="model"${colorAttrs}><mesh${colorAttrs}><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh></object>`;
    buildXml += `<item objectid="${id}" />`;
  }

  const requiredExt = colorOrder.length > 0 ? ` requiredextensions="m"` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"${requiredExt}>
  <resources>${resourcesXml}</resources>
  <build>${buildXml}</build>
</model>`;
}

/** Emit `<vertices>…</vertices><triangles>…</triangles>` for one mesh. */
function meshToVerticesAndTriangles(mesh: THREE.Mesh): {
  vertices: string;
  triangles: string;
} {
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld);

  let verts = "";
  let tris = "";

  if (geo.index) {
    const pos = geo.attributes.position;
    const idx = geo.index;
    for (let i = 0; i < pos.count; i++) {
      verts += `<vertex x="${pos.getX(i).toFixed(4)}" y="${pos.getY(i).toFixed(4)}" z="${pos.getZ(i).toFixed(4)}" />`;
    }
    for (let i = 0; i < idx.count; i += 3) {
      tris += `<triangle v1="${idx.getX(i)}" v2="${idx.getX(i + 1)}" v3="${idx.getX(i + 2)}" />`;
    }
  } else {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      verts += `<vertex x="${pos.getX(i).toFixed(4)}" y="${pos.getY(i).toFixed(4)}" z="${pos.getZ(i).toFixed(4)}" />`;
    }
    const triCount = pos.count / 3;
    for (let i = 0; i < triCount; i++) {
      const a = i * 3;
      tris += `<triangle v1="${a}" v2="${a + 1}" v3="${a + 2}" />`;
    }
  }
  return { vertices: verts, triangles: tris };
}

/** Ensure hex is in "#RRGGBB" form (3MF displaycolor requires this). */
function normalizeHexForDisplay(hex: string): string {
  let h = hex.trim();
  if (!h.startsWith("#")) h = `#${h}`;
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return h.toUpperCase();
}

function xmlAttrEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function buildZip(modelXml: string): Promise<Blob> {
  const zip = new JSZip();
  zip.file("3D/3dmodel.model", modelXml);
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" /></Relationships>`,
  );
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" /><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" /></Types>`,
  );
  return zip.generateAsync({ type: "blob" });
}

// ---------------------------------------------------------------------------
// OBJ builder
// ---------------------------------------------------------------------------

/**
 * Write one ExportPart as an `o name` block.  Colored parts use the OBJ
 * vertex-color extension `v x y z r g b`; uncolored parts use the standard
 * `v x y z` form.  Faces use 1-indexed global vertex numbering offset by
 * `vertexOffsetIn` (the count of `v` lines already written earlier).
 */
function writeObjPart(
  part: ExportPart,
  vertexOffsetIn: number,
): { text: string; vertexCount: number } {
  const geo = part.mesh.geometry.clone();
  geo.applyMatrix4(part.mesh.matrixWorld);
  const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
  const pos = nonIndexed.attributes.position;
  if (!pos || pos.count === 0) return { text: "", vertexCount: 0 };

  const colored = !!part.color;
  let rgbSuffix = "";
  if (colored) {
    const [r, g, b] = hexToRgb01(part.color!);
    rgbSuffix = ` ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`;
  }

  let text = `o ${objSafeName(part.name)}\n`;
  for (let i = 0; i < pos.count; i++) {
    text +=
      `v ${pos.getX(i).toFixed(6)} ${pos.getY(i).toFixed(6)} ${pos.getZ(i).toFixed(6)}` +
      rgbSuffix +
      "\n";
  }
  const triCount = pos.count / 3;
  for (let i = 0; i < triCount; i++) {
    const a = vertexOffsetIn + i * 3 + 1; // OBJ is 1-indexed
    text += `f ${a} ${a + 1} ${a + 2}\n`;
  }
  return { text, vertexCount: pos.count };
}

function objSafeName(name: string): string {
  // OBJ object names can't contain whitespace; replace with underscores.
  return name.replace(/\s+/g, "_") || "part";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert "#rrggbb" or "#rgb" to [r, g, b] floats in [0, 1]. */
function hexToRgb01(hex: string): [number, number, number] {
  const full =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  const r = parseInt(full.slice(1, 3), 16) / 255;
  const g = parseInt(full.slice(3, 5), 16) / 255;
  const b = parseInt(full.slice(5, 7), 16) / 255;
  return [r, g, b];
}

/** Clone a mesh and bake its world transform into the geometry. */
function cloneMeshForExport(mesh: THREE.Mesh): THREE.Mesh {
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld);
  const out = new THREE.Mesh(geo);
  out.name = mesh.name;
  return out;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
