import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isDesktopApp } from "@/lib/desktop";
import { useStaffSession } from "@/lib/staff-session";

const WAIT_SECONDS = 10;

export function DeleteVoucherButton({
  title,
  description,
  compact,
  confirmLabel = "Move to bin",
  label = "Delete",
  buttonVariant = "destructive",
  allowBilling = false,
  onConfirm,
}: {
  title: string;
  description: string;
  compact?: boolean;
  confirmLabel?: string;
  label?: string;
  buttonVariant?: "destructive" | "outline" | "ghost";
  /** Draft line removal and cancel stay available to billing users. Deleting a saved record does not. */
  allowBilling?: boolean;
  onConfirm: () => void;
}) {
  const staff = useStaffSession();
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(WAIT_SECONDS);
  const [typed, setTyped] = useState("");
  const forever = /forever/i.test(confirmLabel);
  const typedOk = !forever || typed.trim().toUpperCase() === "DELETE";
  const ready = left === 0 && typedOk;
  const blocked = !isDesktopApp && !allowBilling && (!staff.ready || staff.session?.role !== "admin");

  useEffect(() => {
    if (!open) {
      setLeft(WAIT_SECONDS);
      setTyped("");
      return;
    }
    setLeft(WAIT_SECONDS);
    const timer = window.setInterval(() => {
      setLeft((seconds) => (seconds <= 1 ? 0 : seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  if (blocked) return null;

  return (
    <>
      {compact ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={title}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : (
        <Button type="button" variant={buttonVariant} onClick={() => setOpen(true)}>
          {buttonVariant === "destructive" ? <Trash2 className="size-4" /> : null}
          {label}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {description} The confirm button stays locked for 10 seconds so this cannot happen by accident.
              {forever ? " Type DELETE to remove it forever." : " You can restore it from the recycle bin."}
            </DialogDescription>
          </DialogHeader>
          {forever ? (
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm">Type DELETE</Label>
              <Input
                id="delete-confirm"
                value={typed}
                autoComplete="off"
                onChange={(e) => setTyped(e.target.value)}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Keep
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!ready}
              onClick={() => {
                if (!ready) return;
                onConfirm();
                setOpen(false);
              }}
            >
              {left > 0 ? `Wait ${left}s` : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
