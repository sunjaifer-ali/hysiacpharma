import { stockRegister } from "./registers";
import type { CreditNote, Invoice, Product, Purchase, StockAdjustment, Unit } from "./types";

/** Warn when strips on hand fall under this count. */
export const LOW_STOCK_STRIPS = 1000;
/** Warn when on-hand is under this share of quantity purchased. */
export const LOW_STOCK_RATIO = 0.3;

export type LowStockItem = {
  key: string;
  productId: string;
  name: string;
  pack: string;
  unit: Unit | string;
  manufacturer: string;
  closing: number;
  received: number;
  /** On hand ÷ purchased. 0 when nothing was ever purchased. */
  ratio: number;
  belowStrips: boolean;
  belowPercent: boolean;
  /** Quantity to order so the item clears both limits. */
  orderQty: number;
};

export function lowStockAlerts(
  products: Product[],
  purchases: Purchase[],
  invoices: Invoice[],
  creditNotes: CreditNote[],
  adjustments: StockAdjustment[] = [],
): LowStockItem[] {
  const rows = stockRegister(products, purchases, invoices, creditNotes, undefined, undefined, adjustments);
  const byProduct = new Map(products.map((p) => [p.id, p]));
  const groups = new Map<
    string,
    {
      productId: string;
      name: string;
      pack: string;
      unit: string;
      manufacturer: string;
      closing: number;
      received: number;
    }
  >();

  for (const row of rows) {
    const product = byProduct.get(row.productId);
    const key = product?.itemId || row.name;
    const current = groups.get(key) ?? {
      productId: product?.id || row.productId,
      name: product?.name || row.name,
      pack: product?.pack || row.pack,
      unit: product?.unit || "Strip",
      manufacturer: product?.manufacturer || "",
      closing: 0,
      received: 0,
    };
    current.closing += row.closing;
    current.received += row.purchaseQty + row.freeIn + row.openingQty;
    groups.set(key, current);
  }

  const alerts: LowStockItem[] = [];
  for (const [key, group] of groups) {
    const closing = Math.round(group.closing);
    const received = Math.round(group.received);
    if (received <= 0 && closing <= 0) continue;
    const ratio = received > 0 ? closing / received : 1;
    const strips = group.unit === "Strip";
    const belowStrips = strips && closing < LOW_STOCK_STRIPS;
    const belowPercent = received > 0 && ratio < LOW_STOCK_RATIO;
    if (!belowStrips && !belowPercent) continue;
    const percentFloor = received > 0 ? Math.ceil(received * LOW_STOCK_RATIO) : 0;
    const target = strips ? Math.max(LOW_STOCK_STRIPS, percentFloor) : percentFloor;
    alerts.push({
      key,
      productId: group.productId,
      name: group.name,
      pack: group.pack,
      unit: group.unit,
      manufacturer: group.manufacturer,
      closing,
      received,
      ratio,
      belowStrips,
      belowPercent,
      orderQty: Math.max(1, target - closing),
    });
  }

  return alerts.sort((a, b) => a.closing - b.closing || a.ratio - b.ratio || a.name.localeCompare(b.name));
}
