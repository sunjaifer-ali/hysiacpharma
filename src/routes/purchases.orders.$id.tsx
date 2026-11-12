import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DeleteVoucherButton } from "@/components/delete-voucher";
import { PurchaseOrderSheet } from "@/components/purchase-order-sheet";
import { SettleDialog } from "@/components/settle-dialog";
import { Button } from "@/components/ui/button";
import { formatDateDMY, formatINR } from "@/lib/format";
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
  const recordAdvance = useBillingStore((s) => s.recordOrderAdvance);
  const advances = useBillingStore((s) => s.payments.filter((payment) => payment.kind === "payment" && payment.voucherId === id));
  const [payOpen, setPayOpen] = useState(false);

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
            {(order.advancePaid || 0) > 0 ? ` · Advance ${formatINR(order.advancePaid || 0)}` : ""}
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
          {order.status !== "cancelled" ? (
            <Button variant="outline" onClick={() => setPayOpen(true)}>
              Pay advance
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
            <DeleteVoucherButton
              label="Cancel"
              buttonVariant="outline"
              allowBilling
              title={`Cancel ${order.number}?`}
              description="A cancelled purchase order stays in the list and is not sent. You can undo the cancel later."
              confirmLabel="Cancel order"
              onConfirm={() => {
                setStatus(order.id, "cancelled");
                toast.success("Order cancelled");
              }}
            />
          ) : null}
          {order.status === "cancelled" ? (
            <DeleteVoucherButton
              label="Undo cancel"
              buttonVariant="outline"
              allowBilling
              title={`Put ${order.number} back?`}
              description="The purchase order becomes active again. The button stays locked for 10 seconds."
              confirmLabel="Undo cancel"
              onConfirm={() => {
                const prior = order.statusBeforeCancel;
                setStatus(order.id, prior && prior !== "cancelled" ? prior : "draft");
                toast.success("Order is active again");
              }}
            />
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
      {advances.length > 0 ? (
        <section className="no-print mt-4 rounded-2xl border border-border p-4">
          <h2 className="font-medium">Advance paid</h2>
          <ul className="mt-2 divide-y divide-border text-sm">
            {advances.map((payment) => (
              <li key={payment.id} className="flex justify-between gap-3 py-2">
                <span>
                  {payment.number || "Payment"} · {formatDateDMY(payment.date)} · {payment.mode}
                  {payment.reference ? ` · ${payment.reference}` : ""}
                </span>
                <span className="tabular-nums">{formatINR(payment.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <SettleDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        title={`Advance for ${order.number}`}
        due={0}
        note="Advance paid to the supplier before the goods arrive."
        onSave={(input) => {
          const saved = recordAdvance(order.id, input.amount, input);
          if (!saved) {
            toast.error("Could not save the advance");
            return;
          }
          toast.success(`Advance ${formatINR(input.amount)} saved`);
        }}
      />
    </AppShell>
  );
}
