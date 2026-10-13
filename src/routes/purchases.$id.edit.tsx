import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PurchaseEditor } from "@/components/purchase-editor";
import { Button } from "@/components/ui/button";
import { useBillingStore } from "@/lib/store";

export const Route = createFileRoute("/purchases/$id/edit")({ component: EditPurchasePage });

function EditPurchasePage() {
  const { id } = Route.useParams();
  const purchase = useBillingStore((s) => s.purchases.find((i) => i.id === id));

  if (!purchase) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Purchase not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/purchases">Back</Link>
        </Button>
      </AppShell>
    );
  }

  if (purchase.status === "cancelled") {
    return (
      <AppShell>
        <p className="text-muted-foreground">This purchase is cancelled and cannot be edited.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/purchases/$id" params={{ id: purchase.id }}>
            Back
          </Link>
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="font-display text-3xl">Edit {purchase.number}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {purchase.status === "posted"
            ? "Saving a posted voucher updates stock from these lines. A different batch or MRP opens a new lot."
            : "Posting assigns the next purchase number and writes batch lots onto stock."}
        </p>
      </div>
      <PurchaseEditor existing={purchase} />
    </AppShell>
  );
}
