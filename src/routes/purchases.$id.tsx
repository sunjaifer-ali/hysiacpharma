import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DeleteVoucherButton } from "@/components/delete-voucher";
import { PurchasePreview } from "@/components/purchase-preview";
import { SettleDialog } from "@/components/settle-dialog";
import { StatusBadge, purchaseBadgeStatus } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";
import { printPage } from "@/lib/print-page";
import { invoiceTotals, round2 } from "@/lib/gst";
import { useBillingStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/purchases/$id")({ component: PurchaseDetailPage });

function PurchaseDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const purchase = useBillingStore((s) => s.purchases.find((i) => i.id === id));
  const setStatus = useBillingStore((s) => s.setPurchaseStatus);
  const savePurchase = useBillingStore((s) => s.savePurchase);
  const deletePurchase = useBillingStore((s) => s.deletePurchase);
  const recordPurchasePayment = useBillingStore((s) => s.recordPurchasePayment);
  const [payOpen, setPayOpen] = useState(false);

  if (!purchase) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Purchase not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/purchases">Back to purchases</Link>
        </Button>
      </AppShell>
    );
  }

  const totals = invoiceTotals(purchase);
  const due = round2(Math.max(0, totals.grand - (purchase.paidAmount || 0)));

  return (
    <AppShell>
      <div className="no-print mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to="/purchases"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Purchases
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl">{purchase.number}</h1>
            <StatusBadge status={purchaseBadgeStatus(purchase.status, totals.grand, purchase.paidAmount)} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {purchase.supplier.name}
            {purchase.billNo ? ` · Bill ${purchase.billNo}` : ""} · {formatINR(totals.grand)}
            {purchase.status === "posted" ? ` · ${due > 0 ? `Due ${formatINR(due)}` : "Paid"}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => printPage("portrait")}>
            <Printer className="size-4" />
            Print
          </Button>
          {purchase.status === "draft" || purchase.status === "posted" ? (
            <>
              <Button asChild variant="outline">
                <Link to="/purchases/$id/edit" params={{ id: purchase.id }}>
                  {purchase.status === "posted" ? "Edit" : "Edit draft"}
                </Link>
              </Button>
              {purchase.status === "draft" ? (
                <Button
                  onClick={() => {
                    try {
                      const saved = savePurchase(purchase, "posted");
                      toast.success(`Posted ${saved.number}`);
                      void navigate({ to: "/purchases/$id", params: { id: saved.id } });
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not post");
                    }
                  }}
                >
                  Post voucher
                </Button>
              ) : null}
            </>
          ) : null}
          {purchase.status === "posted" && due > 0 ? (
            <Button variant="secondary" onClick={() => setPayOpen(true)}>
              Pay supplier
            </Button>
          ) : null}
          {purchase.status === "posted" ? (
            <Button
              variant="outline"
              onClick={() => {
                setStatus(purchase.id, "cancelled");
                toast.success("Purchase cancelled");
              }}
            >
              Cancel
            </Button>
          ) : null}
          <DeleteVoucherButton
            title={`Delete ${purchase.number}?`}
            description="Moves this purchase to the recycle bin. Stock from it is hidden until you restore it."
            onConfirm={() => {
              deletePurchase(purchase.id);
              toast.success("Moved to the recycle bin");
              void navigate({ to: "/purchases" });
            }}
          />
        </div>
      </div>
      <PurchasePreview purchase={purchase} />
      <SettleDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        title="Pay supplier"
        due={due}
        onSave={(input) => {
          const saved = recordPurchasePayment(purchase.id, input.amount, input);
          if (!saved) {
            toast.error("Nothing was paid. Check the amount still due.");
            return;
          }
          toast.success("Payment saved");
          void navigate({ to: "/payments/$id", params: { id: saved.id } });
        }}
      />
    </AppShell>
  );
}
