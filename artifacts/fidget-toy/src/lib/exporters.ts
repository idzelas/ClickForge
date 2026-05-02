import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import JSZip from "jszip";

export function exportSTL(meshes: THREE.Mesh[]): void {
  const exporter = new STLExporter();
  const scene = new THREE.Scene();
  meshes.forEach((m) => scene.add(m.clone()));
  const stlString = exporter.parse(scene, { binary: false });
  const blob = new Blob([stlString], { type: "application/octet-stream" });
  downloadBlob(blob, "fidget-toy.stl");
}

export async function export3MF(meshes: THREE.Mesh[]): Promise<void> {
  const zip = new JSZip();

  // Build 3MF XML
  let vertexOffset = 0;
  let verticesXml = "";
  let trianglesXml = "";

  for (const mesh of meshes) {
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);

    // Ensure indexed geometry
    if (!geo.index) {
      const nonIndexed = geo;
      const pos = nonIndexed.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        verticesXml += `<vertex x="${pos.getX(i).toFixed(4)}" y="${pos.getY(i).toFixed(4)}" z="${pos.getZ(i).toFixed(4)}" />`;
      }
      const triCount = pos.count / 3;
      for (let i = 0; i < triCount; i++) {
        const a = vertexOffset + i * 3;
        const b = a + 1;
        const c = a + 2;
        trianglesXml += `<triangle v1="${a}" v2="${b}" v3="${c}" />`;
      }
      vertexOffset += pos.count;
    } else {
      const pos = geo.attributes.position;
      const idx = geo.index;
      for (let i = 0; i < pos.count; i++) {
        verticesXml += `<vertex x="${pos.getX(i).toFixed(4)}" y="${pos.getY(i).toFixed(4)}" z="${pos.getZ(i).toFixed(4)}" />`;
      }
      for (let i = 0; i < idx.count; i += 3) {
        const a = vertexOffset + idx.getX(i);
        const b = vertexOffset + idx.getX(i + 1);
        const c = vertexOffset + idx.getX(i + 2);
        trianglesXml += `<triangle v1="${a}" v2="${b}" v3="${c}" />`;
      }
      vertexOffset += pos.count;
    }
  }

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>${verticesXml}</vertices>
        <triangles>${trianglesXml}</triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1" />
  </build>
</model>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
</Types>`;

  zip.file("3D/3dmodel.model", modelXml);
  zip.file("_rels/.rels", relsXml);
  zip.file("[Content_Types].xml", contentTypesXml);

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, "fidget-toy.3mf");
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
