import { formatDateDMY } from "./format";
import { invoiceTotals, round2 } from "./gst";
import type { DateRange } from "./registers";
import { inRange, stockRegister } from "./registers";
import { invoiceNetDue } from "./returns";
import type { CreditNote, Invoice, OpeningDue, Product, Purchase, StockAdjustment } from "./types";

export type StatementLine = { label: string; amount: number; indent?: boolean; total?: boolean; section?: boolean };

function liveInvoices(invoices: Invoice[]) {
  return invoices.filter((i) => i.status !== "draft" && i.status !== "cancelled");
}

function postedPurchases(purchases: Purchase[]) {
  return purchases.filter((p) => p.status === "posted");
}

function issuedNotes(notes: CreditNote[]) {
  return notes.filter((n) => n.status === "issued");
}

function dayBefore(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function stockValue(rows: { closing: number; costValue: number }[]): number {
  return round2(rows.reduce((s, r) => s + Math.max(0, r.costValue), 0));
}

export type ProfitAndLoss = {
  sales: number;
  salesReturns: number;
  netSales: number;
  openingStock: number;
  purchases: number;
  closingStock: number;
  cogs: number;
  grossProfit: number;
  outputGst: number;
  inputGst: number;
  lines: StatementLine[];
};

export function profitAndLoss(
  invoices: Invoice[],
  purchases: Purchase[],
  creditNotes: CreditNote[],
  products: Product[],
  range: DateRange,
  adjustments: StockAdjustment[] = [],
): ProfitAndLoss {
  const sales = round2(
    liveInvoices(invoices)
      .filter((i) => inRange(i.date, range))
      .reduce((s, i) => s + invoiceTotals(i).taxable, 0),
  );
  const salesReturns = round2(
    issuedNotes(creditNotes)
      .filter((n) => inRange(n.date, range))
      .reduce((s, n) => s + invoiceTotals(n).taxable, 0),
  );
  const netSales = round2(sales - salesReturns);
  const purchasesAmt = round2(
    postedPurchases(purchases)
      .filter((p) => inRange(p.date, range))
      .reduce((s, p) => s + invoiceTotals(p).taxable, 0),
  );
  const opening = stockValue(stockRegister(products, purchases, invoices, creditNotes, dayBefore(range.from), undefined, adjustments));
  const closing = stockValue(stockRegister(products, purchases, invoices, creditNotes, range.to, undefined, adjustments));
  const cogs = round2(opening + purchasesAmt - closing);
  const grossProfit = round2(netSales - cogs);

  const outputGst = round2(
    liveInvoices(invoices)
      .filter((i) => inRange(i.date, range))
      .reduce((s, i) => s + invoiceTotals(i).tax, 0) -
      issuedNotes(creditNotes)
        .filter((n) => inRange(n.date, range))
        .reduce((s, n) => s + invoiceTotals(n).tax, 0),
  );
  const inputGst = round2(
    postedPurchases(purchases)
      .filter((p) => inRange(p.date, range))
      .reduce((s, p) => s + invoiceTotals(p).tax, 0),
  );

  const lines: StatementLine[] = [
    { label: "Income", amount: 0, section: true },
    { label: "Sales", amount: sales },
    { label: "Less: Sales returns / credit notes", amount: -salesReturns, indent: true },
    { label: "Net sales", amount: netSales, total: true },
    { label: "Cost of goods sold", amount: 0, section: true },
    { label: "Opening stock", amount: opening },
    { label: "Add: Purchases", amount: purchasesAmt, indent: true },
    { label: "Less: Closing stock", amount: -closing, indent: true },
    { label: "Cost of goods sold", amount: cogs, total: true },
    { label: grossProfit >= 0 ? "Net profit" : "Net loss", amount: grossProfit, total: true },
  ];

  return {
    sales,
    salesReturns,
    netSales,
    openingStock: opening,
    purchases: purchasesAmt,
    closingStock: closing,
    cogs,
    grossProfit,
    outputGst,
    inputGst,
    lines,
  };
}

export type BalanceSheet = {
  asOn: string;
  inventory: number;
  debtors: number;
  cash: number;
  gstCredit: number;
  totalAssets: number;
  creditors: number;
  gstPayable: number;
  profit: number;
  capital: number;
  totalLiabilities: number;
  assetLines: StatementLine[];
  liabilityLines: StatementLine[];
};

export function balanceSheet(
  invoices: Invoice[],
  purchases: Purchase[],
  creditNotes: CreditNote[],
  products: Product[],
  asOn: string,
  fyStart: string,
  adjustments: StockAdjustment[] = [],
  openingDues: OpeningDue[] = [],
): BalanceSheet {
  const inventory = stockValue(stockRegister(products, purchases, invoices, creditNotes, asOn, undefined, adjustments));
  const openCustomer = openingDues.filter((d) => d.kind === "customer" && d.date <= asOn);
  const openSupplier = openingDues.filter((d) => d.kind === "supplier" && d.date <= asOn);
  const debtors = round2(
    liveInvoices(invoices)
      .filter((i) => i.date <= asOn)
      .reduce((s, i) => s + invoiceNetDue(i, creditNotes.filter((n) => n.date <= asOn)), 0) +
      openCustomer.reduce((s, d) => s + Math.max(0, d.amount - (d.paidAmount || 0)), 0),
  );
  const received = round2(
    liveInvoices(invoices)
      .filter((i) => i.date <= asOn)
      .reduce((s, i) => s + Math.min(i.paidAmount, invoiceTotals(i).grand), 0) +
      openCustomer.reduce((s, d) => s + (d.paidAmount || 0), 0),
  );
  const paidSuppliers = round2(
    postedPurchases(purchases)
      .filter((p) => p.date <= asOn)
      .reduce((s, p) => s + Math.min(p.paidAmount || 0, invoiceTotals(p).grand), 0) +
      openSupplier.reduce((s, d) => s + (d.paidAmount || 0), 0),
  );
  const cash = round2(received - paidSuppliers);
  const inputGst = round2(
    postedPurchases(purchases)
      .filter((p) => p.date <= asOn)
      .reduce((s, p) => s + invoiceTotals(p).tax, 0),
  );
  const outputGst = round2(
    liveInvoices(invoices)
      .filter((i) => i.date <= asOn)
      .reduce((s, i) => s + invoiceTotals(i).tax, 0) -
      issuedNotes(creditNotes)
        .filter((n) => n.date <= asOn)
        .reduce((s, n) => s + invoiceTotals(n).tax, 0),
  );
  const gstNet = round2(outputGst - inputGst);
  const gstPayable = Math.max(0, gstNet);
  const gstCredit = Math.max(0, -gstNet);
  const creditors = round2(
    postedPurchases(purchases)
      .filter((p) => p.date <= asOn)
      .reduce((s, p) => s + Math.max(0, invoiceTotals(p).grand - (p.paidAmount || 0)), 0) +
      openSupplier.reduce((s, d) => s + Math.max(0, d.amount - (d.paidAmount || 0)), 0),
  );

  const pnl = profitAndLoss(invoices, purchases, creditNotes, products, { from: fyStart, to: asOn }, adjustments);
  const profit = pnl.grossProfit;

  const totalAssets = round2(inventory + debtors + cash + gstCredit);
  const capital = round2(totalAssets - creditors - gstPayable);
  const openingCapital = round2(capital - profit);
  const totalLiabilities = round2(openingCapital + profit + creditors + gstPayable);

  return {
    asOn,
    inventory,
    debtors,
    cash,
    gstCredit,
    totalAssets,
    creditors,
    gstPayable,
    profit,
    capital,
    totalLiabilities,
    assetLines: [
      { label: "Current assets", amount: 0, section: true },
      { label: "Closing stock (at cost)", amount: inventory },
      { label: "Sundry debtors", amount: debtors },
      { label: "Cash & bank (receipts)", amount: cash },
      { label: "GST input credit", amount: gstCredit },
      { label: "Total assets", amount: totalAssets, total: true },
    ],
    liabilityLines: [
      { label: "Capital & surplus", amount: 0, section: true },
      { label: "Capital account", amount: openingCapital },
      { label: profit >= 0 ? "Current year profit" : "Current year loss", amount: profit, indent: true },
      { label: "Current liabilities", amount: 0, section: true },
      { label: "Sundry creditors", amount: creditors },
      { label: "GST payable", amount: gstPayable },
      { label: "Total liabilities", amount: totalLiabilities, total: true },
    ],
  };
}

export type OutstandingRow = {
  party: string;
  gstin: string;
  voucher: string;
  date: string;
  amount: number;
  due: number;
  days: number;
  bucket: string;
};

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function bucket(days: number): string {
  if (days <= 30) return "0–30";
  if (days <= 60) return "31–60";
  if (days <= 90) return "61–90";
  return "90+";
}

export function debtorsOutstanding(
  invoices: Invoice[],
  creditNotes: CreditNote[],
  asOn: string,
  openingDues: OpeningDue[] = [],
): OutstandingRow[] {
  const notes = creditNotes.filter((n) => n.date <= asOn);
  return liveInvoices(invoices)
    .filter((i) => i.date <= asOn)
    .map((i) => {
      const due = invoiceNetDue(i, notes);
      const days = daysBetween(i.date, asOn);
      return {
        party: i.party.name,
        gstin: i.party.gstin || "0",
        voucher: i.number,
        date: i.date,
        amount: invoiceTotals(i).grand,
        due,
        days,
        bucket: bucket(days),
      };
    })
    .filter((r) => r.due > 0.009)
    .concat(openingRows(openingDues, "customer", asOn))
    .sort((a, b) => b.days - a.days || a.party.localeCompare(b.party));
}

export function creditorsOutstanding(purchases: Purchase[], asOn: string, openingDues: OpeningDue[] = []): OutstandingRow[] {
  return postedPurchases(purchases)
    .filter((p) => p.date <= asOn)
    .map((p) => {
      const amount = invoiceTotals(p).grand;
      const due = round2(Math.max(0, amount - (p.paidAmount || 0)));
      const days = daysBetween(p.date, asOn);
      return {
        party: p.supplier.name,
        gstin: p.supplier.gstin || "0",
        voucher: p.billNo || p.number,
        date: p.date,
        amount,
        due,
        days,
        bucket: bucket(days),
      };
    })
    .filter((r) => r.due > 0.009)
    .concat(openingRows(openingDues, "supplier", asOn))
    .sort((a, b) => b.days - a.days || a.party.localeCompare(b.party));
}

function openingRows(rows: OpeningDue[], kind: OpeningDue["kind"], asOn: string): OutstandingRow[] {
  return rows
    .filter((d) => d.kind === kind && d.date <= asOn)
    .map((d) => {
      const due = round2(Math.max(0, d.amount - (d.paidAmount || 0)));
      const days = daysBetween(d.date, asOn);
      return {
        party: d.partyName,
        gstin: "0",
        voucher: "Opening",
        date: d.date,
        amount: d.amount,
        due,
        days,
        bucket: bucket(days),
      };
    })
    .filter((r) => r.due > 0.009);
}

export type InvoiceLineProfit = {
  name: string;
  batch: string;
  hsn: string;
  qty: number;
  freeQty: number;
  buyPrice: number;
  sellPrice: number;
  buyAmount: number;
  sellAmount: number;
  margin: number;
  marginPct: number;
};

export type InvoiceProfit = {
  id: string;
  number: string;
  date: string;
  party: string;
  buyAmount: number;
  sellAmount: number;
  profit: number;
  profitPct: number;
  lines: InvoiceLineProfit[];
};

export type InvoiceProfitTotals = {
  buyAmount: number;
  sellAmount: number;
  profit: number;
  profitPct: number;
};

export function invoiceProfits(
  invoices: Invoice[],
  purchases: Purchase[],
  creditNotes: CreditNote[],
  products: Product[],
  range: DateRange,
  adjustments: StockAdjustment[] = [],
): { rows: InvoiceProfit[]; totals: InvoiceProfitTotals } {
  const stock = stockRegister(products, purchases, invoices, creditNotes, range.to, undefined, adjustments);
  const costById = new Map(stock.map((r) => [r.productId, r.unitCost]));
  const ptsById = new Map(products.map((p) => [p.id, p.pts]));

  const rows: InvoiceProfit[] = liveInvoices(invoices)
    .filter((i) => inRange(i.date, range))
    .sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number))
    .map((inv) => {
      const lines: InvoiceLineProfit[] = inv.lines.map((line) => {
        const buyPrice = round2(costById.get(line.productId) || ptsById.get(line.productId) || line.pts || 0);
        const sellPrice = round2(line.rate);
        const units = line.qty + line.freeQty;
        const buyAmount = round2(buyPrice * units);
        const sellAmount = round2(line.taxable);
        const margin = round2(sellAmount - buyAmount);
        const marginPct = sellAmount > 0.009 ? round2((margin / sellAmount) * 100) : 0;
        return {
          name: line.name,
          batch: line.batch,
          hsn: line.hsn,
          qty: line.qty,
          freeQty: line.freeQty,
          buyPrice,
          sellPrice,
          buyAmount,
          sellAmount,
          margin,
          marginPct,
        };
      });
      const buyAmount = round2(lines.reduce((s, l) => s + l.buyAmount, 0));
      const sellAmount = round2(lines.reduce((s, l) => s + l.sellAmount, 0));
      const profit = round2(sellAmount - buyAmount);
      const profitPct = sellAmount > 0.009 ? round2((profit / sellAmount) * 100) : 0;
      return {
        id: inv.id,
        number: inv.number,
        date: inv.date,
        party: inv.party.name,
        buyAmount,
        sellAmount,
        profit,
        profitPct,
        lines,
      };
    });

  const buyAmount = round2(rows.reduce((s, r) => s + r.buyAmount, 0));
  const sellAmount = round2(rows.reduce((s, r) => s + r.sellAmount, 0));
  const profit = round2(sellAmount - buyAmount);
  const profitPct = sellAmount > 0.009 ? round2((profit / sellAmount) * 100) : 0;
  return { rows, totals: { buyAmount, sellAmount, profit, profitPct } };
}

export function gstComputation(
  invoices: Invoice[],
  purchases: Purchase[],
  creditNotes: CreditNote[],
  range: DateRange,
) {
  const sales = liveInvoices(invoices).filter((i) => inRange(i.date, range));
  const buys = postedPurchases(purchases).filter((p) => inRange(p.date, range));
  const notes = issuedNotes(creditNotes).filter((n) => inRange(n.date, range));
  const out = sales.reduce(
    (a, i) => {
      const t = invoiceTotals(i);
      a.taxable += t.taxable;
      a.cgst += t.cgst;
      a.sgst += t.sgst;
      a.igst += t.igst;
      return a;
    },
    { taxable: 0, cgst: 0, sgst: 0, igst: 0 },
  );
  const cn = notes.reduce(
    (a, n) => {
      const t = invoiceTotals(n);
      a.taxable += t.taxable;
      a.cgst += t.cgst;
      a.sgst += t.sgst;
      a.igst += t.igst;
      return a;
    },
    { taxable: 0, cgst: 0, sgst: 0, igst: 0 },
  );
  const inn = buys.reduce(
    (a, p) => {
      const t = invoiceTotals(p);
      a.taxable += t.taxable;
      a.cgst += t.cgst;
      a.sgst += t.sgst;
      a.igst += t.igst;
      return a;
    },
    { taxable: 0, cgst: 0, sgst: 0, igst: 0 },
  );
  const output = {
    taxable: round2(out.taxable - cn.taxable),
    cgst: round2(out.cgst - cn.cgst),
    sgst: round2(out.sgst - cn.sgst),
    igst: round2(out.igst - cn.igst),
  };
  const input = { taxable: round2(inn.taxable), cgst: round2(inn.cgst), sgst: round2(inn.sgst), igst: round2(inn.igst) };
  const payable = {
    cgst: round2(output.cgst - input.cgst),
    sgst: round2(output.sgst - input.sgst),
    igst: round2(output.igst - input.igst),
  };
  return {
    output,
    input,
    payable,
    netPayable: round2(payable.cgst + payable.sgst + payable.igst),
  };
}

export function agingTotals(rows: OutstandingRow[]) {
  const buckets = ["0–30", "31–60", "61–90", "90+"] as const;
  const map = Object.fromEntries(buckets.map((b) => [b, 0])) as Record<(typeof buckets)[number], number>;
  let due = 0;
  for (const r of rows) {
    due += r.due;
    map[r.bucket as (typeof buckets)[number]] += r.due;
  }
  return { due: round2(due), buckets: buckets.map((b) => ({ bucket: b, amount: round2(map[b]) })) };
}

export function statementHeader(company: string, address: string, gstin: string, title: string, period: string): string[][] {
  return [[company], [address], [`GSTIN : ${gstin}`], [title], [period], []];
}

export function statementExcelRows(lines: StatementLine[]): (string | number)[][] {
  return [
    ["Particulars", "Amount"],
    ...lines.map((l) => {
      if (l.section) return [l.label, ""];
      return [`${l.indent ? "    " : ""}${l.label}`, round2(l.amount)];
    }),
  ];
}

export { formatDateDMY };
