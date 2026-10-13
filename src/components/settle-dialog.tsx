import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR, todayISO } from "@/lib/format";
import type { PaymentMode } from "@/lib/types";

export function SettleDialog({
  open,
  onOpenChange,
  title,
  due,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  due: number;
  onSave: (input: { amount: number; date: string; mode: PaymentMode; reference: string }) => void;
}) {
  const [amount, setAmount] = useState(String(due));
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [reference, setReference] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setAmount(due.toFixed(2));
          setDate(todayISO());
          setReference("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Due now {formatINR(due)}. Enter only this receipt or payment, not the bill total.</p>
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Reference</Label>
            <Input placeholder="Cheque no., UTR or note" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              const value = Number(amount);
              if (!Number.isFinite(value) || value <= 0) return;
              onSave({ amount: value, date, mode, reference });
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
