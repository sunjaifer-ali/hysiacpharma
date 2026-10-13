import { Badge } from "@/components/ui/badge";
import type { CreditNoteStatus, InvoiceStatus, PurchaseStatus } from "@/lib/types";

type AnyStatus = InvoiceStatus | PurchaseStatus | CreditNoteStatus;

export function StatusBadge({
  status,
  as = "invoice",
}: {
  status: AnyStatus;
  as?: "invoice" | "note" | "purchase";
}) {
  if (as === "note") {
    const map: Record<CreditNoteStatus, { label: string; variant: "paid" | "issued" | "draft" | "cancelled" }> = {
      issued: { label: "Issued", variant: "paid" },
      draft: { label: "Draft", variant: "draft" },
      cancelled: { label: "Cancelled", variant: "cancelled" },
    };
    const m = map[status as CreditNoteStatus] ?? map.draft;
    return <Badge variant={m.variant}>{m.label}</Badge>;
  }
  const map: Record<
    InvoiceStatus | PurchaseStatus,
    { label: string; variant: "paid" | "issued" | "draft" | "cancelled" | "partial" | "outline" }
  > = {
    paid: { label: "Paid", variant: "paid" },
    issued: { label: "Unpaid", variant: "issued" },
    partial: { label: "Partial", variant: "partial" },
    draft: { label: "Draft", variant: "draft" },
    cancelled: { label: "Cancelled", variant: "cancelled" },
    posted: { label: "Posted", variant: "outline" },
  };
  const m = map[status as InvoiceStatus | PurchaseStatus];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export function purchaseBadgeStatus(
  status: PurchaseStatus,
  grand: number,
  paid = 0,
): InvoiceStatus | PurchaseStatus {
  if (status !== "posted") return status;
  if (paid <= 0.009) return "posted";
  if (paid >= grand - 0.009) return "paid";
  return "partial";
}
