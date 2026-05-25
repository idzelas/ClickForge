import { LogIn, UserPlus } from "lucide-react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AuthRequiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: string;
}

export function AuthRequiredModal({ open, onOpenChange, action }: AuthRequiredModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5" />
            Sign in to continue
          </DialogTitle>
          <DialogDescription>
            You need an account to {action}. Your current work in the studio
            will be kept and offered to you to save right after you sign in.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="sm:mr-auto"
          >
            Keep tinkering
          </Button>
          <Link href="/sign-up">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <UserPlus className="h-4 w-4 mr-1.5" />
              Create account
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button onClick={() => onOpenChange(false)}>
              <LogIn className="h-4 w-4 mr-1.5" />
              Sign in
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
