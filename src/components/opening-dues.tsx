import { useState } from "react";
import { PartyPicker } from "@/components/party-picker";
import { SettleDialog } from "@/components/settle-dialog";
import { DeleteVoucherButton } from "@/components/delete-voucher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatINR, todayISO } from "@/lib/format";
import { round2 } from "@/lib/gst";
import { useBillingStore } from "@/lib/store";
import type { OpeningDue } from "@/lib/types";
import { toast } from "sonner";

export function OpeningDues({ kind }: { kind: OpeningDue["kind"] }) {
  const dues = useBillingStore((s) => s.openingDues.filter((d) => d.kind === kind));
  const saveOpeningDue = useBillingStore((s) => s.saveOpeningDue);
  const settleOpeningDue = useBillingStore((s) => s.settleOpeningDue);
  const deleteOpeningDue = useBillingStore((s) => s.deleteOpeningDue);
  const [partyId, setPartyId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [settle, setSettle] = useState<OpeningDue | null>(null);
  const customer = kind === "customer";

  function add() {
    try {
      saveOpeningDue({ partyId, kind, date, amount: Number(amount) });
      setAmount("");
      toast.success("Opening balance saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    }
  }

  return (
    <div className="no-print mb-4 rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-medium">{customer ? "Opening customer dues" : "Opening supplier dues"}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {customer ? "What a customer already owed before this app." : "What you already owed a supplier before this app."} It is not a GST bill.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_8rem_10rem_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label>{customer ? "Customer" : "Supplier"}</Label>
          <PartyPicker role={customer ? "customer" : "supplier"} value={partyId} onChange={(id) => setPartyId(id)} />
        </div>
        <div className="space-y-1.5">
          <Label>Amount</Label>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>As on</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Button type="button" variant="outline" onClick={add}>Add</Button>
      </div>
      {dues.length > 0 ? (
        <ul className="mt-3 divide-y divide-border">
          {dues.map((item) => {
            const due = round2(Math.max(0, item.amount - (item.paidAmount || 0)));
            return (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="font-medium">{item.partyName}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDate(item.date)} · Due {formatINR(due)} of {formatINR(item.amount)}</p>
                </div>
                <div className="flex gap-1">
                  {due > 0.009 ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setSettle(item)}>
                      {customer ? "Receive" : "Pay"}
                    </Button>
                  ) : null}
                  <DeleteVoucherButton
                    compact
                    title="Remove opening balance"
                    description="Moves this opening balance, and any receipt or payment on it, to the recycle bin."
                    onConfirm={() => deleteOpeningDue(item.id)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      <SettleDialog
        open={Boolean(settle)}
        onOpenChange={(open) => { if (!open) setSettle(null); }}
        title={customer ? "Receive opening due" : "Pay opening due"}
        due={settle ? round2(Math.max(0, settle.amount - (settle.paidAmount || 0))) : 0}
        onSave={(input) => {
          if (!settle) return;
          const saved = settleOpeningDue(settle.id, input.amount, input);
          if (!saved) toast.error("Nothing was settled.");
          else toast.success(customer ? "Receipt saved" : "Payment saved");
          setSettle(null);
        }}
      />
    </div>
  );
}
