import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PurchaseOrderEditor } from "@/components/purchase-order-editor";
import { Button } from "@/components/ui/button";
import { useBillingStore } from "@/lib/store";

export const Route = createFileRoute("/purchases/orders/$id/edit")({
  validateSearch: (search: Record<string, unknown>) => ({
    low: search.low === true || search.low === "1" || search.low === "true",
  }),
  component: EditPurchaseOrderPage,
});

function EditPurchaseOrderPage() {
  const { id } = Route.useParams();
  const { low } = Route.useSearch();
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
      </div>
      <PurchaseOrderEditor existing={order} prefillLow={low} />
    </AppShell>
  );
}
