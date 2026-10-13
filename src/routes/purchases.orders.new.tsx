import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PurchaseOrderEditor } from "@/components/purchase-order-editor";

export const Route = createFileRoute("/purchases/orders/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    low: search.low === true || search.low === "1" || search.low === "true",
  }),
  component: NewPurchaseOrderPage,
});

function NewPurchaseOrderPage() {
  const { low } = Route.useSearch();
  return (
    <AppShell>
      <div className="mb-5">
        <Link to="/purchases/orders" className="text-sm text-muted-foreground hover:text-foreground">
          Purchase orders
        </Link>
        <h1 className="font-display text-3xl">New purchase order</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {low
            ? "Quantities below are enough to bring each item back above the low-stock limit. Change them before sending."
            : "List what you need from the supplier, then print or share the order."}
        </p>
      </div>
      <PurchaseOrderEditor prefillLow={low} />
    </AppShell>
  );
}
