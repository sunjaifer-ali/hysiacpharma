import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, ClipboardList, IndianRupee, Receipt, Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/app-shell";
import { HysiacMark } from "@/components/logo";
import { LowStockBanner } from "@/components/low-stock-banner";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatINR, formatINRCompact, monthKey, monthLabel } from "@/lib/format";
import { currentFinancialYear, invoiceTotals } from "@/lib/gst";
import { invoiceNetDue } from "@/lib/returns";
import { useBillingStore, useHasHydrated } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const hydrated = useHasHydrated();
  const invoices = useBillingStore((s) => s.invoices);
  const purchases = useBillingStore((s) => s.purchases);
  const creditNotes = useBillingStore((s) => s.creditNotes);
  const openingDues = useBillingStore((s) => s.openingDues);
  const company = useBillingStore((s) => s.company);
  const fy = currentFinancialYear();

  const live = invoices.filter((i) => i.status !== "cancelled" && i.status !== "draft");
  const fyInvoices = live.filter((i) => {
    const d = new Date(`${i.date}T00:00:00`);
    const start = new Date(fy.start, 3, 1);
    const end = new Date(fy.end, 2, 31, 23, 59, 59);
    return d >= start && d <= end;
  });
  const fyPurchases = purchases.filter((p) => {
    if (p.status !== "posted") return false;
    const d = new Date(`${p.date}T00:00:00`);
    const start = new Date(fy.start, 3, 1);
    const end = new Date(fy.end, 2, 31, 23, 59, 59);
    return d >= start && d <= end;
  });

  const fyNotes = creditNotes.filter((n) => {
    if (n.status !== "issued") return false;
    const d = new Date(`${n.date}T00:00:00`);
    const start = new Date(fy.start, 3, 1);
    const end = new Date(fy.end, 2, 31, 23, 59, 59);
    return d >= start && d <= end;
  });

  const sales =
    fyInvoices.reduce((s, i) => s + invoiceTotals(i).grand, 0) -
    fyNotes.reduce((s, n) => s + invoiceTotals(n).grand, 0);
  const purchaseValue = fyPurchases.reduce((s, i) => s + invoiceTotals(i).grand, 0);
  const toPay = fyPurchases.reduce((s, p) => s + Math.max(0, invoiceTotals(p).grand - (p.paidAmount || 0)), 0);
  const gst =
    fyInvoices.reduce((s, i) => s + invoiceTotals(i).tax, 0) - fyNotes.reduce((s, n) => s + invoiceTotals(n).tax, 0);
  const outstanding =
    fyInvoices
      .filter((i) => i.status === "issued" || i.status === "partial")
      .reduce((s, i) => s + invoiceNetDue(i, creditNotes), 0) +
    openingDues
      .filter((d) => d.kind === "customer")
      .reduce((s, d) => s + Math.max(0, d.amount - (d.paidAmount || 0)), 0);

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const chart = months.map((m) => {
    const subset = live.filter((i) => monthKey(i.date) === m);
    return {
      month: monthLabel(m),
      sales: Math.round(subset.reduce((s, i) => s + invoiceTotals(i).grand, 0)),
    };
  });

  const recent = [...invoices].sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)).slice(0, 6);

  return (
    <AppShell>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <HysiacMark className="size-12 shrink-0" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Hysiac Pharmaceuticals Pvt Ltd</p>
            <h1 className="font-display text-3xl text-foreground sm:text-4xl">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {company.city} · FY {fy.label}
              {hydrated ? "" : " · loading books"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/quotes/new">New quotation</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/purchases/new">New purchase</Link>
          </Button>
          <Button asChild>
            <Link to="/invoices/new">New tax invoice</Link>
          </Button>
        </div>
      </div>

      <LowStockBanner />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={IndianRupee} label="FY sales" value={formatINRCompact(sales)} hint="Invoices net of credit notes" />
        <Kpi icon={Receipt} label="GST collected" value={formatINRCompact(gst)} hint="CGST + SGST + IGST" />
        <Kpi icon={Wallet} label="Outstanding" value={formatINRCompact(outstanding)} hint="Unpaid + partial" />
        <Kpi
          icon={ClipboardList}
          label="FY purchases"
          value={formatINRCompact(purchaseValue)}
          hint={`${fyPurchases.length} posted · ${formatINRCompact(toPay)} still to pay`}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="min-w-0 overflow-hidden lg:col-span-3">
          <CardHeader>
            <CardTitle>Sales</CardTitle>
            <p className="text-sm text-muted-foreground">Last six months of billed value</p>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => `₹${v >= 100000 ? `${Math.round(v / 100000)}L` : v}`}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  formatter={(v: number) => [formatINR(v), "Sales"]}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="sales" stroke="var(--color-primary)" strokeWidth={2} fill="url(#salesFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent invoices</CardTitle>
            <Link to="/invoices" className="text-sm text-primary">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-1 px-2 pb-3">
            {recent.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No invoices yet. Start with a purchase, then a tax invoice.</p>
            ) : (
              recent.map((inv) => {
                const t = invoiceTotals(inv);
                return (
                  <Link
                    key={inv.id}
                    to="/invoices/$id"
                    params={{ id: inv.id }}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{inv.party.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {inv.number} · {formatDate(inv.date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm tabular-nums">{formatINR(t.grand)}</p>
                      <StatusBadge status={inv.status} />
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof IndianRupee;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <span className="rounded-lg bg-accent p-2 text-primary">
            <Icon className="size-4" />
          </span>
        </div>
        <p className="mt-3 font-display text-3xl tabular-nums leading-none">{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
