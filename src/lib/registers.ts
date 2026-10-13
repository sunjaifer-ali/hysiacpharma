import { formatDateDMY } from "./format";
import { GST_RATES, invoiceTotals, round2, stateName } from "./gst";
import { restocksInventory } from "./returns";
import { isInsuranceLine } from "./insurance";
import type { CompanyProfile, CreditNote, Invoice, Product, Purchase, StockAdjustment } from "./types";

export type DateRange = { from: string; to: string };

export function inRange(iso: string, range: DateRange): boolean {
  const day = (iso || "").slice(0, 10);
  return day >= range.from.slice(0, 10) && day <= range.to.slice(0, 10);
}

export type RegisterLine = {
  voucherNumber: string;
  invoiceNumber: string;
  date: string;
  voucherType: string;
  partyName: string;
  city: string;
  state: string;
  gstin: string;
  productName: string;
  hsn: string;
  gstRate: number;
  qty: number;
  freeQty: number;
  rate: number;
  ledger: string;
  taxable: number;
  sgstPct: number;
  sgst: number;
  cgstPct: number;
  cgst: number;
  igstPct: number;
  igst: number;
  total: number;
  unit: string;
  supplierDate: string;
};

export type RateBucket = {
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
};

function partyGstin(gstin: string): string {
  return gstin?.trim() ? gstin : "0";
}

export function salesRegister(invoices: Invoice[], range: DateRange): RegisterLine[] {
  const rows: RegisterLine[] = [];
  for (const inv of invoices) {
    if (inv.status === "draft" || inv.status === "cancelled") continue;
    if (!inRange(inv.date, range)) continue;
    const inter = inv.lines.some((l) => l.igst > 0);
    for (const line of inv.lines) {
      const total = round2(line.taxable + line.cgst + line.sgst + line.igst);
      rows.push({
        voucherNumber: inv.number,
        invoiceNumber: inv.number,
        date: inv.date,
        voucherType: inter ? "Interstate Sales" : "SALES",
        partyName: inv.party.name,
        city: inv.party.city,
        state: stateName(inv.party.stateCode),
        gstin: partyGstin(inv.party.gstin),
        productName: line.name,
        hsn: line.hsn,
        gstRate: line.gstRate,
        qty: line.qty,
        freeQty: line.freeQty,
        rate: line.rate,
        ledger: "Outward supply of goods",
        taxable: line.taxable,
        sgstPct: line.sgst > 0 ? line.gstRate / 2 : 0,
        sgst: line.sgst,
        cgstPct: line.cgst > 0 ? line.gstRate / 2 : 0,
        cgst: line.cgst,
        igstPct: line.igst > 0 ? line.gstRate : 0,
        igst: line.igst,
        total,
        unit: line.unit,
        supplierDate: inv.date,
      });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.voucherNumber.localeCompare(b.voucherNumber));
}

export function purchaseRegister(purchases: Purchase[], range: DateRange): RegisterLine[] {
  const rows: RegisterLine[] = [];
  for (const pur of purchases) {
    if (pur.status !== "posted") continue;
    if (!inRange(pur.date, range)) continue;
    const inter = pur.lines.some((l) => l.igst > 0);
    for (const line of pur.lines) {
      const total = round2(line.taxable + line.cgst + line.sgst + line.igst);
      rows.push({
        voucherNumber: pur.number,
        invoiceNumber: pur.billNo || pur.challanNo || "",
        date: pur.date,
        voucherType: inter ? "Interstate Purchase" : "Local Purchase",
        partyName: pur.supplier.name,
        city: pur.supplier.city,
        state: stateName(pur.supplier.stateCode),
        gstin: partyGstin(pur.supplier.gstin),
        productName: line.name,
        hsn: line.hsn,
        gstRate: line.gstRate,
        qty: line.qty,
        freeQty: line.freeQty,
        rate: line.purchaseRate,
        ledger: isInsuranceLine(line) ? "Insurance" : "Inward supply of goods",
        taxable: line.taxable,
        sgstPct: line.sgst > 0 ? line.gstRate / 2 : 0,
        sgst: line.sgst,
        cgstPct: line.cgst > 0 ? line.gstRate / 2 : 0,
        cgst: line.cgst,
        igstPct: line.igst > 0 ? line.gstRate : 0,
        igst: line.igst,
        total,
        unit: line.unit,
        supplierDate: pur.billDate || pur.date,
      });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.voucherNumber.localeCompare(b.voucherNumber));
}

export function salesDatewise(invoices: Invoice[], range: DateRange) {
  return invoices
    .filter((i) => i.status !== "draft" && i.status !== "cancelled" && inRange(i.date, range))
    .sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number))
    .map((inv) => {
      const t = invoiceTotals(inv);
      return {
        number: inv.number,
        date: inv.date,
        party: inv.party.name,
        gstin: partyGstin(inv.party.gstin),
        city: inv.party.city,
        state: stateName(inv.placeOfSupply),
        qty: t.qty,
        taxable: t.taxable,
        cgst: t.cgst,
        sgst: t.sgst,
        igst: t.igst,
        total: t.grand,
      };
    });
}

export type StockRow = {
  productId: string;
  name: string;
  hsn: string;
  pack: string;
  batch: string;
  expiry: string;
  purchaseQty: number;
  freeIn: number;
  salesQty: number;
  freeOut: number;
  returned: number;
  openingQty: number;
  adjusted: number;
  closing: number;
  pts: number;
  mrp: number;
  value: number;
  costIn: number;
  unitsIn: number;
  unitCost: number;
  costValue: number;
};

export function stockRegister(
  products: Product[],
  purchases: Purchase[],
  invoices: Invoice[],
  creditNotes: CreditNote[],
  asOf?: string,
  exceptInvoiceId?: string,
  adjustments: StockAdjustment[] = [],
): StockRow[] {
  const map = new Map<string, StockRow>();
  for (const p of products) {
    map.set(p.id, {
      productId: p.id,
      name: p.name,
      hsn: p.hsn,
      pack: p.pack,
      batch: p.batch,
      expiry: p.expiry,
      purchaseQty: 0,
      freeIn: 0,
      salesQty: 0,
      freeOut: 0,
      returned: 0,
      openingQty: 0,
      adjusted: 0,
      closing: 0,
      pts: p.pts,
      mrp: p.mrp,
      value: 0,
      costIn: 0,
      unitsIn: 0,
      unitCost: p.pts,
      costValue: 0,
    });
  }

  function row(id: string, name: string, hsn: string): StockRow {
    const existing = map.get(id);
    if (existing) return existing;
    const created: StockRow = {
      productId: id || name,
      name,
      hsn,
      pack: "",
      batch: "",
      expiry: "",
      purchaseQty: 0,
      freeIn: 0,
      salesQty: 0,
      freeOut: 0,
      returned: 0,
      openingQty: 0,
      adjusted: 0,
      closing: 0,
      pts: 0,
      mrp: 0,
      value: 0,
      costIn: 0,
      unitsIn: 0,
      unitCost: 0,
      costValue: 0,
    };
    map.set(created.productId, created);
    return created;
  }

  for (const p of products) {
    const qty = p.openingQty || 0;
    if (qty <= 0) continue;
    if (asOf && p.openingDate && p.openingDate > asOf) continue;
    const r = map.get(p.id);
    if (!r) continue;
    r.openingQty += qty;
    r.costIn += qty * (p.pts || 0);
    r.unitsIn += qty;
  }

  for (const pur of purchases) {
    if (pur.status !== "posted") continue;
    if (asOf && pur.date > asOf) continue;
    for (const line of pur.lines) {
      if (isInsuranceLine(line)) continue;
      const r = row(line.productId || line.name, line.name, line.hsn);
      r.purchaseQty += line.qty;
      r.freeIn += line.freeQty;
      r.costIn += line.taxable;
      r.unitsIn += line.qty + line.freeQty;
      if (line.batch) r.batch = line.batch;
      if (line.expiry) r.expiry = line.expiry;
    }
  }
  for (const inv of invoices) {
    if (inv.status === "draft" || inv.status === "cancelled") continue;
    if (exceptInvoiceId && inv.id === exceptInvoiceId) continue;
    if (asOf && inv.date > asOf) continue;
    for (const line of inv.lines) {
      const r = row(line.productId || line.name, line.name, line.hsn);
      r.salesQty += line.qty;
      r.freeOut += line.freeQty;
    }
  }
  for (const note of creditNotes) {
    if (note.status !== "issued") continue;
    if (asOf && note.date > asOf) continue;
    if (!restocksInventory(note)) continue;
    for (const line of note.lines) {
      const r = row(line.productId || line.name, line.name, line.hsn);
      r.returned += line.qty + line.freeQty;
    }
  }
  for (const adj of adjustments) {
    if (asOf && adj.date > asOf) continue;
    const r = row(adj.productId, adj.name, "");
    r.adjusted += adj.qty;
  }

  return [...map.values()]
    .map((r) => {
      r.closing = r.purchaseQty + r.freeIn + r.openingQty - r.salesQty - r.freeOut + r.returned - r.adjusted;
      r.unitCost = r.unitsIn > 0 ? round2(r.costIn / r.unitsIn) : r.pts;
      r.value = round2(Math.max(0, r.closing) * r.pts);
      r.costValue = round2(Math.max(0, r.closing) * r.unitCost);
      return r;
    })
    .filter((r) => r.purchaseQty || r.freeIn || r.openingQty || r.salesQty || r.returned || r.adjusted || r.closing)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function unitsOnHand(
  products: Product[],
  purchases: Purchase[],
  invoices: Invoice[],
  creditNotes: CreditNote[],
  productId: string,
  exceptInvoiceId?: string,
  adjustments: StockAdjustment[] = [],
): number {
  if (!productId) return 0;
  const row = stockRegister(products, purchases, invoices, creditNotes, undefined, exceptInvoiceId, adjustments).find(
    (r) => r.productId === productId,
  );
  return Math.max(0, row?.closing ?? 0);
}

export function rateBuckets(lines: RegisterLine[]): RateBucket[] {
  return GST_RATES.map((rate) => {
    const subset = lines.filter((l) => l.gstRate === rate);
    return {
      rate,
      taxable: round2(subset.reduce((s, l) => s + l.taxable, 0)),
      cgst: round2(subset.reduce((s, l) => s + l.cgst, 0)),
      sgst: round2(subset.reduce((s, l) => s + l.sgst, 0)),
      igst: round2(subset.reduce((s, l) => s + l.igst, 0)),
    };
  }).filter((b) => b.taxable || b.cgst || b.sgst || b.igst);
}

export function registerTotals(lines: RegisterLine[]) {
  return {
    qty: lines.reduce((s, l) => s + l.qty, 0),
    taxable: round2(lines.reduce((s, l) => s + l.taxable, 0)),
    cgst: round2(lines.reduce((s, l) => s + l.cgst, 0)),
    sgst: round2(lines.reduce((s, l) => s + l.sgst, 0)),
    igst: round2(lines.reduce((s, l) => s + l.igst, 0)),
    total: round2(lines.reduce((s, l) => s + l.total, 0)),
  };
}

export function companyHeader(company: CompanyProfile, title: string, range: DateRange): string[][] {
  return [
    [company.legalName],
    [`${company.addressLine1}${company.addressLine2 ? `, ${company.addressLine2}` : ""}`],
    [`${company.city}, ${stateName(company.stateCode)} ${company.pincode}`],
    [`GSTIN : ${company.gstin}`],
    [`${title} From : ${formatDateDMY(range.from)} To : ${formatDateDMY(range.to)}`],
    [],
  ];
}

export const SALES_HEADS = [
  "Voucher Number",
  "Voucher Date",
  "Voucher Type",
  "Customer Name",
  "City",
  "State",
  "GSTIN",
  "Product Name",
  "Product Code",
  "GST Rate",
  "QTY",
  "Rate",
  "Sales",
  "Amount",
  "SGST %",
  "SGST Amt",
  "CGST %",
  "CGST Amt",
  "IGST %",
  "IGST Amt",
  "Total Amount",
  "Unit",
] as const;

export const PURCHASE_HEADS = [
  "Bill Number",
  "Invoice Number",
  "Voucher Date",
  "Voucher Type",
  "Supplier Name",
  "City",
  "State",
  "GSTIN",
  "Product Name",
  "Product Code",
  "GST Rate",
  "QTY",
  "Rate",
  "Purchase Ledger",
  "Amount",
  "SGST Ledger",
  "SGST Amt",
  "CGST Ledger",
  "CGST Amt",
  "IGST Ledger",
  "IGST Amt",
  "Total Amount",
  "Unit",
  "Supp Date",
] as const;

export function salesCells(line: RegisterLine): (string | number)[] {
  return [
    line.voucherNumber,
    formatDateDMY(line.date),
    line.voucherType,
    line.partyName,
    line.city,
    line.state,
    line.gstin,
    line.productName,
    line.hsn,
    line.gstRate,
    line.qty,
    line.rate,
    line.ledger,
    line.taxable,
    line.sgstPct,
    line.sgst,
    line.cgstPct,
    line.cgst,
    line.igstPct,
    line.igst,
    line.total,
    line.unit,
  ];
}

export function purchaseCells(line: RegisterLine): (string | number)[] {
  return [
    line.voucherNumber,
    line.invoiceNumber,
    formatDateDMY(line.date),
    line.voucherType,
    line.partyName,
    line.city,
    line.state,
    line.gstin,
    line.productName,
    line.hsn,
    line.gstRate,
    line.qty,
    line.rate,
    line.ledger,
    line.taxable,
    "SGST",
    line.sgst,
    "CGST",
    line.cgst,
    "IGST",
    line.igst,
    line.total,
    line.unit,
    formatDateDMY(line.supplierDate),
  ];
}

export function rateMatrixRows(buckets: RateBucket[]): (string | number)[][] {
  if (!buckets.length) return [];
  const heads = ["", ...buckets.map((b) => b.rate)];
  return [
    [],
    heads,
    ["Taxable", ...buckets.map((b) => b.taxable)],
    ["CGST", ...buckets.map((b) => b.cgst)],
    ["SGST", ...buckets.map((b) => b.sgst)],
    ["IGST", ...buckets.map((b) => b.igst)],
  ];
}
