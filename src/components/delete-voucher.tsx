import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DeleteVoucherButton({
  title,
  description,
  compact,
  confirmLabel = "Move to bin",
  onConfirm,
}: {
  title: string;
  description: string;
  compact?: boolean;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    const timer = window.setTimeout(() => setReady(true), 700);
    return () => window.clearTimeout(timer);
  }, [open]);

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
        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 className="size-4" />
          Delete
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
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
              {ready ? confirmLabel : "Wait…"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}