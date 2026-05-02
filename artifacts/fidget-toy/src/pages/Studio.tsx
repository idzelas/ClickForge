import { useState, useRef, useCallback, useMemo, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Grid } from "@react-three/drei";
import * as THREE from "three";
import { useLocation, Link } from "wouter";
import { useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateProject,
  useUpdateProject,
  useGetProject,
  getGetProjectQueryKey,
  getListProjectsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { parseSVGContent } from "@/lib/svgParser";
import {
  createOuterShellGeometry,
  createInnerClickerGeometry,
} from "@/lib/fidgetGeometry";
import { exportSTL, export3MF } from "@/lib/exporters";
import {
  Upload,
  Download,
  Save,
  LayoutList,
  LogOut,
  ChevronLeft,
  Box,
} from "lucide-react";
import { useClerk } from "@clerk/react";

interface FidgetSettings {
  extrudeDepth: number;
  keycapSize: number;
  pegRadius: number;
}

interface ParsedSVGState {
  shapes: THREE.Shape[];
  width: number;
  height: number;
  rawSvg: string;
  fileName: string;
}

function OuterShellMesh({
  shapes,
  settings,
  svgWidth,
  svgHeight,
  meshRef,
}: {
  shapes: THREE.Shape[];
  settings: FidgetSettings;
  svgWidth: number;
  svgHeight: number;
  meshRef: React.RefObject<THREE.Mesh | null>;
}) {
  const geometry = useMemo(
    () => createOuterShellGeometry(shapes, settings, svgWidth, svgHeight),
    [shapes, settings, svgWidth, svgHeight]
  );

  return (
    <mesh ref={meshRef} position={[-25, 0, 0]} castShadow receiveShadow>
      <primitive object={geometry} />
      <meshStandardMaterial color="#6C63FF" metalness={0.3} roughness={0.4} />
    </mesh>
  );
}

function InnerClickerMesh({
  shapes,
  settings,
  svgWidth,
  svgHeight,
  bodyRef,
  pegRef,
}: {
  shapes: THREE.Shape[];
  settings: FidgetSettings;
  svgWidth: number;
  svgHeight: number;
  bodyRef: React.RefObject<THREE.Mesh | null>;
  pegRef: React.RefObject<THREE.Mesh | null>;
}) {
  const { body, peg } = useMemo(
    () => createInnerClickerGeometry(shapes, settings, svgWidth, svgHeight),
    [shapes, settings, svgWidth, svgHeight]
  );

  const pegYOffset = -(settings.extrudeDepth * 0.7) / 2 - (settings.extrudeDepth * 0.5) / 2;

  return (
    <group position={[25, 0, 0]}>
      <mesh ref={bodyRef} castShadow receiveShadow>
        <primitive object={body} />
        <meshStandardMaterial color="#10B981" metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh ref={pegRef} position={[0, pegYOffset, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <primitive object={peg} />
        <meshStandardMaterial color="#059669" metalness={0.2} roughness={0.5} />
      </mesh>
    </group>
  );
}

function PlaceholderMeshes() {
  return (
    <>
      <mesh position={[-25, 0, 0]} castShadow>
        <boxGeometry args={[30, 30, 4]} />
        <meshStandardMaterial color="#6C63FF" opacity={0.3} transparent />
      </mesh>
      <mesh position={[25, 0, 0]} castShadow>
        <boxGeometry args={[20, 20, 3]} />
        <meshStandardMaterial color="#10B981" opacity={0.3} transparent />
      </mesh>
    </>
  );
}

export default function Studio() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [svgState, setSvgState] = useState<ParsedSVGState | null>(null);
  const [projectName, setProjectName] = useState("My Fidget Toy");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [settings, setSettings] = useState<FidgetSettings>({
    extrudeDepth: 4,
    keycapSize: 14,
    pegRadius: 3.5,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const outerMeshRef = useRef<THREE.Mesh | null>(null);
  const innerBodyRef = useRef<THREE.Mesh | null>(null);
  const innerPegRef = useRef<THREE.Mesh | null>(null);

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const handleSVGLoad = useCallback((content: string, fileName: string) => {
    try {
      const parsed = parseSVGContent(content);
      setSvgState({
        shapes: parsed.shapes,
        width: parsed.width,
        height: parsed.height,
        rawSvg: content,
        fileName,
      });
      setProjectName(fileName.replace(/\.svg$/i, ""));
      toast({ title: "SVG loaded", description: `Parsed ${parsed.shapes.length} shape(s) from ${fileName}` });
    } catch {
      toast({ title: "Failed to parse SVG", variant: "destructive" });
    }
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleSVGLoad(ev.target?.result as string, file.name);
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".svg")) {
      const reader = new FileReader();
      reader.onload = (ev) => handleSVGLoad(ev.target?.result as string, file.name);
      reader.readAsText(file);
    } else {
      toast({ title: "Please drop an SVG file", variant: "destructive" });
    }
  };

  const getMeshes = (): THREE.Mesh[] => {
    const meshes: THREE.Mesh[] = [];
    if (outerMeshRef.current) meshes.push(outerMeshRef.current);
    if (innerBodyRef.current) meshes.push(innerBodyRef.current);
    if (innerPegRef.current) meshes.push(innerPegRef.current);
    return meshes;
  };

  const handleExportSTL = () => {
    const meshes = getMeshes();
    if (meshes.length === 0) {
      toast({ title: "Nothing to export yet", description: "Upload an SVG first", variant: "destructive" });
      return;
    }
    exportSTL(meshes);
    toast({ title: "STL exported" });
  };

  const handleExport3MF = async () => {
    const meshes = getMeshes();
    if (meshes.length === 0) {
      toast({ title: "Nothing to export yet", description: "Upload an SVG first", variant: "destructive" });
      return;
    }
    await export3MF(meshes);
    toast({ title: "3MF exported" });
  };

  const handleSave = async () => {
    if (!svgState) {
      toast({ title: "Upload an SVG first", variant: "destructive" });
      return;
    }
    try {
      if (projectId) {
        await updateProject.mutateAsync({
          id: projectId,
          data: {
            name: projectName,
            svgData: svgState.rawSvg,
            ...settings,
          },
        });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        toast({ title: "Project saved" });
      } else {
        const project = await createProject.mutateAsync({
          data: {
            name: projectName,
            svgData: svgState.rawSvg,
            ...settings,
          },
        });
        setProjectId(project.id);
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({ title: "Project created", description: project.name });
      }
    } catch {
      toast({ title: "Failed to save project", variant: "destructive" });
    }
  };

  const isSaving = createProject.isPending || updateProject.isPending;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-go-home">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Home
            </Button>
          </Link>
          <img src="/logo.svg" alt="ClickForge" className="h-6 w-6" />
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="h-8 w-48 text-sm font-medium"
            data-testid="input-project-name"
          />
          {projectId && (
            <Badge variant="secondary" data-testid="badge-saved">Saved</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/projects">
            <Button variant="ghost" size="sm" data-testid="link-projects">
              <LayoutList className="h-4 w-4 mr-1" />
              My Projects
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut(() => setLocation("/"))}
            data-testid="button-sign-out"
          >
            <LogOut className="h-4 w-4 mr-1" />
            {user?.firstName || "Sign out"}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar: controls */}
        <aside className="w-72 border-r border-border bg-card flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Upload */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Upload SVG
              </h2>
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary hover:bg-accent/50"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                data-testid="dropzone-svg"
              >
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {svgState ? (
                    <span className="text-foreground font-medium">{svgState.fileName}</span>
                  ) : (
                    "Drop SVG or click to browse"
                  )}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".svg"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-svg-file"
              />
            </div>

            {/* Settings */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Dimensions
              </h2>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <Label className="text-xs" data-testid="label-extrude-depth">Extrude Depth</Label>
                    <span className="text-xs font-mono text-muted-foreground" data-testid="value-extrude-depth">
                      {settings.extrudeDepth.toFixed(1)} mm
                    </span>
                  </div>
                  <Slider
                    min={2}
                    max={20}
                    step={0.5}
                    value={[settings.extrudeDepth]}
                    onValueChange={([v]) => setSettings((s) => ({ ...s, extrudeDepth: v }))}
                    data-testid="slider-extrude-depth"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <Label className="text-xs" data-testid="label-keycap-size">Keycap Square</Label>
                    <span className="text-xs font-mono text-muted-foreground" data-testid="value-keycap-size">
                      {settings.keycapSize.toFixed(1)} mm
                    </span>
                  </div>
                  <Slider
                    min={10}
                    max={20}
                    step={0.5}
                    value={[settings.keycapSize]}
                    onValueChange={([v]) => setSettings((s) => ({ ...s, keycapSize: v }))}
                    data-testid="slider-keycap-size"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <Label className="text-xs" data-testid="label-peg-radius">Peg Radius</Label>
                    <span className="text-xs font-mono text-muted-foreground" data-testid="value-peg-radius">
                      {settings.pegRadius.toFixed(1)} mm
                    </span>
                  </div>
                  <Slider
                    min={2}
                    max={6}
                    step={0.1}
                    value={[settings.pegRadius]}
                    onValueChange={([v]) => setSettings((s) => ({ ...s, pegRadius: v }))}
                    data-testid="slider-peg-radius"
                  />
                </div>
              </div>
            </div>

            {/* Parts legend */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Parts
              </h2>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="inline-block h-3 w-3 rounded-sm bg-[#6C63FF]" />
                  <span>Outer shell (left)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="inline-block h-3 w-3 rounded-sm bg-[#10B981]" />
                  <span>Inner clicker (right)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="inline-block h-3 w-3 rounded-sm bg-[#059669]" />
                  <span>Connector peg</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={handleSave}
                disabled={isSaving || !svgState}
                data-testid="button-save-project"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : projectId ? "Update Project" : "Save Project"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleExportSTL}
                disabled={!svgState}
                data-testid="button-export-stl"
              >
                <Download className="h-4 w-4 mr-2" />
                Export STL
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleExport3MF}
                disabled={!svgState}
                data-testid="button-export-3mf"
              >
                <Download className="h-4 w-4 mr-2" />
                Export 3MF
              </Button>
            </div>
          </div>
        </aside>

        {/* 3D canvas */}
        <main className="flex-1 relative">
          {!svgState && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
              <Box className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">Upload an SVG to see your fidget toy</p>
            </div>
          )}
          <Canvas
            camera={{ position: [0, 30, 80], fov: 45 }}
            shadows
            style={{ background: "hsl(240 15% 8%)" }}
            data-testid="canvas-3d"
          >
            <ambientLight intensity={0.5} />
            <directionalLight position={[40, 60, 30]} intensity={1.2} castShadow />
            <directionalLight position={[-30, 20, -20]} intensity={0.4} />

            <Suspense fallback={null}>
              {svgState ? (
                <>
                  <OuterShellMesh
                    shapes={svgState.shapes}
                    settings={settings}
                    svgWidth={svgState.width}
                    svgHeight={svgState.height}
                    meshRef={outerMeshRef}
                  />
                  <InnerClickerMesh
                    shapes={svgState.shapes}
                    settings={settings}
                    svgWidth={svgState.width}
                    svgHeight={svgState.height}
                    bodyRef={innerBodyRef}
                    pegRef={innerPegRef}
                  />
                </>
              ) : (
                <PlaceholderMeshes />
              )}
            </Suspense>

            <Grid
              args={[200, 200]}
              cellSize={5}
              cellThickness={0.5}
              cellColor="#1e1e2e"
              sectionSize={20}
              sectionThickness={1}
              sectionColor="#2e2e4e"
              fadeDistance={150}
              position={[0, -20, 0]}
            />

            <OrbitControls makeDefault enablePan enableZoom enableRotate />
          </Canvas>

          {/* Camera hint */}
          <div className="absolute bottom-4 right-4 text-xs text-muted-foreground bg-card/80 backdrop-blur px-2 py-1 rounded">
            Drag to rotate &bull; Scroll to zoom
          </div>

          {/* Part labels */}
          {svgState && (
            <>
              <div className="absolute top-4 left-[calc(25%-80px)] text-xs font-medium text-white/70 bg-[#6C63FF]/20 border border-[#6C63FF]/30 rounded px-2 py-1">
                Outer Shell
              </div>
              <div className="absolute top-4 right-[calc(25%-80px)] text-xs font-medium text-white/70 bg-[#10B981]/20 border border-[#10B981]/30 rounded px-2 py-1">
                Inner Clicker
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
