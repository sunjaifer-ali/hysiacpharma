import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PurchaseOrderEditor } from "@/components/purchase-order-editor";
import { Button } from "@/components/ui/button";
import { useBillingStore } from "@/lib/store";

export const Route = createFileRoute("/purchases/orders/$id/edit")({ component: EditPurchaseOrderPage });

function EditPurchaseOrderPage() {
  const { id } = Route.useParams();
  const order = useBillingStore((s) => s.purchaseOrders.find((item) => item.id === id));
  if (!order) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Purchase order not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/purchases/orders">Back</Link>
        </Button>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="font-display text-3xl">Edit {order.number}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update the request. Stock is unchanged until a purchase bill is posted.</p>
      </div>
      <PurchaseOrderEditor existing={order} />
    </AppShell>
  );
}
