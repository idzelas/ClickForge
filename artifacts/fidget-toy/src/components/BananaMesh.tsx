import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const BANANA_TARGET_WIDTH_MM = 200;
const REST_Y_MM = 18;
const DROP_HEIGHT_MM = 140;
const BED_OFFSET_Z_MM = 90;
const ANIM_DURATION_S = 0.85;

function dampedSpring(t: number): number {
  const decay = 5.5;
  const freq = 9;
  return 1 - Math.exp(-decay * t) * Math.cos(freq * t);
}

function taperFactor(t: number, endScale: number): number {
  const x = Math.sin(Math.PI * t);
  return endScale + (1 - endScale) * Math.pow(x, 0.6);
}

export default function BananaMesh() {
  const groupRef = useRef<THREE.Group>(null);
  const startTimeRef = useRef<number | null>(null);

  const { geometry, scale, capRadius, startPoint, endPoint } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.00, -0.30, 0),
      new THREE.Vector3(-0.65,  0.05, 0),
      new THREE.Vector3( 0.00,  0.25, 0),
      new THREE.Vector3( 0.65,  0.05, 0),
      new THREE.Vector3( 1.00, -0.30, 0),
    ]);
    const tubularSegments = 14;
    const radialSegments = 7;
    const radius = 0.16;
    const endScale = 0.525;
    const geom = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);

    const pos = geom.attributes.position;
    const ringVerts = radialSegments + 1;
    const tmp = new THREE.Vector3();
    for (let i = 0; i <= tubularSegments; i++) {
      const t = i / tubularSegments;
      const center = curve.getPointAt(t);
      const factor = taperFactor(t, endScale);
      for (let j = 0; j < ringVerts; j++) {
        const idx = i * ringVerts + j;
        tmp.fromBufferAttribute(pos, idx);
        tmp.sub(center).multiplyScalar(factor).add(center);
        pos.setXYZ(idx, tmp.x, tmp.y, tmp.z);
      }
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
    geom.computeBoundingBox();

    const bb = geom.boundingBox!;
    const start = curve.getPointAt(0);
    const end = curve.getPointAt(1);
    const minX = Math.min(bb.min.x, start.x - radius * endScale, end.x - radius * endScale);
    const maxX = Math.max(bb.max.x, start.x + radius * endScale, end.x + radius * endScale);
    const s = BANANA_TARGET_WIDTH_MM / (maxX - minX);
    return {
      geometry: geom,
      scale: s,
      capRadius: radius * endScale,
      startPoint: start,
      endPoint: end,
    };
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime;
    }
    const elapsed = state.clock.elapsedTime - startTimeRef.current;
    g.position.z = BED_OFFSET_Z_MM;
    if (elapsed >= ANIM_DURATION_S) {
      g.position.y = REST_Y_MM;
      return;
    }
    const t = elapsed / ANIM_DURATION_S;
    const eased = dampedSpring(t);
    g.position.y = REST_Y_MM + DROP_HEIGHT_MM * (1 - eased);
  });

  return (
    <group
      ref={groupRef}
      position={[0, REST_Y_MM + DROP_HEIGHT_MM, BED_OFFSET_Z_MM]}
    >
      <group scale={scale} rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={geometry} raycast={() => null}>
          <meshStandardMaterial color="#FFE135" roughness={0.55} metalness={0.05} flatShading />
        </mesh>
        <mesh position={[startPoint.x, startPoint.y, startPoint.z]} raycast={() => null}>
          <sphereGeometry args={[capRadius, 10, 8]} />
          <meshStandardMaterial color="#5C3A1E" roughness={0.85} metalness={0} flatShading />
        </mesh>
        <mesh position={[endPoint.x, endPoint.y, endPoint.z]} raycast={() => null}>
          <sphereGeometry args={[capRadius, 10, 8]} />
          <meshStandardMaterial color="#5C3A1E" roughness={0.85} metalness={0} flatShading />
        </mesh>
      </group>
    </group>
  );
}
