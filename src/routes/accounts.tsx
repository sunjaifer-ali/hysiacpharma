import { createFileRoute } from "@tanstack/react-router";
import { FileSpreadsheet, Printer } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { CompactTable } from "@/components/gst-register";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  agingTotals,
  balanceSheet,
  creditorsOutstanding,
  debtorsOutstanding,
  gstComputation,
  invoiceProfits,
  profitAndLoss,
  statementExcelRows,
  statementHeader,
  type InvoiceProfit,
  type OutstandingRow,
  type StatementLine,
} from "@/lib/accounts";
import { downloadExcel } from "@/lib/excel";
import { formatDateDMY, formatINR } from "@/lib/format";
import { currentFinancialYear, currentMonthRange, currentQuarterRange, financialYearRange, lastMonthRange, round2, stateName } from "@/lib/gst";
import { orientLabel, printPage, type PageOrient } from "@/lib/print-page";
import { OpeningDues } from "@/components/opening-dues";
import { inRange, stockRegister } from "@/lib/registers";
import { useBillingStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/accounts")({ component: AccountsPage });

type TabKey = "pnl" | "profit" | "bs" | "debtors" | "creditors" | "gst" | "stock";

const ORIENT: Record<TabKey, PageOrient> = {
  pnl: "portrait",
  profit: "landscape",
  bs: "portrait",
  debtors: "landscape",
  creditors: "landscape",
  gst: "portrait",
  stock: "landscape",
};

function AccountsPage() {
  const company = useBillingStore((s) => s.company);
  const invoices = useBillingStore((s) => s.invoices);
  const purchases = useBillingStore((s) => s.purchases);
  const products = useBillingStore((s) => s.products);
  const creditNotes = useBillingStore((s) => s.creditNotes);
  const adjustments = useBillingStore((s) => s.adjustments);
  const openingDues = useBillingStore((s) => s.openingDues);
  const fy = currentFinancialYear();
  const fyTo = `${fy.end}-03-31`;
  const [from, setFrom] = useState(`${fy.start}-04-01`);
  const [to, setTo] = useState(fyTo);
  const [tab, setTab] = useState<TabKey>("pnl");
  const range = { from, to };
  const address = `${company.addressLine1}, ${company.city}, ${stateName(company.stateCode)} ${company.pincode}`;
  const orient = ORIENT[tab];

  const pnl = useMemo(
    () => profitAndLoss(invoices, purchases, creditNotes, products, range, adjustments),
    [invoices, purchases, creditNotes, products, from, to, adjustments],
  );
  const bs = useMemo(
    () => balanceSheet(invoices, purchases, creditNotes, products, to, `${fy.start}-04-01`, adjustments, openingDues),
    [invoices, purchases, creditNotes, products, to, fy.start, adjustments, openingDues],
  );
  const debtors = useMemo(() => debtorsOutstanding(invoices, creditNotes, to, openingDues), [invoices, creditNotes, to, openingDues]);
  const creditors = useMemo(() => creditorsOutstanding(purchases, to, openingDues), [purchases, to, openingDues]);
  const gst = useMemo(
    () => gstComputation(invoices, purchases, creditNotes, range),
    [invoices, purchases, creditNotes, from, to],
  );
  const profits = useMemo(
    () => invoiceProfits(invoices, purchases, creditNotes, products, range, adjustments),
    [invoices, purchases, creditNotes, products, from, to, adjustments],
  );
  const stock = useMemo(
    () => stockRegister(products, purchases, invoices, creditNotes, to, undefined, adjustments),
    [products, purchases, invoices, creditNotes, to, adjustments],
  );
  const debtorAge = agingTotals(debtors);
  const creditorAge = agingTotals(creditors);

  function periodLine(title: string) {
    return `${title}  ${formatDateDMY(from)} to ${formatDateDMY(to)}`;
  }

  function exportCurrent() {
    const stamp = `${formatDateDMY(from).replaceAll("-", "")}-${formatDateDMY(to).replaceAll("-", "")}`;
    const head = (title: string, period: string) => statementHeader(company.legalName, address, company.gstin, title, period);
    if (tab === "pnl") {
      downloadExcel(`Profit-and-Loss-${stamp}`, [
        { name: "P and L", rows: [...head("Profit & Loss statement", periodLine("Period")), ...statementExcelRows(pnl.lines)] },
      ]);
    } else if (tab === "profit") {
      downloadExcel(`Invoice-profit-${stamp}`, [
        {
          name: "Invoice profit",
          rows: [
            ...head("Invoice profit", periodLine("Period")),
            ["Invoice", "Date", "Customer", "Buy amount", "Sell amount", "Profit", "Profit %"],
            ...profits.rows.map((r) => [r.number, formatDateDMY(r.date), r.party, r.buyAmount, r.sellAmount, r.profit, r.profitPct]),
            ["Total", "", "", profits.totals.buyAmount, profits.totals.sellAmount, profits.totals.profit, profits.totals.profitPct],
          ],
        },
        {
          name: "Product margin",
          rows: [
            ...head("Buy / sell / margin by invoice product", periodLine("Period")),
            [
              "Invoice",
              "Date",
              "Customer",
              "Product",
              "Batch",
              "Qty",
              "Free",
              "Buy price",
              "Sell price",
              "Buy amount",
              "Sell amount",
              "Margin",
              "Margin %",
            ],
            ...profits.rows.flatMap((r) =>
              r.lines.map((l) => [
                r.number,
                formatDateDMY(r.date),
                r.party,
                l.name,
                l.batch,
                l.qty,
                l.freeQty,
                l.buyPrice,
                l.sellPrice,
                l.buyAmount,
                l.sellAmount,
                l.margin,
                l.marginPct,
              ]),
            ),
            ["Total", "", "", "", "", "", "", "", "", profits.totals.buyAmount, profits.totals.sellAmount, profits.totals.profit, profits.totals.profitPct],
          ],
        },
      ]);
    } else if (tab === "bs") {
      downloadExcel(`Balance-Sheet-${stamp}`, [
        {
          name: "Balance sheet",
          rows: [
            ...head("Balance sheet", `As on ${formatDateDMY(to)}`),
            ["Liabilities", "Amount", "Assets", "Amount"],
            ...padPair(bs.liabilityLines, bs.assetLines),
          ],
        },
      ]);
    } else if (tab === "debtors") {
      downloadExcel(`Debtors-${stamp}`, [{ name: "Debtors", rows: [...head("Sundry debtors", `As on ${formatDateDMY(to)}`), ...outstandingExcel(debtors)] }]);
    } else if (tab === "creditors") {
      downloadExcel(`Creditors-${stamp}`, [
        { name: "Creditors", rows: [...head("Sundry creditors", `As on ${formatDateDMY(to)}`), ...outstandingExcel(creditors)] },
      ]);
    } else if (tab === "gst") {
      downloadExcel(`GST-computation-${stamp}`, [
        {
          name: "GST",
          rows: [
            ...head("GST computation", periodLine("Period")),
            ["", "Taxable", "CGST", "SGST", "IGST"],
            ["Output (net of credit notes)", gst.output.taxable, gst.output.cgst, gst.output.sgst, gst.output.igst],
            ["Input (purchases)", gst.input.taxable, gst.input.cgst, gst.input.sgst, gst.input.igst],
            ["Net payable / (credit)", "", gst.payable.cgst, gst.payable.sgst, gst.payable.igst],
            ["Net GST", gst.netPayable],
          ],
        },
      ]);
    } else {
      downloadExcel(`Stock-valuation-${stamp}`, [
        {
          name: "Stock",
          rows: [
            ...head("Stock valuation at cost", `As on ${formatDateDMY(to)}`),
            ["Product", "HSN", "Opening", "Stock out", "Closing", "Unit cost", "Value"],
            ...stock.map((r) => [r.name, r.hsn, r.openingQty, r.adjusted, r.closing, r.unitCost, r.costValue]),
          ],
        },
      ]);
    }
    toast.success("Excel downloaded");
  }

  return (
    <AppShell>
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Profit & loss, invoice margins, balance sheet and books — pick dates, then Excel or A4 PDF.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={exportCurrent}>
            <FileSpreadsheet className="size-4" />
            Excel
          </Button>
          <Button variant="outline" onClick={() => printPage(orient)}>
            <Printer className="size-4" />
            PDF
          </Button>
          <span className="text-[11px] text-muted-foreground">{orientLabel(orient)}</span>
        </div>
      </div>

      <div className="no-print mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="acc-from">From</Label>
          <Input id="acc-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acc-to">To / as on</Label>
          <Input id="acc-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={() => { const r = lastMonthRange(); setFrom(r.from); setTo(r.to); }}>
            Last month
          </Button>
          <Button variant="secondary" onClick={() => { const r = currentMonthRange(); setFrom(r.from); setTo(r.to); }}>
            This month
          </Button>
          <Button variant="secondary" onClick={() => { const r = currentQuarterRange(); setFrom(r.from); setTo(r.to); }}>
            This quarter
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const r = financialYearRange();
              setFrom(r.from);
              setTo(r.to);
            }}
          >
            This FY
          </Button>
        </div>
      </div>

      {(() => {
        const missedSales = invoices.filter(
          (i) => (i.status === "issued" || i.status === "partial" || i.status === "paid") && !inRange(i.date, range),
        ).length;
        const missedPurchases = purchases.filter((p) => p.status === "posted" && !inRange(p.date, range)).length;
        if (missedSales + missedPurchases === 0) return null;
        return (
          <p className="no-print mt-3 text-sm text-muted-foreground">
            {missedSales} sales and {missedPurchases} purchases are outside {formatDateDMY(from)} – {formatDateDMY(to)}.{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => {
                setFrom(`${fy.start}-04-01`);
                setTo(fyTo);
              }}
            >
              Show the full year
            </button>
          </p>
        );
      })()}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mt-6">
        <TabsList className="no-print flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="pnl">Profit & loss</TabsTrigger>
          <TabsTrigger value="profit">Invoice profit</TabsTrigger>
          <TabsTrigger value="bs">Balance sheet</TabsTrigger>
          <TabsTrigger value="debtors">Debtors</TabsTrigger>
          <TabsTrigger value="creditors">Creditors</TabsTrigger>
          <TabsTrigger value="gst">GST payable</TabsTrigger>
          <TabsTrigger value="stock">Stock value</TabsTrigger>
        </TabsList>

        <TabsContent value="pnl">
          <StatementFrame
            company={company.legalName}
            address={address}
            gstin={company.gstin}
            title="Profit & Loss statement"
            period={periodLine("For the period")}
          >
            <StatementTable lines={pnl.lines} />
            <p className="mt-4 text-[11px] text-sage">
              Trading account — sales and purchases exclusive of GST. Stock valued at average purchase cost.
            </p>
          </StatementFrame>
        </TabsContent>

        <TabsContent value="profit">
          <StatementFrame
            company={company.legalName}
            address={address}
            gstin={company.gstin}
            title="Invoice profit"
            period={periodLine("For the period")}
          >
            <InvoiceProfitTable rows={profits.rows} totals={profits.totals} />
            <p className="mt-4 text-[11px] text-sage">
              Buy price is average purchase cost of that batch (PTS if never purchased). Selling price is the billed
              rate. Margin is taxable value minus cost of billed and free quantity. GST is excluded.
            </p>
          </StatementFrame>
        </TabsContent>

        <TabsContent value="bs">
          <StatementFrame
            company={company.legalName}
            address={address}
            gstin={company.gstin}
            title="Balance sheet"
            period={`As on ${formatDateDMY(to)}`}
          >
            <div className="bs-grid">
              <div>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-forest">Liabilities</h3>
                <StatementTable lines={bs.liabilityLines} />
              </div>
              <div>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-forest">Assets</h3>
                <StatementTable lines={bs.assetLines} />
              </div>
            </div>
            <p className="mt-4 text-[11px] text-sage">
              Debtors are unpaid invoices plus opening customer balances. Creditors are unpaid purchase bills plus opening supplier balances. Capital is the
              balancing figure.
            </p>
          </StatementFrame>
        </TabsContent>

        <TabsContent value="debtors">
          <StatementFrame
            company={company.legalName}
            address={address}
            gstin={company.gstin}
            title="Sundry debtors"
            period={`As on ${formatDateDMY(to)}`}
          >
            <OpeningDues kind="customer" />
            <OutstandingTable rows={debtors} empty="No outstanding customers." />
            <AgeBar totals={debtorAge} />
          </StatementFrame>
        </TabsContent>

        <TabsContent value="creditors">
          <StatementFrame
            company={company.legalName}
            address={address}
            gstin={company.gstin}
            title="Sundry creditors"
            period={`As on ${formatDateDMY(to)}`}
          >
            <OpeningDues kind="supplier" />
            <OutstandingTable rows={creditors} empty="No outstanding suppliers." />
            <AgeBar totals={creditorAge} />
          </StatementFrame>
        </TabsContent>

        <TabsContent value="gst">
          <StatementFrame
            company={company.legalName}
            address={address}
            gstin={company.gstin}
            title="GST computation"
            period={periodLine("For the period")}
          >
            <table className="stmt-table">
              <thead>
                <tr>
                  <th> </th>
                  <th className="text-right">Taxable</th>
                  <th className="text-right">CGST</th>
                  <th className="text-right">SGST</th>
                  <th className="text-right">IGST</th>
                </tr>
              </thead>
              <tbody>
                <GstRow label="Output (net of credit notes)" row={gst.output} />
                <GstRow label="Input (purchases)" row={gst.input} />
                <GstRow label="Net payable / (credit)" row={{ taxable: 0, ...gst.payable }} hideTaxable />
              </tbody>
            </table>
            <p className="mt-4 text-right font-display text-2xl text-forest">
              {gst.netPayable >= 0 ? "GST payable " : "GST credit "}
              {formatINR(Math.abs(gst.netPayable))}
            </p>
          </StatementFrame>
        </TabsContent>

        <TabsContent value="stock">
          <StatementFrame
            company={company.legalName}
            address={address}
            gstin={company.gstin}
            title="Stock valuation at cost"
            period={`As on ${formatDateDMY(to)}`}
          >
            <CompactTable
              heads={["Product", "HSN", "Opening", "Stock out", "Closing", "Unit cost", "Value"]}
              rows={stock.map((r) => [r.name, r.hsn, r.openingQty, r.adjusted, r.closing, r.unitCost, r.costValue])}
              numericFrom={2}
              empty="No stock."
            />
            <p className="mt-3 text-sm">
              <span className="text-muted-foreground">Stock value </span>
              <span className="font-medium tabular-nums">{formatINR(stock.reduce((s, r) => s + r.costValue, 0))}</span>
            </p>
          </StatementFrame>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function StatementFrame({
  company,
  address,
  gstin,
  title,
  period,
  children,
}: {
  company: string;
  address: string;
  gstin: string;
  title: string;
  period: string;
  children: ReactNode;
}) {
  return (
    <article className="register-print print-sheet">
      <header className="register-head">
        <h2 className="font-display text-xl text-forest">{company}</h2>
        <p className="mt-1 text-xs text-sage">{address}</p>
        <p className="font-mono text-[11px]">GSTIN : {gstin}</p>
        <p className="mt-2 text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{period}</p>
      </header>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function InvoiceProfitTable({
  rows,
  totals,
}: {
  rows: InvoiceProfit[];
  totals: { buyAmount: number; sellAmount: number; profit: number; profitPct: number };
}) {
  return (
    <div className="overflow-x-auto">
      <table className="stmt-table">
        <thead>
          <tr>
            <th>Product / invoice</th>
            <th>Batch</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Free</th>
            <th className="text-right">Buy price</th>
            <th className="text-right">Sell price</th>
            <th className="text-right">Buy amt</th>
            <th className="text-right">Sell amt</th>
            <th className="text-right">Margin</th>
            <th className="text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="py-8 text-center text-muted-foreground">
                No invoices in this period.
              </td>
            </tr>
          ) : (
            rows.map((inv) => <InvoiceProfitGroup key={inv.id} inv={inv} />)
          )}
          <tr className="profit-total">
            <td colSpan={6}>Period total</td>
            <td className="text-right tabular-nums">{formatINR(totals.buyAmount)}</td>
            <td className="text-right tabular-nums">{formatINR(totals.sellAmount)}</td>
            <td className={`text-right tabular-nums ${totals.profit < 0 ? "profit-neg" : ""}`}>
              {formatINR(totals.profit)}
            </td>
            <td className={`text-right tabular-nums ${totals.profitPct < 0 ? "profit-neg" : ""}`}>
              {pct(totals.profitPct)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function InvoiceProfitGroup({ inv }: { inv: InvoiceProfit }) {
  return (
    <>
      <tr className="profit-inv">
        <td colSpan={6}>
          {inv.number}
          <span className="ml-2 font-normal text-sage">
            {formatDateDMY(inv.date)} · {inv.party}
          </span>
        </td>
        <td className="text-right tabular-nums">{formatINR(inv.buyAmount)}</td>
        <td className="text-right tabular-nums">{formatINR(inv.sellAmount)}</td>
        <td className={`text-right tabular-nums ${inv.profit < 0 ? "profit-neg" : ""}`}>{formatINR(inv.profit)}</td>
        <td className={`text-right tabular-nums ${inv.profitPct < 0 ? "profit-neg" : ""}`}>{pct(inv.profitPct)}</td>
      </tr>
      {inv.lines.map((l, i) => (
        <tr key={`${inv.id}-${i}`} className="profit-line">
          <td>{l.name}</td>
          <td className="font-mono text-[11px]">{l.batch || "—"}</td>
          <td className="text-right tabular-nums">{l.qty}</td>
          <td className="text-right tabular-nums">{l.freeQty || ""}</td>
          <td className="text-right tabular-nums">{l.buyPrice.toFixed(2)}</td>
          <td className="text-right tabular-nums">{l.sellPrice.toFixed(2)}</td>
          <td className="text-right tabular-nums">{l.buyAmount.toFixed(2)}</td>
          <td className="text-right tabular-nums">{l.sellAmount.toFixed(2)}</td>
          <td className={`text-right tabular-nums ${l.margin < 0 ? "profit-neg" : ""}`}>{l.margin.toFixed(2)}</td>
          <td className={`text-right tabular-nums ${l.marginPct < 0 ? "profit-neg" : ""}`}>{pct(l.marginPct)}</td>
        </tr>
      ))}
    </>
  );
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function StatementTable({ lines }: { lines: StatementLine[] }) {
  return (
    <table className="stmt-table">
      <thead>
        <tr>
          <th>Particulars</th>
          <th className="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) =>
          l.section ? (
            <tr key={i} className="stmt-section">
              <td colSpan={2}>{l.label}</td>
            </tr>
          ) : (
            <tr key={i} className={l.total ? "stmt-total" : ""}>
              <td className={l.indent ? "pl-6" : ""}>{l.label}</td>
              <td className="text-right tabular-nums">{formatINR(l.amount)}</td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}

function OutstandingTable({ rows, empty }: { rows: OutstandingRow[]; empty: string }) {
  return (
    <CompactTable
      heads={["Party", "GSTIN", "Voucher", "Date", "Bill", "Due", "Days", "Age"]}
      rows={rows.map((r) => [r.party, r.gstin, r.voucher, formatDateDMY(r.date), r.amount, r.due, r.days, r.bucket])}
      numericFrom={4}
      empty={empty}
    />
  );
}

function AgeBar({ totals }: { totals: ReturnType<typeof agingTotals> }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
      <span>
        <span className="text-muted-foreground">Due </span>
        <span className="font-medium tabular-nums">{formatINR(totals.due)}</span>
      </span>
      {totals.buckets.map((b) => (
        <span key={b.bucket}>
          <span className="text-muted-foreground">{b.bucket} </span>
          <span className="tabular-nums">{formatINR(b.amount)}</span>
        </span>
      ))}
    </div>
  );
}

function GstRow({
  label,
  row,
  hideTaxable,
}: {
  label: string;
  row: { taxable: number; cgst: number; sgst: number; igst: number };
  hideTaxable?: boolean;
}) {
  return (
    <tr>
      <td>{label}</td>
      <td className="text-right tabular-nums">{hideTaxable ? "—" : formatINR(row.taxable)}</td>
      <td className="text-right tabular-nums">{formatINR(row.cgst)}</td>
      <td className="text-right tabular-nums">{formatINR(row.sgst)}</td>
      <td className="text-right tabular-nums">{formatINR(row.igst)}</td>
    </tr>
  );
}

function outstandingExcel(rows: OutstandingRow[]): (string | number)[][] {
  return [
    ["Party", "GSTIN", "Voucher", "Date", "Bill amount", "Due", "Days", "Age"],
    ...rows.map((r) => [r.party, r.gstin, r.voucher, formatDateDMY(r.date), r.amount, r.due, r.days, r.bucket]),
  ];
}

function padPair(left: StatementLine[], right: StatementLine[]): (string | number)[][] {
  const n = Math.max(left.length, right.length);
  const rows: (string | number)[][] = [];
  for (let i = 0; i < n; i++) {
    const l = left[i];
    const r = right[i];
    rows.push([
      l ? `${l.indent ? "    " : ""}${l.label}` : "",
      l && !l.section ? round2(l.amount) : "",
      r ? `${r.indent ? "    " : ""}${r.label}` : "",
      r && !r.section ? round2(r.amount) : "",
    ]);
  }
  return rows;
}
