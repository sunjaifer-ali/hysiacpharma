import { invoiceTotals, round2 } from "@/lib/gst";
import type { CreditNote, Invoice, LedgerPayment, OpeningDue, Purchase } from "@/lib/types";

export type LedgerSide = "customer" | "supplier";

export type LedgerEntry = {
  date: string;
  number: string;
  particular: string;
  debit: number;
  credit: number;
};

export type LedgerLine = LedgerEntry & { balance: number };

export type PartyLedger = {
  opening: number;
  lines: LedgerLine[];
  debit: number;
  credit: number;
  closing: number;
};

function linked(payments: LedgerPayment[], voucherId: string, kind: LedgerPayment["kind"]): number {
  return round2(payments.filter((payment) => payment.voucherId === voucherId && payment.kind === kind).reduce((sum, payment) => sum + payment.amount, 0));
}

function before(date: string, from: string): boolean {
  return date < from;
}

export function partyLedger(input: {
  side: LedgerSide;
  partyId: string;
  from: string;
  to: string;
  invoices: Invoice[];
  purchases: Purchase[];
  creditNotes: CreditNote[];
  payments: LedgerPayment[];
  openingDues: OpeningDue[];
}): PartyLedger {
  const rows: LedgerEntry[] = [];
  const customer = input.side === "customer";

  for (const due of input.openingDues) {
    if (due.kind !== input.side || due.partyId !== input.partyId) continue;
    rows.push({
      date: due.date,
      number: "Opening",
      particular: "Opening balance",
      debit: customer ? round2(due.amount) : 0,
      credit: customer ? 0 : round2(due.amount),
    });
    const gap = round2((due.paidAmount || 0) - linked(input.payments, due.id, customer ? "receipt" : "payment"));
    if (gap > 0.009) {
      rows.push({
        date: due.date,
        number: "",
        particular: customer ? "Received on opening" : "Paid on opening",
        debit: customer ? 0 : gap,
        credit: customer ? gap : 0,
      });
    }
  }

  if (customer) {
    for (const invoice of input.invoices) {
      if (invoice.partyId !== input.partyId || invoice.status === "draft" || invoice.status === "cancelled") continue;
      const grand = invoiceTotals(invoice).grand;
      rows.push({ date: invoice.date, number: invoice.number, particular: "Sales bill", debit: grand, credit: 0 });
      const gap = round2(invoice.paidAmount - linked(input.payments, invoice.id, "receipt"));
      if (gap > 0.009) {
        rows.push({ date: invoice.date, number: invoice.number, particular: "Received with bill", debit: 0, credit: gap });
      }
    }
    for (const note of input.creditNotes) {
      if (note.partyId !== input.partyId || note.status !== "issued") continue;
      rows.push({
        date: note.date,
        number: note.number,
        particular: note.kind === "sales_return" ? `Return against ${note.invoiceNumber}` : `Credit note against ${note.invoiceNumber}`,
        debit: 0,
        credit: invoiceTotals(note).grand,
      });
    }
    for (const payment of input.payments) {
      if (payment.kind !== "receipt" || payment.partyId !== input.partyId) continue;
      rows.push({
        date: payment.date,
        number: payment.number || "",
        particular: `Receipt ${payment.voucherNumber}${payment.reference ? ` · ${payment.reference}` : ""}`,
        debit: 0,
        credit: round2(payment.amount),
      });
    }
  } else {
    for (const purchase of input.purchases) {
      if (purchase.supplierId !== input.partyId || purchase.status !== "posted") continue;
      const grand = invoiceTotals(purchase).grand;
      rows.push({
        date: purchase.date,
        number: purchase.billNo || purchase.number,
        particular: "Purchase bill",
        debit: 0,
        credit: grand,
      });
      const gap = round2((purchase.paidAmount || 0) - linked(input.payments, purchase.id, "payment"));
      if (gap > 0.009) {
        rows.push({ date: purchase.date, number: purchase.billNo || purchase.number, particular: "Paid with bill", debit: gap, credit: 0 });
      }
    }
    for (const payment of input.payments) {
      if (payment.kind !== "payment" || payment.partyId !== input.partyId) continue;
      rows.push({
        date: payment.date,
        number: payment.number || "",
        particular: `Payment ${payment.voucherNumber}${payment.reference ? ` · ${payment.reference}` : ""}`,
        debit: round2(payment.amount),
        credit: 0,
      });
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || b.debit - a.debit || a.number.localeCompare(b.number));

  const net = (entry: LedgerEntry) => (customer ? entry.debit - entry.credit : entry.credit - entry.debit);
  const opening = round2(rows.filter((entry) => before(entry.date, input.from)).reduce((sum, entry) => sum + net(entry), 0));
  let balance = opening;
  const lines: LedgerLine[] = [];
  let debit = 0;
  let credit = 0;
  for (const entry of rows) {
    if (entry.date < input.from || entry.date > input.to) continue;
    balance = round2(balance + net(entry));
    debit = round2(debit + entry.debit);
    credit = round2(credit + entry.credit);
    lines.push({ ...entry, balance });
  }
  return { opening, lines, debit, credit, closing: balance };
}
