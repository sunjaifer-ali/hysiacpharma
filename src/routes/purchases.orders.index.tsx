import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { DeleteVoucherButton } from "@/components/delete-voucher";
import { LowStockBanner } from "@/components/low-stock-banner";
import { PeriodFilter, useVoucherPeriod } from "@/components/period-filter";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useBillingStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/purchases/orders/")({ component: PurchaseOrdersPage });

const LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  closed: "Closed",
  cancelled: "Cancelled",
};

function PurchaseOrdersPage() {
  const orders = useBillingStore((s) => s.purchaseOrders);
  const deleteOrder = useBillingStore((s) => s.deletePurchaseOrder);
  const navigate = useNavigate();
  const period = useVoucherPeriod();
  const rows = useMemo(
    () =>
      [...orders]
        .filter((order) => period.includes(order.date))
        .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)),
    [orders, period],
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Purchase orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} orders · {period.label}. An order does not change stock or GST until the purchase bill is posted.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/purchases">Purchase bills</Link>
          </Button>
          <Button asChild>
            <Link to="/purchases/orders/new" search={{ low: false }}>New purchase order</Link>
          </Button>
        </div>
      </div>
      <LowStockBanner />
      <PeriodFilter
        from={period.from}
        to={period.to}
        preset={period.preset}
        onFrom={period.setFrom}
        onTo={period.setTo}
        onPreset={period.apply}
      />
      <div className="mt-4 overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Items</th>
                <th className="px-2 py-3 font-medium">
                  <span className="sr-only">Delete</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                    {orders.length === 0 ? "No purchase orders yet." : "No purchase orders in this period."}
                  </td>
                </tr>
              ) : (
                rows.map((order) => (
                  <tr key={order.id} className="border-b border-border/70 last:border-0">
                    <td className="px-4 py-3">
                      <Link to="/purchases/orders/$id" params={{ id: order.id }} className="font-medium text-primary hover:underline">
                        {order.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{order.supplier.name}</td>
                    <td className="px-4 py-3">{formatDate(order.date)}</td>
                    <td className="px-4 py-3">{LABEL[order.status] ?? order.status}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{order.lines.length}</td>
                    <td className="px-2 py-3">
                      <DeleteVoucherButton
                        compact
                        title="Delete purchase order"
                        description="Moves this purchase order to the recycle bin. Stock and purchase bills stay as they are."
                        onConfirm={() => {
                          deleteOrder(order.id);
                          toast.success("Moved to the recycle bin");
                          void navigate({ to: "/purchases/orders" });
                        }}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
