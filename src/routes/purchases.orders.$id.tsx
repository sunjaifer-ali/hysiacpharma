import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DeleteVoucherButton } from "@/components/delete-voucher";
import { PurchaseOrderSheet } from "@/components/purchase-order-sheet";
import { Button } from "@/components/ui/button";
import { printPage } from "@/lib/print-page";
import { useBillingStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/purchases/orders/$id")({ component: PurchaseOrderPage });

const LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  closed: "Closed",
  cancelled: "Cancelled",
};

function PurchaseOrderPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const order = useBillingStore((s) => s.purchaseOrders.find((item) => item.id === id));
  const saveOrder = useBillingStore((s) => s.savePurchaseOrder);
  const setStatus = useBillingStore((s) => s.setPurchaseOrderStatus);
  const deleteOrder = useBillingStore((s) => s.deletePurchaseOrder);

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
      <div className="no-print mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/purchases/orders" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Purchase orders
          </Link>
          <h1 className="font-display text-3xl">{order.number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.supplier.name} · {LABEL[order.status] ?? order.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => printPage("portrait")}>
            <Printer className="size-4" />
            Print
          </Button>
          {order.status !== "cancelled" ? (
            <Button asChild variant="outline">
              <Link to="/purchases/orders/$id/edit" params={{ id: order.id }}>
                Edit
              </Link>
            </Button>
          ) : null}
          {order.status === "draft" ? (
            <Button
              onClick={() => {
                try {
                  const saved = saveOrder(order, "sent");
                  toast.success(`Sent ${saved.number}`);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not send");
                }
              }}
            >
              Mark sent
            </Button>
          ) : null}
          {order.status === "sent" ? (
            <Button
              variant="outline"
              onClick={() => {
                setStatus(order.id, "closed");
                toast.success("Order closed");
              }}
            >
              Mark received
            </Button>
          ) : null}
          {order.status !== "cancelled" ? (
            <Button
              variant="outline"
              onClick={() => {
                setStatus(order.id, "cancelled");
                toast.success("Order cancelled");
              }}
            >
              Cancel
            </Button>
          ) : null}
          <DeleteVoucherButton
            title="Delete purchase order"
            description="Moves this purchase order to the recycle bin. Stock and purchase bills stay as they are."
            onConfirm={() => {
              deleteOrder(order.id);
              toast.success("Moved to the recycle bin");
              void navigate({ to: "/purchases/orders" });
            }}
          />
        </div>
      </div>
      <PurchaseOrderSheet order={order} />
    </AppShell>
  );
}
