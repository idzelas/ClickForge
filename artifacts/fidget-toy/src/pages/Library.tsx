import { useState, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, useUser } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSvgDesigns,
  useCreateSvgDesign,
  useDeleteSvgDesign,
  getListSvgDesignsQueryKey,
} from "@/hooks/useSvgDesigns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  Trash2,
  LogOut,
  FolderOpen,
  Upload,
  ImagePlus,
  X,
  Library as LibraryIcon,
  Plus,
} from "lucide-react";
import RasterToSvgModal from "@/components/RasterToSvgModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { setPendingLibrarySvg } from "@/lib/librarySession";
import { svgToDataUri } from "@/lib/svgPreview";

const RASTER_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default function Library() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const designs = useListSvgDesigns();
  const createDesign = useCreateSvgDesign();
  const deleteDesign = useDeleteSvgDesign();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [converterFile, setConverterFile] = useState<File | null>(null);
  const [showConverter, setShowConverter] = useState(false);

  const [saveDialog, setSaveDialog] = useState<{ svg: string; defaultName: string } | null>(null);
  const [saveName, setSaveName] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListSvgDesignsQueryKey(user?.id) });

  const onPickFile = (file: File) => {
    if (!RASTER_TYPES.includes(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      toast({
        title: "Unsupported file type",
        description: "Please upload a PNG, JPG, or WebP image.",
        variant: "destructive",
      });
      return;
    }
    setConverterFile(file);
    setShowConverter(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    onPickFile(file);
  };

  const handleSaveToLibrary = useCallback((svg: string, fileName: string) => {
    const baseName = fileName.replace(/\.svg$/i, "");
    setSaveDialog({ svg, defaultName: baseName });
    setSaveName(baseName);
  }, []);

  const submitSave = async () => {
    if (!saveDialog) return;
    const name = saveName.trim();
    if (!name) {
      toast({ title: "Please enter a name", variant: "destructive" });
      return;
    }
    try {
      await createDesign.mutateAsync({ name, svgData: saveDialog.svg });
      invalidate();
      toast({ title: "Saved to library", description: name });
      setSaveDialog(null);
      setShowConverter(false);
      setConverterFile(null);
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}" from your library?`)) return;
    try {
      await deleteDesign.mutateAsync(id);
      invalidate();
      toast({ title: "Design deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleOpenInStudio = (svgData: string, name: string) => {
    setPendingLibrarySvg({ svgData, name });
    setLocation("/studio");
  };

  const list = designs.data ?? [];
  const isLoading = designs.isLoading;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Link href="/studio">
            <Button variant="ghost" size="sm" data-testid="button-go-studio">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Studio
            </Button>
          </Link>
          <img src="/logo.svg" alt="ClickForge" className="h-6 w-6" />
          <span className="font-bold text-base flex items-center gap-1.5">
            <LibraryIcon className="h-4 w-4 text-primary" />
            SVG Library
          </span>
          <nav className="ml-4 flex items-center gap-1">
            <Link href="/projects">
              <Button variant="ghost" size="sm" data-testid="link-projects">
                My Projects
              </Button>
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { signOut(); setLocation("/"); }}
            data-testid="button-sign-out"
          >
            <LogOut className="h-4 w-4 mr-1" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {showConverter && converterFile ? (
          /* Inline converter takes over the page */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Convert image → SVG</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Trace the image, pick the shape, then save it to your library.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowConverter(false);
                  setConverterFile(null);
                }}
                data-testid="button-cancel-converter"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
            <RasterToSvgModal
              file={converterFile}
              inline
              onClose={() => {
                setShowConverter(false);
                setConverterFile(null);
              }}
              onSaveToLibrary={handleSaveToLibrary}
            />
          </div>
        ) : (
          <>
            {/* Convert entry point */}
            <Card className="mb-6 border-dashed border-2 hover:border-primary transition-colors">
              <CardContent className="py-6 px-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Convert image → SVG</p>
                    <p className="text-xs text-muted-foreground">
                      Upload a PNG, JPG or WebP — trace it, pick the shape, save it.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-open-converter"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose image
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </CardContent>
            </Card>

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {isLoading
                  ? "Loading..."
                  : `${list.length} saved design${list.length !== 1 ? "s" : ""}`}
              </h2>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="pt-6 h-40" />
                  </Card>
                ))}
              </div>
            ) : list.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground font-medium">No saved designs yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Convert an image to SVG above and save it here. Saved designs can be
                  loaded into any fidget toy from the Studio.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-empty-add"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Convert your first image
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {list.map((d) => (
                  <Card
                    key={d.id}
                    className="group hover:border-primary/50 transition-colors"
                    data-testid={`card-design-${d.id}`}
                  >
                    <CardContent className="p-4 flex flex-col gap-3">
                      <div className="h-32 rounded-md bg-muted/50 flex items-center justify-center overflow-hidden border border-border">
                        <img
                          src={svgToDataUri(d.svgData)}
                          alt={d.name}
                          style={{ width: 96, height: 96, objectFit: "contain" }}
                        />
                      </div>
                      <div>
                        <p
                          className="font-semibold text-sm truncate"
                          data-testid={`text-design-name-${d.id}`}
                        >
                          {d.name}
                        </p>
                        <p
                          className="text-xs text-muted-foreground"
                          data-testid={`text-design-date-${d.id}`}
                        >
                          {new Date(d.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs"
                          onClick={() => handleOpenInStudio(d.svgData, d.name)}
                          data-testid={`button-open-design-${d.id}`}
                        >
                          Open in Studio
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(d.id, d.name)}
                          disabled={deleteDesign.isPending}
                          data-testid={`button-delete-design-${d.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Save name dialog */}
      <Dialog open={!!saveDialog} onOpenChange={(v) => !v && setSaveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save to Library</DialogTitle>
            <DialogDescription>
              Give this design a name so you can find it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="design-name">Name</Label>
            <Input
              id="design-name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") submitSave();
              }}
              data-testid="input-design-name"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveDialog(null)}
              data-testid="button-cancel-save"
            >
              Cancel
            </Button>
            <Button
              onClick={submitSave}
              disabled={createDesign.isPending || !saveName.trim()}
              data-testid="button-confirm-save"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
