import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { DeleteVoucherButton } from "@/components/delete-voucher";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatINR, todayISO } from "@/lib/format";
import { invoiceTotals } from "@/lib/gst";
import { invoiceNetDue } from "@/lib/returns";
import { useBillingStore } from "@/lib/store";
import type { PaymentMode } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/payments/")({ component: PaymentsPage });

const MODES: { value: PaymentMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
];

function PaymentsPage() {
  const invoices = useBillingStore((s) => s.invoices);
  const purchases = useBillingStore((s) => s.purchases);
  const notes = useBillingStore((s) => s.creditNotes);
  const payments = useBillingStore((s) => s.payments);
  const recordPayment = useBillingStore((s) => s.recordPayment);
  const recordPurchasePayment = useBillingStore((s) => s.recordPurchasePayment);
  const deletePayment = useBillingStore((s) => s.deletePayment);
  const navigate = useNavigate();
  const [kind, setKind] = useState<"receipt" | "payment">("receipt");
  const [partyId, setPartyId] = useState("");
  const [voucherId, setVoucherId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<PaymentMode>(kind === "receipt" ? "cash" : "bank");
  const [reference, setReference] = useState("");

  const openInvoices = useMemo(
    () =>
      invoices
        .filter((i) => i.status !== "draft" && i.status !== "cancelled" && invoiceNetDue(i, notes) > 0.009)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [invoices, notes],
  );
  const openPurchases = useMemo(
    () =>
      purchases
        .filter((p) => p.status === "posted" && invoiceTotals(p).grand - (p.paidAmount || 0) > 0.009)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [purchases],
  );

  const parties = useMemo(() => {
    const map = new Map<string, string>();
    if (kind === "receipt") {
      for (const i of openInvoices) map.set(i.partyId, i.party.name);
    } else {
      for (const p of openPurchases) map.set(p.supplierId, p.supplier.name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [kind, openInvoices, openPurchases]);

  const bills =
    kind === "receipt" ? openInvoices.filter((i) => i.partyId === partyId) : openPurchases.filter((p) => p.supplierId === partyId);

  function dueOf(id: string) {
    if (kind === "receipt") {
      const bill = openInvoices.find((i) => i.id === id);
      return bill ? invoiceNetDue(bill, notes) : 0;
    }
    const bill = openPurchases.find((p) => p.id === id);
    return bill ? Math.max(0, invoiceTotals(bill).grand - (bill.paidAmount || 0)) : 0;
  }

  function chooseParty(id: string) {
    setPartyId(id);
    setVoucherId("");
    setAmount("");
  }

  function chooseBill(id: string) {
    setVoucherId(id);
    if (kind === "receipt") {
      const bill = openInvoices.find((i) => i.id === id);
      setAmount(bill ? invoiceNetDue(bill, notes).toFixed(2) : "");
    } else {
      const bill = openPurchases.find((p) => p.id === id);
      setAmount(bill ? Math.max(0, invoiceTotals(bill).grand - (bill.paidAmount || 0)).toFixed(2) : "");
    }
  }

  function save() {
    const value = Number(amount);
    if (!voucherId || !Number.isFinite(value) || value <= 0) {
      toast.error("Choose a bill and enter the amount");
      return;
    }
    if (kind === "receipt") {
      const saved = recordPayment(voucherId, value, { date, mode, reference });
      if (!saved) {
        toast.error("Nothing was received. Check the amount still due.");
        return;
      }
      void navigate({ to: "/payments/$id", params: { id: saved.id } });
      return;
    }
    const saved = recordPurchasePayment(voucherId, value, { date, mode, reference });
    if (!saved) {
      toast.error("Nothing was paid. Check the amount still due.");
      return;
    }
    void navigate({ to: "/payments/$id", params: { id: saved.id } });
  }

  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="font-display text-3xl">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Receive from customers and pay suppliers against open bills.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={kind === "receipt" ? "default" : "outline"} onClick={() => { setKind("receipt"); setPartyId(""); setVoucherId(""); setMode("cash"); }}>
          Receive from customer
        </Button>
        <Button type="button" variant={kind === "payment" ? "default" : "outline"} onClick={() => { setKind("payment"); setPartyId(""); setVoucherId(""); setMode("bank"); }}>
          Pay supplier
        </Button>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{kind === "receipt" ? "Customer" : "Supplier"}</Label>
          <Select value={partyId} onValueChange={chooseParty}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {parties.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Bill</Label>
          <Select value={voucherId} onValueChange={chooseBill}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {bills.map((bill) => {
                const due = "party" in bill ? invoiceNetDue(bill, notes) : Math.max(0, invoiceTotals(bill).grand - (bill.paidAmount || 0));
                const label = "party" in bill ? bill.number : bill.billNo || bill.number;
                return (
                  <SelectItem key={bill.id} value={bill.id}>
                    {label} · due {formatINR(due)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Amount {voucherId ? `(due ${formatINR(dueOf(voucherId))})` : ""}</Label>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
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
              {MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Reference</Label>
          <Input placeholder="Cheque no., UTR or note" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={save}>{kind === "receipt" ? "Save receipt" : "Save payment"}</Button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">No.</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Party</th>
              <th className="px-4 py-3 font-medium">Bill</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No receipts or payments yet.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3">
                    <Link to="/payments/$id" params={{ id: p.id }} className="font-medium text-primary hover:underline">
                      {p.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatDate(p.date)}</td>
                  <td className="px-4 py-3">{p.kind === "receipt" ? "Received" : "Paid"}</td>
                  <td className="px-4 py-3">{p.partyName}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={p.kind === "receipt" ? "/invoices/$id" : "/purchases/$id"}
                      params={{ id: p.voucherId }}
                      className="text-primary hover:underline"
                    >
                      {p.voucherNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 capitalize">{p.mode}{p.reference ? ` · ${p.reference}` : ""}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatINR(p.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/payments/$id" params={{ id: p.id }}>
                        Print
                      </Link>
                    </Button>
                    <DeleteVoucherButton
                      compact
                      title="Remove this entry"
                      description="Moves this receipt or payment to the recycle bin and adjusts the balance on the bill."
                      onConfirm={() => {
                        deletePayment(p.id);
                        toast.success("Moved to the recycle bin");
                      }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
