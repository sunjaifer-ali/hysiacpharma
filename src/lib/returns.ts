import { invoiceTotals, round2 } from "./gst";
import type { CreditNote, CreditNoteKind, CreditNoteReason, Invoice } from "./types";

export const RETURN_REASONS: { value: CreditNoteReason; label: string }[] = [
  { value: "sales_return", label: "Goods returned" },
  { value: "expired", label: "Expired stock" },
  { value: "damaged", label: "Damaged / broken" },
  { value: "shortage", label: "Shortage" },
];

export const CREDIT_REASONS: { value: CreditNoteReason; label: string }[] = [
  { value: "rate_difference", label: "Rate difference" },
  { value: "scheme", label: "Scheme / extra discount" },
  { value: "other", label: "Other / as per narration" },
];

export const CREDIT_NOTE_REASONS: { value: CreditNoteReason; label: string }[] = [
  ...RETURN_REASONS,
  ...CREDIT_REASONS,
];

export function reasonLabel(reason: CreditNoteReason): string {
  return CREDIT_NOTE_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

export function kindLabel(kind: CreditNoteKind): string {
  return kind === "sales_return" ? "Return bill" : "Credit note";
}

export function issuedNotes(notes: CreditNote[], invoiceId?: string): CreditNote[] {
  return notes.filter((n) => n.status === "issued" && (!invoiceId || n.invoiceId === invoiceId));
}

export function issuedReturns(notes: CreditNote[], invoiceId?: string): CreditNote[] {
  return issuedNotes(notes, invoiceId).filter((n) => n.kind === "sales_return");
}

export function creditedAgainst(notes: CreditNote[], invoiceId: string): number {
  return round2(issuedNotes(notes, invoiceId).reduce((s, n) => s + invoiceTotals(n).grand, 0));
}

export function returnedQty(
  notes: CreditNote[],
  invoiceId: string,
  invoiceLineId: string,
  exceptNoteId?: string,
): { qty: number; freeQty: number } {
  return issuedReturns(notes, invoiceId)
    .filter((n) => n.id !== exceptNoteId)
    .reduce(
      (acc, n) => {
        for (const l of n.lines) {
          if (l.invoiceLineId === invoiceLineId) {
            acc.qty += l.qty;
            acc.freeQty += l.freeQty;
          }
        }
        return acc;
      },
      { qty: 0, freeQty: 0 },
    );
}

export function restocksInventory(note: { kind?: CreditNoteKind; reason: CreditNoteReason }): boolean {
  if (note.kind && note.kind !== "sales_return") return false;
  return note.reason !== "expired" && note.reason !== "damaged";
}

export function remainingReturnable(
  invoice: Invoice,
  notes: CreditNote[],
  invoiceLineId: string,
  exceptNoteId?: string,
) {
  const line = invoice.lines.find((l) => l.id === invoiceLineId);
  const used = returnedQty(notes, invoice.id, invoiceLineId, exceptNoteId);
  return {
    qty: Math.max(0, (line?.qty ?? 0) - used.qty),
    freeQty: Math.max(0, (line?.freeQty ?? 0) - used.freeQty),
  };
}

export function invoiceNetDue(invoice: Invoice, notes: CreditNote[]): number {
  const t = invoiceTotals(invoice);
  return round2(Math.max(0, t.grand - invoice.paidAmount - creditedAgainst(notes, invoice.id)));
}