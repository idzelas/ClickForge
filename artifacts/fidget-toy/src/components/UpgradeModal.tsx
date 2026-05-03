import { Crown, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GATED_FEATURE_LABELS, type GatedFeature } from "@/lib/tier";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: GatedFeature | null;
}

const PREMIUM_PERKS = [
  "Convert PNG / JPG / WebP images to SVG",
  "Export to 3MF and OBJ (multi-color ready)",
  "Unlimited saved projects",
  "Key ring lug, mirror shell, fit-check & x-ray previews",
];

export function UpgradeModal({ open, onOpenChange, feature }: UpgradeModalProps) {
  const reason = feature ? GATED_FEATURE_LABELS[feature] : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Premium feature
          </DialogTitle>
          <DialogDescription>
            {reason ? <><span className="font-medium text-foreground">{reason}</span> is available on the Premium plan.</> : "This is a Premium feature."}
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          {PREMIUM_PERKS.map((perk) => (
            <li key={perk} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <span>{perk}</span>
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            <Crown className="h-4 w-4 mr-1.5" />
            Upgrade (coming soon)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
