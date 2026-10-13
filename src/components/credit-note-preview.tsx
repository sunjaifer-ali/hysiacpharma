import { BillSheet, creditNoteToSheet } from "@/components/bill-sheet";
import { CreditNoteSheet } from "@/components/credit-note-sheet";
import type { BillCopy, CreditNote } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CreditNotePreview({
  note,
  copy = "Original",
  className,
}: {
  note: CreditNote;
  copy?: BillCopy;
  className?: string;
}) {
  if (note.kind === "sales_return") {
    return <BillSheet className={cn(className)} doc={creditNoteToSheet(note, copy)} />;
  }
  return <CreditNoteSheet className={className} note={note} copy={copy} />;
}
