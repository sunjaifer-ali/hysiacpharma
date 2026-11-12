import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { lowStockAlerts } from "@/lib/low-stock";
import { useBillingStore } from "@/lib/store";

export function LowStockBanner() {
  const products = useBillingStore((s) => s.products);
  const purchases = useBillingStore((s) => s.purchases);
  const invoices = useBillingStore((s) => s.invoices);
  const creditNotes = useBillingStore((s) => s.creditNotes);
  const adjustments = useBillingStore((s) => s.adjustments);
  const orders = useBillingStore((s) => s.purchaseOrders);
  const [hidden, setHidden] = useState("");
  const alerts = useMemo(() => {
    const ordered = new Set(
      orders
        .filter((order) => order.status === "draft" || order.status === "sent")
        .flatMap((order) => order.lines.map((line) => line.productId || line.name)),
    );
    return lowStockAlerts(products, purchases, invoices, creditNotes, adjustments).filter(
      (item) => !ordered.has(item.productId) && !ordered.has(item.name),
    );
  }, [products, purchases, invoices, creditNotes, adjustments, orders]);
  const key = alerts.map((item) => item.key).join("|");
  if (alerts.length === 0 || hidden === key) return null;
  const shown = alerts.slice(0, 8);
  const open = orders.find((order) => order.status === "draft" || order.status === "sent");

  return (
    <section className="mt-5 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-destructive">
          Low stock · {alerts.length} {alerts.length === 1 ? "product" : "products"}
        </p>
        <div className="flex gap-2">
          {open ? (
            <Button asChild size="sm">
              <Link to="/purchases/orders/$id/edit" params={{ id: open.id }} search={{ low: true }}>
                Update purchase order
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/purchases/orders/new" search={{ low: true }}>
                Update purchase order
              </Link>
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setHidden(key)}>
            Dismiss
          </Button>
        </div>
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {shown.map((item) => (
          <li key={item.key} className="flex items-baseline justify-between gap-3 rounded-xl bg-secondary/70 px-3 py-2 text-sm">
            <span className="min-w-0 truncate font-medium">{item.name}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {item.closing} {item.unit === "Strip" ? "strips" : item.unit.toLowerCase()}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}