import { createFileRoute } from "@tanstack/react-router";
import { FileSpreadsheet, Printer } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompactTable, GstRegister } from "@/components/gst-register";
import { downloadExcel } from "@/lib/excel";
import { formatDateDMY, formatINR } from "@/lib/format";
import { currentFinancialYear, currentMonthRange, currentQuarterRange, financialYearRange, invoiceTotals, lastMonthRange, round2, stateName } from "@/lib/gst";
import {
  PURCHASE_HEADS,
  SALES_HEADS,
  companyHeader,
  purchaseCells,
  purchaseRegister,
  rateBuckets,
  rateMatrixRows,
  registerTotals,
  salesCells,
  salesDatewise,
  salesRegister,
  stockRegister,
  inRange,
  type DateRange,
} from "@/lib/registers";
import { orientLabel, printPage, type PageOrient } from "@/lib/print-page";
import { kindLabel } from "@/lib/returns";
import { useBillingStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

type ReportKey = "sales-gst" | "purchase-gst" | "sales-date" | "stock" | "gstr";

const REPORT_ORIENT: Record<ReportKey, PageOrient> = {
  "sales-gst": "portrait",
  "purchase-gst": "portrait",
  "sales-date": "landscape",
  stock: "landscape",
  gstr: "portrait",
};

function ReportsPage() {
  const company = useBillingStore((s) => s.company);
  const invoices = useBillingStore((s) => s.invoices);
  const purchases = useBillingStore((s) => s.purchases);
  const products = useBillingStore((s) => s.products);
  const creditNotes = useBillingStore((s) => s.creditNotes);
  const adjustments = useBillingStore((s) => s.adjustments);
  const fy = currentFinancialYear();
  const fyTo = `${fy.end}-03-31`;
  const [from, setFrom] = useState(`${fy.start}-04-01`);
  const [to, setTo] = useState(fyTo);
  const [tab, setTab] = useState<ReportKey>("sales-gst");
  const range: DateRange = { from, to };
  const printOrient = REPORT_ORIENT[tab];

  const salesLines = useMemo(() => salesRegister(invoices, range), [invoices, range]);
  const purchaseLines = useMemo(() => purchaseRegister(purchases, range), [purchases, range]);
  const datewise = useMemo(() => salesDatewise(invoices, range), [invoices, range]);
  const stock = useMemo(
    () => stockRegister(products, purchases, invoices, creditNotes, undefined, undefined, adjustments),
    [products, purchases, invoices, creditNotes, adjustments],
  );
  const salesTot = registerTotals(salesLines);
  const purTot = registerTotals(purchaseLines);
  const salesRates = rateBuckets(salesLines);
  const purchaseRates = rateBuckets(purchaseLines);

  const live = invoices.filter((i) => i.status !== "draft" && i.status !== "cancelled" && inRange(i.date, range));
  const notes = creditNotes.filter((n) => n.status === "issued" && inRange(n.date, range));
  const b2b = live.filter((i) => i.party.gstin);
  const b2c = live.filter((i) => !i.party.gstin);
  const outsideSales = invoices.filter(
    (i) => (i.status === "issued" || i.status === "partial" || i.status === "paid") && !inRange(i.date, range),
  ).length;
  const outsidePurchases = purchases.filter((p) => p.status === "posted" && !inRange(p.date, range)).length;
  const draftSales = invoices.filter((i) => i.status === "draft").length;
  const draftPurchases = purchases.filter((p) => p.status === "draft").length;

  function header(title: string) {
    return companyHeader(company, title, range);
  }

  function exportCurrent() {
    const stamp = `${formatDateDMY(from).replaceAll("-", "")}-${formatDateDMY(to).replaceAll("-", "")}`;
    if (tab === "sales-gst") {
      const totalRow = [
        "Total",
        salesLines.length,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        salesTot.qty,
        "",
        "",
        salesTot.taxable,
        "",
        salesTot.sgst,
        "",
        salesTot.cgst,
        "",
        salesTot.igst,
        salesTot.total,
        "",
      ];
      downloadExcel(`Sales-GST-List-${stamp}`, [
        {
          name: "Sales GST List",
          rows: [...header("Sales GST List"), [...SALES_HEADS], ...salesLines.map(salesCells), totalRow, ...rateMatrixRows(salesRates)],
        },
      ]);
    } else if (tab === "purchase-gst") {
      const totalRow = [
        "Total",
        purchaseLines.length,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        purTot.qty,
        "",
        "",
        purTot.taxable,
        "",
        "",
        purTot.sgst,
        "",
        purTot.cgst,
        "",
        purTot.igst,
        purTot.total,
        "",
        "",
      ];
      downloadExcel(`Purchase-GST-List-${stamp}`, [
        {
          name: "Purchase GST List",
          rows: [
            ...header("Purchase GST List"),
            [...PURCHASE_HEADS],
            ...purchaseLines.map(purchaseCells),
            totalRow,
            ...rateMatrixRows(purchaseRates),
          ],
        },
      ]);
    } else if (tab === "sales-date") {
      downloadExcel(`Sales-Datewise-${stamp}`, [
        {
          name: "Sales date wise",
          rows: [
            ...header("Sales Report — Date wise"),
            ["Voucher Number", "Date", "Customer", "GSTIN", "City", "State", "Qty", "Taxable", "CGST", "SGST", "IGST", "Total"],
            ...datewise.map((r) => [
              r.number,
              formatDateDMY(r.date),
              r.party,
              r.gstin,
              r.city,
              r.state,
              r.qty,
              r.taxable,
              r.cgst,
              r.sgst,
              r.igst,
              r.total,
            ]),
          ],
        },
      ]);
    } else if (tab === "stock") {
      downloadExcel(`Stock-Report-${stamp}`, [
        {
          name: "Stock",
          rows: [
            ...header("Stock Report"),
            ["Product", "HSN", "Pack", "Batch", "Expiry", "Opening", "Purchase", "Free in", "Sales", "Free out", "Return", "Stock out", "Closing", "PTS", "MRP", "Value"],
            ...stock.map((r) => [
              r.name,
              r.hsn,
              r.pack,
              r.batch,
              r.expiry ? formatDateDMY(r.expiry) : "",
              r.openingQty,
              r.purchaseQty,
              r.freeIn,
              r.salesQty,
              r.freeOut,
              r.returned,
              r.adjusted,
              r.closing,
              r.pts,
              r.mrp,
              r.value,
            ]),
          ],
        },
      ]);
    } else {
      downloadExcel(`GSTR-Working-${stamp}`, [
        {
          name: "B2B",
          rows: [
            ...header("GSTR-1 B2B"),
            ["Invoice", "Date", "GSTIN", "Party", "Taxable", "CGST", "SGST", "IGST", "Value"],
            ...b2b.map((i) => {
              const t = invoiceTotals(i);
              return [i.number, formatDateDMY(i.date), i.party.gstin, i.party.name, t.taxable, t.cgst, t.sgst, t.igst, t.grand];
            }),
          ],
        },
        {
          name: "B2C",
          rows: [
            ...header("GSTR-1 B2C"),
            ["Invoice", "Date", "Party", "Taxable", "Tax", "Value"],
            ...b2c.map((i) => {
              const t = invoiceTotals(i);
              return [i.number, formatDateDMY(i.date), i.party.name, t.taxable, t.tax, t.grand];
            }),
          ],
        },
        {
          name: "Credit notes",
          rows: [
            ...header("CDNR / CDNUR"),
            ["Note", "Date", "GSTIN", "Party", "Invoice", "Type", "Taxable", "Tax", "Value"],
            ...notes.map((n) => {
              const t = invoiceTotals(n);
              return [
                n.number,
                formatDateDMY(n.date),
                n.party.gstin || "0",
                n.party.name,
                n.invoiceNumber,
                kindLabel(n.kind),
                t.taxable,
                t.tax,
                t.grand,
              ];
            }),
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
          <h1 className="font-display text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            GST lists for the accountant — Excel and PDF, same columns as your Tally export.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={exportCurrent}>
            <FileSpreadsheet className="size-4" />
            Excel
          </Button>
          <Button variant="outline" onClick={() => printPage(printOrient)}>
            <Printer className="size-4" />
            PDF
          </Button>
          <span className="text-[11px] text-muted-foreground">{orientLabel(printOrient)}</span>
        </div>
      </div>

      <div className="no-print mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
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

      {outsideSales + outsidePurchases + draftSales + draftPurchases > 0 ? (
        <p className="no-print mt-3 text-sm text-muted-foreground">
          {outsideSales + outsidePurchases > 0
            ? `${outsideSales} sales and ${outsidePurchases} purchases fall outside ${formatDateDMY(from)} – ${formatDateDMY(to)}. `
            : null}
          {draftSales + draftPurchases > 0
            ? `${draftSales} sales and ${draftPurchases} purchases are still drafts, so they stay off the GST list until posted. `
            : null}
          {outsideSales + outsidePurchases > 0 ? (
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
          ) : null}
        </p>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as ReportKey)} className="mt-6">
        <TabsList className="no-print flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="sales-gst">Sales GST</TabsTrigger>
          <TabsTrigger value="purchase-gst">Purchase GST</TabsTrigger>
          <TabsTrigger value="sales-date">Date-wise sales</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="gstr">GST return</TabsTrigger>
        </TabsList>

        <TabsContent value="sales-gst">
          <RegisterFrame
            company={company.legalName}
            address={`${company.addressLine1}, ${company.city}, ${stateName(company.stateCode)} ${company.pincode}`}
            gstin={company.gstin}
            title="Sales GST List"
            range={range}
          >
            <GstRegister kind="sales" lines={salesLines} />
            <TotalsBar
              items={[
                ["Qty", String(salesTot.qty)],
                ["Taxable", formatINR(salesTot.taxable)],
                ["SGST", formatINR(salesTot.sgst)],
                ["CGST", formatINR(salesTot.cgst)],
                ["IGST", formatINR(salesTot.igst)],
                ["Total", formatINR(salesTot.total)],
              ]}
            />
            <RateMatrix buckets={salesRates} />
          </RegisterFrame>
        </TabsContent>

        <TabsContent value="purchase-gst">
          <RegisterFrame
            company={company.legalName}
            address={`${company.addressLine1}, ${company.city}, ${stateName(company.stateCode)} ${company.pincode}`}
            gstin={company.gstin}
            title="Purchase GST List"
            range={range}
          >
            <GstRegister kind="purchase" lines={purchaseLines} />
            <TotalsBar
              items={[
                ["Qty", String(purTot.qty)],
                ["Taxable", formatINR(purTot.taxable)],
                ["SGST", formatINR(purTot.sgst)],
                ["CGST", formatINR(purTot.cgst)],
                ["IGST", formatINR(purTot.igst)],
                ["Total", formatINR(purTot.total)],
              ]}
            />
            <RateMatrix buckets={purchaseRates} />
          </RegisterFrame>
        </TabsContent>

        <TabsContent value="sales-date">
          <RegisterFrame
            company={company.legalName}
            address={`${company.addressLine1}, ${company.city}, ${stateName(company.stateCode)} ${company.pincode}`}
            gstin={company.gstin}
            title="Sales Report — Date wise"
            range={range}
          >
            <CompactTable
              heads={["Voucher", "Date", "Customer", "GSTIN", "Qty", "Taxable", "CGST", "SGST", "IGST", "Total"]}
              rows={datewise.map((r) => [
                r.number,
                formatDateDMY(r.date),
                r.party,
                r.gstin,
                r.qty,
                r.taxable,
                r.cgst,
                r.sgst,
                r.igst,
                r.total,
              ])}
              numericFrom={4}
              empty="No invoices in this period."
            />
          </RegisterFrame>
        </TabsContent>

        <TabsContent value="stock">
          <RegisterFrame
            company={company.legalName}
            address={`${company.addressLine1}, ${company.city}, ${stateName(company.stateCode)} ${company.pincode}`}
            gstin={company.gstin}
            title="Stock Report"
            range={range}
          >
            <CompactTable
              heads={["Product", "Batch", "MRP", "Open", "In", "Sales", "Return", "Out", "Closing", "Value"]}
              rows={stock.map((r) => [
                r.name,
                r.batch || "—",
                r.mrp ? r.mrp.toFixed(2) : "—",
                r.openingQty,
                r.purchaseQty,
                r.salesQty,
                r.returned,
                r.adjusted,
                r.closing,
                r.value,
              ])}
              numericFrom={2}
              empty="No stock movement yet."
            />
            <TotalsBar
              items={[
                ["Closing packs", String(round2(stock.reduce((s, r) => s + r.closing, 0)))],
                ["Stock value (PTS)", formatINR(stock.reduce((s, r) => s + r.value, 0))],
              ]}
            />
          </RegisterFrame>
        </TabsContent>

        <TabsContent value="gstr">
          <RegisterFrame
            company={company.legalName}
            address={`${company.addressLine1}, ${company.city}, ${stateName(company.stateCode)} ${company.pincode}`}
            gstin={company.gstin}
            title="GST return working"
            range={range}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="B2B invoices" value={String(b2b.length)} />
              <Stat label="B2C invoices" value={String(b2c.length)} />
              <Stat label="Credit notes" value={String(notes.length)} />
              <Stat label="Net sales" value={formatINR(salesTot.total)} />
            </div>
            <h3 className="mt-6 font-display text-lg">B2B</h3>
            <CompactTable
              heads={["Invoice", "Date", "GSTIN", "Party", "Taxable", "Tax", "Value"]}
              rows={b2b.map((i) => {
                const t = invoiceTotals(i);
                return [i.number, formatDateDMY(i.date), i.party.gstin, i.party.name, t.taxable, t.tax, t.grand];
              })}
              numericFrom={4}
              empty="No B2B invoices."
            />
            <h3 className="mt-6 font-display text-lg">B2C</h3>
            <CompactTable
              heads={["Invoice", "Date", "Party", "Taxable", "Tax", "Value"]}
              rows={b2c.map((i) => {
                const t = invoiceTotals(i);
                return [i.number, formatDateDMY(i.date), i.party.name, t.taxable, t.tax, t.grand];
              })}
              numericFrom={3}
              empty="No B2C invoices."
            />
            <h3 className="mt-6 font-display text-lg">Credit notes</h3>
            <CompactTable
              heads={["Note", "Date", "Party", "Invoice", "Type", "Taxable", "Value"]}
              rows={notes.map((n) => {
                const t = invoiceTotals(n);
                return [n.number, formatDateDMY(n.date), n.party.name, n.invoiceNumber, kindLabel(n.kind), t.taxable, t.grand];
              })}
              numericFrom={5}
              empty="No credit notes."
            />
          </RegisterFrame>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function RegisterFrame({
  company,
  address,
  gstin,
  title,
  range,
  children,
}: {
  company: string;
  address: string;
  gstin: string;
  title: string;
  range: DateRange;
  children: ReactNode;
}) {
  return (
    <article className="register-print print-sheet">
      <header className="register-head">
        <h2 className="font-display text-xl text-forest">{company}</h2>
        <p className="mt-1 text-xs text-sage">{address}</p>
        <p className="font-mono text-[11px]">GSTIN : {gstin}</p>
        <p className="mt-2 text-sm font-medium">
          {title} From : {formatDateDMY(range.from)} To : {formatDateDMY(range.to)}
        </p>
      </header>
      <div className="mt-4 space-y-4">{children}</div>
    </article>
  );
}

function TotalsBar({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 text-sm">
      {items.map(([k, v]) => (
        <div key={k}>
          <span className="text-muted-foreground">{k} </span>
          <span className="font-medium tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  );
}

function RateMatrix({ buckets }: { buckets: { rate: number; taxable: number; cgst: number; sgst: number; igst: number }[] }) {
  if (!buckets.length) return null;
  return (
    <table className="mt-2 w-full max-w-xl text-[11px]">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
          <th className="py-1 text-left font-medium"> </th>
          {buckets.map((b) => (
            <th key={b.rate} className="py-1 text-right font-medium">
              {b.rate}%
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(
          [
            ["Taxable", "taxable"],
            ["CGST", "cgst"],
            ["SGST", "sgst"],
            ["IGST", "igst"],
          ] as const
        ).map(([label, key]) => (
          <tr key={label}>
            <td className="py-0.5">{label}</td>
            {buckets.map((b) => (
              <td key={b.rate} className="py-0.5 text-right tabular-nums">
                {formatINR(b[key], { withSymbol: false })}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-display text-2xl tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
