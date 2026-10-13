import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatINR } from "@/lib/format";
import { invoiceTotals } from "@/lib/gst";
import { useBillingStore } from "@/lib/store";
import type { QuoteStatus } from "@/lib/types";

export const Route = createFileRoute("/quotes/")({ component: QuotesPage });

const LABEL: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  ordered: "Ordered",
};

function QuotesPage() {
  const quotes = useBillingStore((s) => s.quotes);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | QuoteStatus>("all");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return quotes
      .filter((item) => (status === "all" ? true : item.status === status))
      .filter((item) => {
        if (!needle) return true;
        return `${item.number} ${item.party.name} ${item.reference} ${item.attention}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  }, [quotes, q, status]);

  return (
    <AppShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Quotations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Price offers for hospitals and other customers. Stock moves only when you invoice the order.</p>
        </div>
        <Button asChild>
          <Link to="/quotes/new">New quotation</Link>
        </Button>
      </div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number, hospital or reference" className="sm:max-w-sm" />
        <div className="flex flex-wrap gap-2">
          {(["all", "draft", "sent", "ordered"] as const).map((item) => (
            <Button key={item} type="button" size="sm" variant={status === item ? "default" : "outline"} onClick={() => setStatus(item)}>
              {item === "all" ? "All" : LABEL[item]}
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">No.</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Valid until</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No quotations yet.
                </td>
              </tr>
            ) : (
              rows.map((item) => (
                <tr key={item.id} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3">
                    <Link to="/quotes/$id" params={{ id: item.id }} className="font-medium text-primary hover:underline">
                      {item.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatDate(item.date)}</td>
                  <td className="px-4 py-3">
                    {item.party.name}
                    {item.reference ? <span className="block text-[11px] text-muted-foreground">Ref {item.reference}</span> : null}
                  </td>
                  <td className="px-4 py-3">{formatDate(item.validUntil)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={item.status === "ordered" ? "paid" : item.status === "sent" ? "issued" : "draft"}>{LABEL[item.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatINR(invoiceTotals({ lines: item.lines, roundOff: 0 }).grand)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
