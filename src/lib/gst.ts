import type { GstRate, InvoiceLine } from "./types";


export const INDIAN_STATES: { code: string; name: string }[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
];

export const GST_RATES: GstRate[] = [0, 5, 12, 18, 28];

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function stateName(code: string): string {
  return INDIAN_STATES.find((s) => s.code === code)?.name ?? code;
}

export function panFromGstin(gstin: string): string {
  const g = gstin.replace(/\s/g, "").toUpperCase();
  return g.length >= 12 ? g.slice(2, 12) : "";
}

export function stateFromGstin(gstin: string): string {
  const g = gstin.replace(/\s/g, "").toUpperCase();
  return g.slice(0, 2);
}

export function gstinChecksum(body14: string): string {
  const raw = body14.toUpperCase();
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const code = GSTIN_CHARS.indexOf(raw[i] ?? "");
    if (code < 0) return "";
    const factor = i % 2 === 0 ? 1 : 2;
    const product = code * factor;
    hash += Math.floor(product / 36) + (product % 36);
  }
  const check = (36 - (hash % 36)) % 36;
  return GSTIN_CHARS[check] ?? "";
}

export function makeGstin(stateCode: string, pan: string, entity = "1"): string {
  const body = `${stateCode}${pan.toUpperCase()}${entity}Z`;
  return body + gstinChecksum(body);
}

const GSTIN_SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function isValidGstin(gstin: string): boolean {
  const g = gstin.replace(/\s/g, "").toUpperCase();
  if (!GSTIN_SHAPE.test(g)) return false;
  return gstinChecksum(g.slice(0, 14)) === g[14];
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calcLine(input: {
  qty: number;
  rate: number;
  discount: number;
  gstRate: number;
  intraState: boolean;
}): Pick<InvoiceLine, "taxable" | "cgst" | "sgst" | "igst"> {
  const qty = Math.max(0, input.qty);
  const rate = Math.max(0, input.rate);
  const discount = Math.max(0, input.discount);
  const taxable = round2(Math.max(0, qty * rate - discount));
  if (input.intraState) {
    const half = round2(taxable * (input.gstRate / 200));
    return { taxable, cgst: half, sgst: half, igst: 0 };
  }
  return { taxable, cgst: 0, sgst: 0, igst: round2(taxable * (input.gstRate / 100)) };
}

export type InvoiceTotals = {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  roundOff: number;
  grand: number;
  qty: number;
  freeQty: number;
  shipped: number;
  subtotal: number;
  charges: number;
  creditApplied: number;
};

export function invoiceTotals(invoice: {
  lines: { taxable: number; cgst: number; sgst: number; igst: number; qty?: number; freeQty?: number }[];
  roundOff: number;
  transportCharges?: number;
  otherCharges?: number;
  creditApplied?: number;
}): InvoiceTotals {
  const taxable = round2(invoice.lines.reduce((s, l) => s + l.taxable, 0));
  const cgst = round2(invoice.lines.reduce((s, l) => s + l.cgst, 0));
  const sgst = round2(invoice.lines.reduce((s, l) => s + l.sgst, 0));
  const igst = round2(invoice.lines.reduce((s, l) => s + l.igst, 0));
  const tax = round2(cgst + sgst + igst);
  const roundOff = round2(invoice.roundOff);
  const charges = round2((invoice.transportCharges ?? 0) + (invoice.otherCharges ?? 0));
  const creditApplied = round2(invoice.creditApplied ?? 0);
  const subtotal = round2(taxable + tax);
  const grand = round2(subtotal + charges - creditApplied + roundOff);
  const qty = invoice.lines.reduce((s, l) => s + (l.qty ?? 0), 0);
  const freeQty = invoice.lines.reduce((s, l) => s + (l.freeQty ?? 0), 0);
  return {
    taxable,
    cgst,
    sgst,
    igst,
    tax,
    roundOff,
    grand,
    qty,
    freeQty,
    shipped: qty + freeQty,
    subtotal,
    charges,
    creditApplied,
  };
}

export function isIntraState(sellerState: string, placeOfSupply: string): boolean {
  return sellerState === placeOfSupply;
}

export function gstModeCaption(sellerState: string, placeOfSupply: string): string {
  if (!sellerState || !placeOfSupply) return "Select parties to see CGST/SGST or IGST.";
  if (isIntraState(sellerState, placeOfSupply)) {
    return `CGST + SGST — intra-state (${stateName(sellerState)})`;
  }
  return `IGST — ${stateName(sellerState)} → ${stateName(placeOfSupply)}`;
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function chunkToWords(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n] ?? "";
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)] ?? "";
    const o = ONES[n % 10] ?? "";
    return o ? `${t} ${o}` : t;
  }
  const h = ONES[Math.floor(n / 100)] ?? "";
  const rest = chunkToWords(n % 100);
  return rest ? `${h} Hundred ${rest}` : `${h} Hundred`;
}

function rupeesToWords(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 1_00_00_000);
  const lakh = Math.floor((n % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((n % 1_00_000) / 1000);
  const hundred = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${chunkToWords(crore)} Crore`);
  if (lakh) parts.push(`${chunkToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${chunkToWords(thousand)} Thousand`);
  if (hundred) parts.push(chunkToWords(hundred));
  return parts.join(" ");
}

export function inrInWords(amount: number): string {
  const abs = Math.abs(round2(amount));
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);
  const sign = amount < 0 ? "Minus " : "";
  let out = `${sign}${rupeesToWords(rupees)} Rupees`;
  if (paise) out += ` and ${rupeesToWords(paise)} Paise`;
  return `${out} Only`;
}

export function currentFinancialYear(date = new Date()): { start: number; end: number; label: string; short: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = month >= 3 ? year : year - 1;
  const end = start + 1;
  return {
    start,
    end,
    label: `${start}–${end}`,
    short: `${String(start).slice(-2)}${String(end).slice(-2)}`,
  };
}

type DateRange = { from: string; to: string };

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthSpan(year: number, monthIndex: number): DateRange {
  const from = new Date(year, monthIndex, 1);
  const to = new Date(year, monthIndex + 1, 0);
  return { from: isoDate(from), to: isoDate(to) };
}

export function lastMonthRange(date = new Date()): DateRange {
  return monthSpan(date.getFullYear(), date.getMonth() - 1);
}

export function currentMonthRange(date = new Date()): DateRange {
  return monthSpan(date.getFullYear(), date.getMonth());
}

/** GST quarters: Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar. */
export function currentQuarterRange(date = new Date()): DateRange {
  const startMonth = Math.floor(date.getMonth() / 3) * 3;
  const from = new Date(date.getFullYear(), startMonth, 1);
  const to = new Date(date.getFullYear(), startMonth + 3, 0);
  return { from: isoDate(from), to: isoDate(to) };
}

export function financialYearRange(date = new Date()): DateRange {
  const fy = currentFinancialYear(date);
  return { from: `${fy.start}-04-01`, to: `${fy.end}-03-31` };
}

export function fyOf(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return currentFinancialYear(d).label;
}

export function formatInvoiceNumber(prefix: string, n: number): string {
  return `${prefix}${String(n).padStart(4, "0")}`;
}

export function taxHeadsForRate(
  lines: { gstRate: number; taxable: number; cgst: number; sgst: number; igst: number }[],
  rate: number,
) {
  const subset = lines.filter((l) => l.gstRate === rate);

  const taxable = round2(subset.reduce((s, l) => s + l.taxable, 0));
  const cgst = round2(subset.reduce((s, l) => s + l.cgst, 0));
  const sgst = round2(subset.reduce((s, l) => s + l.sgst, 0));
  const igst = round2(subset.reduce((s, l) => s + l.igst, 0));
  return { rate, taxable, cgst, sgst, igst };
}
