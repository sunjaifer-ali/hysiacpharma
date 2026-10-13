import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PurchaseEditor } from "@/components/purchase-editor";

export const Route = createFileRoute("/purchases/new")({
  component: NewPurchasePage,
});

function NewPurchasePage() {
  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="font-display text-3xl">New purchase</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Capture the supplier bill as printed. If MRP, batch, PTS or PTR differs from stock already on hand, a new
          lot is opened — old stock is not mixed or overwritten.
        </p>
      </div>
      <PurchaseEditor />
    </AppShell>
  );
}
