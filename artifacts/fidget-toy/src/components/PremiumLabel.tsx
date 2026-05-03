import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PremiumLabelProps {
  children: React.ReactNode;
  className?: string;
  iconClassName?: string;
}

/**
 * Wraps a control label with a small crown icon to indicate the feature
 * is Premium-only. Visual only — clicks should still be intercepted by
 * the parent component to show the upgrade modal when appropriate.
 */
export function PremiumLabel({ children, className, iconClassName }: PremiumLabelProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {children}
      <Crown
        className={cn("h-3 w-3 text-amber-500 shrink-0", iconClassName)}
        aria-label="Premium feature"
      />
    </span>
  );
}
