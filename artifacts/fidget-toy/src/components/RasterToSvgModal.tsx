import { useState, useEffect, useRef, useCallback } from "react";
import { X, Download, ArrowRight, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
// @ts-ignore — no types for imagetracerjs
import ImageTracer from "imagetracerjs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  file: File;
  onClose: () => void;
  /** Called with the final SVG string + source filename when user clicks "Use as clicker shape" */
  onApply: (svgString: string, fileName: string) => void;
}

interface TraceOptions {
  numColors: number;
  /** 1 = most detail, 10 = most simplified */
  simplification: number;
  removeBackground: boolean;
  bgTolerance: number;
}

const DEFAULT_OPTS: TraceOptions = {
  numColors: 4,
  simplification: 3,
  removeBackground: true,
  bgTolerance: 40,
};

const MAX_DIM = 800;

// ---------------------------------------------------------------------------
// Background removal — BFS flood-fill from every corner
// ---------------------------------------------------------------------------

function floodFillBackground(imageData: ImageData, tolerance: number): ImageData {
  const { data, width, height } = imageData;
  const result = new Uint8ClampedArray(data);
  const visited = new Uint8Array(width * height);

  const corners: [number, number][] = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];

  for (const [cx, cy] of corners) {
    const ci = (cy * width + cx) * 4;
    if (data[ci + 3] < 128) continue;
    const cr = data[ci], cg = data[ci + 1], cb = data[ci + 2];

    const pi = cy * width + cx;
    if (visited[pi]) continue;
    visited[pi] = 1;

    const queue: number[] = [pi];
    let head = 0;

    while (head < queue.length) {
      const p = queue[head++];
      const di = p * 4;

      const dist = Math.sqrt(
        (data[di] - cr) ** 2 + (data[di + 1] - cg) ** 2 + (data[di + 2] - cb) ** 2
      );
      if (dist > tolerance) continue;

      result[di + 3] = 0;

      const py = Math.floor(p / width);
      const px = p % width;
      const nbrs: [number, number][] = [
        [px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1],
      ];
      for (const [nx, ny] of nbrs) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (!visited[ni]) { visited[ni] = 1; queue.push(ni); }
      }
    }
  }

  return new ImageData(result, width, height);
}

// ---------------------------------------------------------------------------
// Draw image to a resized canvas, return ImageData + canvas
// ---------------------------------------------------------------------------

async function loadImageData(
  file: File,
  removeBackground: boolean,
  bgTolerance: number
): Promise<{ imageData: ImageData; canvas: HTMLCanvasElement }> {
  const url = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);

      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > MAX_DIM || h > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;

      // White background for JPEG (no alpha)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      let imageData = ctx.getImageData(0, 0, w, h);
      if (removeBackground) {
        imageData = floodFillBackground(imageData, bgTolerance);
        ctx.putImageData(imageData, 0, 0);
      }

      resolve({ imageData, canvas });
    };
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Run imagetracerjs
// ---------------------------------------------------------------------------

function traceToSVG(imageData: ImageData, opts: TraceOptions): string {
  // ltres/qtres: 1=high detail, 10=simplified. Invert + scale to tracer units.
  const ltres = opts.simplification * 1.2;
  const qtres = opts.simplification * 1.2;

  const svgStr: string = ImageTracer.imagedataToSVG(imageData, {
    numberofcolors: opts.numColors,
    ltres,
    qtres,
    scale: 1,
    strokewidth: 0,
    linefilter: opts.simplification > 5,
    rightangleenhance: false,
  });

  return svgStr;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadSVG(svg: string, name: string) {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <label className="text-xs font-medium text-foreground">{label}</label>
        <span className="text-xs text-muted-foreground tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full accent-primary cursor-pointer"
      />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function RasterToSvgModal({ file, onClose, onApply }: Props) {
  const [opts, setOpts] = useState<TraceOptions>(DEFAULT_OPTS);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [svgOutput, setSvgOutput] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestOpts = useRef(opts);
  latestOpts.current = opts;

  // Original image preview URL
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Run tracing (debounced)
  const runTrace = useCallback(
    async (currentOpts: TraceOptions) => {
      setIsProcessing(true);
      setError(null);
      try {
        const { imageData } = await loadImageData(
          file,
          currentOpts.removeBackground,
          currentOpts.bgTolerance
        );
        const svg = traceToSVG(imageData, currentOpts);
        setSvgOutput(svg);
      } catch (e) {
        setError("Conversion failed — try adjusting the settings.");
        console.error(e);
      } finally {
        setIsProcessing(false);
      }
    },
    [file]
  );

  // Debounce re-trace on option changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runTrace(latestOpts.current);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts, runTrace]);

  const svgDataUrl = svgOutput
    ? `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgOutput)))}`
    : null;

  const baseName = file.name.replace(/\.(png|jpe?g|webp)$/i, "");
  const svgFileName = `${baseName}.svg`;

  const handleApply = () => {
    if (svgOutput) onApply(svgOutput, svgFileName);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
    >
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: "min(960px, 96vw)", maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Convert Image to SVG</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{file.name}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Previews */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Before */}
            <div className="flex-1 flex flex-col border-r border-border">
              <div className="px-4 py-2 border-b border-border shrink-0">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Original</span>
              </div>
              <div className="flex-1 flex items-center justify-center bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] overflow-hidden p-4">
                {originalUrl ? (
                  <img
                    src={originalUrl}
                    alt="Original"
                    className="max-w-full max-h-full object-contain rounded"
                  />
                ) : (
                  <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                )}
              </div>
            </div>

            {/* After */}
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-2 border-b border-border shrink-0">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">SVG Preview</span>
              </div>
              <div className="flex-1 flex items-center justify-center bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] overflow-hidden p-4 relative">
                {isProcessing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-card/60 backdrop-blur-sm z-10">
                    <Loader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                )}
                {svgDataUrl && !error ? (
                  <img
                    src={svgDataUrl}
                    alt="SVG output"
                    className="max-w-full max-h-full object-contain rounded"
                  />
                ) : error ? (
                  <p className="text-xs text-destructive text-center px-4">{error}</p>
                ) : (
                  <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                )}
              </div>
            </div>
          </div>

          {/* Controls panel */}
          <div className="w-64 shrink-0 border-l border-border flex flex-col overflow-y-auto">
            <div className="p-4 space-y-5">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Adjust settings below — the SVG preview updates automatically.
              </p>

              {/* Colors */}
              <SliderControl
                label="Colors"
                value={opts.numColors}
                min={1}
                max={24}
                step={1}
                onChange={(v) => setOpts((o) => ({ ...o, numColors: v }))}
                hint="Fewer = simpler, bolder shapes"
              />

              {/* Simplification */}
              <SliderControl
                label="Path simplification"
                value={opts.simplification}
                min={1}
                max={10}
                step={1}
                onChange={(v) => setOpts((o) => ({ ...o, simplification: v }))}
                hint="Higher = smoother, less detailed outlines"
              />

              {/* Remove background */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={opts.removeBackground}
                    onChange={(e) =>
                      setOpts((o) => ({ ...o, removeBackground: e.target.checked }))
                    }
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <span className="text-xs font-medium text-foreground">Remove background</span>
                </label>

                {opts.removeBackground && (
                  <div className="pl-6">
                    <SliderControl
                      label="Tolerance"
                      value={opts.bgTolerance}
                      min={5}
                      max={120}
                      step={1}
                      onChange={(v) => setOpts((o) => ({ ...o, bgTolerance: v }))}
                      hint="Higher = remove more similar colors"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0 gap-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Continuing will use this SVG as the inner clicker shape.
          </p>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={!svgOutput || isProcessing}
              onClick={() => svgOutput && downloadSVG(svgOutput, svgFileName)}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Download SVG
            </Button>
            <Button
              size="sm"
              disabled={!svgOutput || isProcessing}
              onClick={handleApply}
              className="gap-1.5"
            >
              Use as clicker shape
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
