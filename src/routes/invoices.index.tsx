import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PeriodFilter, useVoucherPeriod } from "@/components/period-filter";
import { DeleteVoucherButton } from "@/components/delete-voucher";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatINR } from "@/lib/format";
import { invoiceTotals } from "@/lib/gst";
import { channelLabel, priceListLabel } from "@/lib/pricing";
import { useBillingStore } from "@/lib/store";
import type { InvoiceStatus } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/invoices/")({ component: InvoicesPage });

function InvoicesPage() {
  const invoices = useBillingStore((s) => s.invoices);
  const deleteInvoice = useBillingStore((s) => s.deleteInvoice);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | InvoiceStatus>("all");
  const period = useVoucherPeriod();

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return [...invoices]
      .filter((i) => period.includes(i.date))
      .filter((i) => (status === "all" ? true : i.status === status))
      .filter((i) => {
        if (!query) return true;
        return (
          i.number.toLowerCase().includes(query) ||
          i.party.name.toLowerCase().includes(query) ||
          i.party.gstin.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  }, [invoices, q, status, period]);

  return (
    <AppShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} invoice{rows.length === 1 ? "" : "s"} · {period.label}
          </p>
        </div>
        <Button asChild>
          <Link to="/invoices/new">New invoice</Link>
        </Button>
      </div>

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
          <Input className="pl-9" placeholder="Search number, party, GSTIN" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="issued">Unpaid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
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
                <th className="px-4 py-3 font-medium">Party</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Taxable</th>
                <th className="px-4 py-3 font-medium text-right">GST</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-2 py-3 font-medium"><span className="sr-only">Delete</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                    {invoices.length === 0
                      ? "No invoices yet. Create a tax invoice to start."
                      : "No invoices in this period."}
                  </td>
                </tr>
              ) : (
                rows.map((inv) => {
                  const t = invoiceTotals(inv);
                  return (
                    <tr key={inv.id} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-3">
                        <Link to="/invoices/$id" params={{ id: inv.id }} className="font-medium text-primary hover:underline">
                          {inv.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{inv.party.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {inv.party.gstin || "Unregistered"}
                          {inv.party.channel ? ` · ${channelLabel(inv.party.channel)}` : ""}
                          {inv.priceList ? ` · ${priceListLabel(inv.priceList)}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.date)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatINR(t.taxable)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatINR(t.tax)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatINR(t.grand)}</td>
                      <td className="px-2 py-2">
                        <DeleteVoucherButton
                          compact
                          title={`Delete ${inv.number}?`}
                          description="Moves this tax invoice, and any return or receipt on it, to the recycle bin. Nothing is removed forever until you empty the bin."
                          onConfirm={() => {
                            deleteInvoice(inv.id);
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
