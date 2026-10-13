import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PeriodFilter, useVoucherPeriod } from "@/components/period-filter";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatINR } from "@/lib/format";
import { invoiceTotals } from "@/lib/gst";
import { reasonLabel } from "@/lib/returns";
import { useBillingStore } from "@/lib/store";
import type { CreditNoteStatus } from "@/lib/types";

export const Route = createFileRoute("/returns/")({ component: ReturnsPage });

function ReturnsPage() {
  const notes = useBillingStore((s) => s.creditNotes).filter((n) => n.kind === "sales_return");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | CreditNoteStatus>("all");
  const period = useVoucherPeriod();

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return [...notes]
      .filter((n) => period.includes(n.date))
      .filter((n) => (status === "all" ? true : n.status === status))
      .filter((n) => {
        if (!query) return true;
        return (
          n.number.toLowerCase().includes(query) ||
          n.invoiceNumber.toLowerCase().includes(query) ||
          n.party.name.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  }, [notes, q, status, period]);

  return (
    <AppShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Return bills</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} return bills · {period.label}. Goods returned against invoices. Stock updates except expired or
            damaged.
          </p>
        </div>
        <Button asChild>
          <Link to="/returns/new">New return bill</Link>
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
          <Input
            className="pl-9"
            placeholder="Search note, invoice, party"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
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
                <th className="px-4 py-3 font-medium">Against</th>
                <th className="px-4 py-3 font-medium">Party</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                    No return bills in this period.
                  </td>
                </tr>
              ) : (
                rows.map((n) => {
                  const t = invoiceTotals(n);
                  return (
                    <tr key={n.id} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-3">
                        <Link to="/returns/$id" params={{ id: n.id }} className="font-medium text-primary hover:underline">
                          {n.number}
                        </Link>
                        <div className="text-[11px] text-muted-foreground">{formatDate(n.date)}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>{n.invoiceNumber}</div>
                        <div className="text-[11px] text-muted-foreground">{formatDate(n.invoiceDate)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{n.party.name}</div>
                        <div className="text-[11px] text-muted-foreground">{reasonLabel(n.reason)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={n.status} as="note" />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatINR(t.grand)}</td>
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
