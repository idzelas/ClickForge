import { Loader2, Library as LibraryIcon, FolderOpen } from "lucide-react";
import { useListSvgDesigns } from "@/hooks/useSvgDesigns";
import { svgToDataUri } from "@/lib/svgPreview";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Link } from "wouter";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (svgData: string, name: string) => void;
}

export default function LibraryPickerPanel({ open, onClose, onPick }: Props) {
  const designs = useListSvgDesigns();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LibraryIcon className="h-4 w-4" />
            Pick from Library
          </DialogTitle>
          <DialogDescription>
            Choose a saved SVG design to load into the fidget builder.
          </DialogDescription>
        </DialogHeader>

        {designs.isLoading ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
        ) : (designs.data ?? []).length === 0 ? (
          <div className="py-10 text-center">
            <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground font-medium">
              Your library is empty
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Save some designs from the{" "}
              <Link href="/library" className="text-primary underline">
                Library page
              </Link>{" "}
              to see them here.
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1"
            data-testid="library-picker-grid"
          >
            {(designs.data ?? []).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  onPick(d.svgData, d.name);
                  onClose();
                }}
                className="group flex flex-col items-stretch gap-2 rounded-lg border border-border hover:border-primary hover:bg-accent/40 transition-colors p-3 text-left"
                data-testid={`library-pick-${d.id}`}
              >
                <div className="h-24 rounded-md bg-muted/50 flex items-center justify-center overflow-hidden border border-border">
                  <img
                    src={svgToDataUri(d.svgData)}
                    alt={d.name}
                    style={{ width: 72, height: 72, objectFit: "contain" }}
                  />
                </div>
                <p className="text-xs font-medium truncate">{d.name}</p>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
