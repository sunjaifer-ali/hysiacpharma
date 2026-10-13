import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PeriodFilter, useVoucherPeriod } from "@/components/period-filter";
import { DeleteVoucherButton } from "@/components/delete-voucher";
import { LowStockBanner } from "@/components/low-stock-banner";
import { StatusBadge, purchaseBadgeStatus } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatINR } from "@/lib/format";
import { invoiceTotals } from "@/lib/gst";
import { useBillingStore } from "@/lib/store";
import type { PurchaseStatus } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/purchases/")({ component: PurchasesPage });

function PurchasesPage() {
  const purchases = useBillingStore((s) => s.purchases);
  const deletePurchase = useBillingStore((s) => s.deletePurchase);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | PurchaseStatus>("all");
  const period = useVoucherPeriod();

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return [...purchases]
      .filter((i) => period.includes(i.date))
      .filter((i) => (status === "all" ? true : i.status === status))
      .filter((i) => {
        if (!query) return true;
        return (
          i.number.toLowerCase().includes(query) ||
          i.billNo.toLowerCase().includes(query) ||
          (i.challanNo ?? "").toLowerCase().includes(query) ||
          (i.transport ?? "").toLowerCase().includes(query) ||
          i.supplier.name.toLowerCase().includes(query) ||
          i.supplier.gstin.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  }, [purchases, q, status, period]);

  return (
    <AppShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Purchases</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} bills · {period.label}. Enter supplier challans as printed — qty, free, rate, GST, transport and e-way.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/purchases/orders">Purchase orders</Link>
          </Button>
          <Button asChild>
            <Link to="/purchases/new">New purchase</Link>
          </Button>
        </div>
      </div>

      <LowStockBanner />

      <PeriodFilter
        from={period.from}
        to={period.to}
        preset={period.preset}
        onFrom={period.setFrom}
        onTo={period.setTo}
        onPreset={period.apply}
      />

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search number, challan, supplier"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Bill</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Taxable</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-2 py-3 font-medium"><span className="sr-only">Delete</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                    {purchases.length === 0 ? "No purchases yet. Post a supplier bill to start stock." : "No purchases in this period."}
                  </td>
                </tr>
              ) : (
                rows.map((pur) => {
                  const t = invoiceTotals(pur);
                  return (
                    <tr key={pur.id} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          to="/purchases/$id"
                          params={{ id: pur.id }}
                          className="font-medium text-primary hover:underline"
                        >
                          {pur.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{pur.supplier.name}</div>
                        <div className="text-[11px] text-muted-foreground">{pur.supplier.gstin || "Unregistered"}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {pur.billNo || "—"}
                        {pur.billDate ? <div>{formatDate(pur.billDate)}</div> : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(pur.date)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={purchaseBadgeStatus(pur.status, invoiceTotals(pur).grand, pur.paidAmount)} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatINR(t.taxable)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatINR(t.grand)}</td>
                      <td className="px-2 py-2">
                        <DeleteVoucherButton
                          compact
                          title={`Delete ${pur.number}?`}
                          description="Moves this purchase to the recycle bin. Stock from it is hidden until you restore it."
                          onConfirm={() => {
                            deletePurchase(pur.id);
                            toast.success("Moved to the recycle bin");
                          }}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
