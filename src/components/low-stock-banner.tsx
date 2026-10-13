import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { lowStockAlerts } from "@/lib/low-stock";
import { useBillingStore } from "@/lib/store";

export function LowStockBanner() {
  const products = useBillingStore((s) => s.products);
  const purchases = useBillingStore((s) => s.purchases);
  const invoices = useBillingStore((s) => s.invoices);
  const creditNotes = useBillingStore((s) => s.creditNotes);
  const adjustments = useBillingStore((s) => s.adjustments);
  const alerts = lowStockAlerts(products, purchases, invoices, creditNotes, adjustments);
  if (alerts.length === 0) return null;
  const shown = alerts.slice(0, 8);

  return (
    <section className="mt-5 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-destructive">
            Low stock · {alerts.length} {alerts.length === 1 ? "product" : "products"}
          </p>
          <p className="text-xs text-muted-foreground">
            On hand is under 1,000 strips, or under 30% of the quantity purchased.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/purchases/orders/new" search={{ low: true }}>
            Raise purchase order
          </Link>
        </Button>
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {shown.map((item) => (
          <li key={item.key} className="flex items-baseline justify-between gap-3 rounded-xl bg-secondary/70 px-3 py-2 text-sm">
            <span className="min-w-0 truncate font-medium">{item.name}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {item.closing} {item.unit === "Strip" ? "strips" : item.unit.toLowerCase()}
              {item.received > 0 ? ` · ${Math.round(item.ratio * 100)}%` : ""}
            </span>
          </li>
        ))}
      </ul>
      {alerts.length > shown.length ? (
        <p className="mt-2 text-xs text-muted-foreground">and {alerts.length - shown.length} more on the purchase order.</p>
      ) : null}
    </section>
  );
}
