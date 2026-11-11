import type { BooksSnapshot } from "@/lib/backup";
import { invoiceTotals, round2 } from "@/lib/gst";
import { invoiceNetDue } from "@/lib/returns";
import { stockRegister } from "@/lib/registers";
import type { CompanyProfile, OpeningDue } from "@/lib/types";

const PREFIX_KEYS = [
  "invoicePrefix",
  "purchasePrefix",
  "purchaseOrderPrefix",
  "returnPrefix",
  "creditNotePrefix",
  "quotePrefix",
  "receiptPrefix",
  "paymentVoucherPrefix",
] as const;

export function inferYearId(company: { invoicePrefix?: string; financialYear?: string } | undefined): string {
  const saved = company?.financialYear ?? "";
  if (/^\d{4}-\d{2}$/.test(saved)) return saved;
  const match = (company?.invoicePrefix ?? "").match(/(\d{2})(\d{2})(?!.*\d)/);
  if (match) {
    const start = 2000 + Number(match[1]);
    if (Number(match[2]) === (start + 1) % 100) return `${start}-${match[2]}`;
  }
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

export function nextYearId(id: string): string {
  const start = Number(id.slice(0, 4)) + 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

/** The next year can be started only after 31 March of the open year. */
export function nextYearReady(id: string, today = new Date()): boolean {
  const endYear = Number(id.slice(0, 4)) + 1;
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return day > `${endYear}-03-31`;
}

export function yearShort(id: string): string {
  const [start, end] = id.split("-");
  return `${start.slice(-2)}${end}`;
}

export function yearLabel(id: string): string {
  const start = Number(id.slice(0, 4));
  return `${start}–${String(start + 1).slice(-2)}`;
}

export function yearRange(id: string): { from: string; to: string; start: number; end: number } {
  const start = Number(id.slice(0, 4));
  return { start, end: start + 1, from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

function rewritePrefix(prefix: string, from: string, to: string): string {
  if (!prefix) return prefix;
  if (prefix.includes(from)) return prefix.split(from).join(to);
  return prefix.replace(/(\d{2})(\d{2})(?!.*\d)/, to);
}

export function freshFinancialYear(books: BooksSnapshot, target: string): BooksSnapshot {
  const current = inferYearId(books.company);
  const fromShort = yearShort(current);
  const toShort = yearShort(target);
  const openingDate = `${target.slice(0, 4)}-04-01`;
  const company = { ...books.company, financialYear: target } as CompanyProfile;
  for (const key of PREFIX_KEYS) {
    const value = company[key];
    if (typeof value === "string") company[key] = rewritePrefix(value, fromShort, toShort) as never;
  }
  company.nextNumber = 1;
  company.nextPurchaseNumber = 1;
  company.nextPurchaseOrderNumber = 1;
  company.nextReturnNumber = 1;
  company.nextCreditNoteNumber = 1;
  company.nextQuoteNumber = 1;
  company.nextReceiptNumber = 1;
  company.nextPaymentVoucherNumber = 1;

  const dues: OpeningDue[] = [];
  for (const due of books.openingDues ?? []) {
    const left = round2(due.amount - (due.paidAmount || 0));
    if (left > 0.009) dues.push({ ...due, id: crypto.randomUUID(), date: openingDate, amount: left, paidAmount: 0 });
  }
  for (const invoice of books.invoices) {
    if (invoice.status === "draft" || invoice.status === "cancelled") continue;
    const left = invoiceNetDue(invoice, books.creditNotes);
    if (left > 0.009) {
      dues.push({
        id: crypto.randomUUID(),
        partyId: invoice.partyId,
        partyName: invoice.party?.name || "Customer",
        kind: "customer",
        date: openingDate,
        amount: left,
        paidAmount: 0,
      });
    }
  }
  for (const purchase of books.purchases) {
    if (purchase.status !== "posted") continue;
    const left = round2(Math.max(0, invoiceTotals(purchase).grand - (purchase.paidAmount || 0)));
    if (left > 0.009) {
      dues.push({
        id: crypto.randomUUID(),
        partyId: purchase.supplierId,
        partyName: purchase.supplier?.name || "Supplier",
        kind: "supplier",
        date: openingDate,
        amount: left,
        paidAmount: 0,
      });
    }
  }

  const closing = new Map(
    stockRegister(books.products, books.purchases, books.invoices, books.creditNotes, undefined, undefined, books.adjustments ?? []).map((row) => [
      row.productId,
      row.closing,
    ]),
  );
  const products = books.products.map((product) => ({
    ...product,
    openingQty: round2(Math.max(0, closing.get(product.id) ?? product.openingQty ?? 0)),
    openingDate,
  }));

  return {
    company,
    products,
    parties: books.parties,
    invoices: [],
    purchases: [],
    purchaseOrders: [],
    quotes: [],
    creditNotes: [],
    payments: [],
    adjustments: [],
    openingDues: dues,
    bin: [],
  };
}
