import { BillSheet, invoiceToSheet } from "@/components/bill-sheet";
import { creditedAgainst } from "@/lib/returns";
import { useBillingStore } from "@/lib/store";
import type { BillCopy, Invoice } from "@/lib/types";
import { cn } from "@/lib/utils";

export function InvoicePreview({
  invoice,
  copy = "Original",
  className,
}: {
  invoice: Invoice;
  copy?: BillCopy;
  className?: string;
}) {
  const notes = useBillingStore((s) => s.creditNotes);
  const credited = invoice.id && invoice.id !== "preview" ? creditedAgainst(notes, invoice.id) : 0;
  return (
    <BillSheet
      className={cn(className)}
      doc={invoiceToSheet(invoice, copy, credited)}
    />
  );
}
