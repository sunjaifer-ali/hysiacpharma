import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { PartyPicker } from "@/components/party-picker";
import { ProductPicker } from "@/components/product-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { todayISO } from "@/lib/format";
import { lowStockAlerts } from "@/lib/low-stock";
import { useBillingStore } from "@/lib/store";
import type { Product, PurchaseOrder, PurchaseOrderLine } from "@/lib/types";
import { toast } from "sonner";

function emptyLine(): PurchaseOrderLine {
  return {
    id: crypto.randomUUID(),
    productId: "",
    name: "",
    pack: "",
    unit: "Strip",
    manufacturer: "",
    qty: 1,
    note: "",
  };
}

function asUnit(unit: string): PurchaseOrderLine["unit"] {
  if (
    unit === "Bottle" ||
    unit === "Box" ||
    unit === "Tube" ||
    unit === "Vial" ||
    unit === "Sachet" ||
    unit === "Jar" ||
    unit === "Pack"
  ) {
    return unit;
  }
  return "Strip";
}

function fromProduct(product: Product, qty = 1): PurchaseOrderLine {
  return {
    ...emptyLine(),
    productId: product.id,
    name: product.genericName ? `${product.name} (${product.genericName})` : product.name,
    pack: product.pack,
    unit: product.unit,
    manufacturer: product.manufacturer,
    qty,
  };
}

export function PurchaseOrderEditor({
  existing,
  prefillLow = false,
}: {
  existing?: PurchaseOrder;
  prefillLow?: boolean;
}) {
  const navigate = useNavigate();
  const saveOrder = useBillingStore((s) => s.savePurchaseOrder);
  const products = useBillingStore((s) => s.products);
  const purchases = useBillingStore((s) => s.purchases);
  const invoices = useBillingStore((s) => s.invoices);
  const creditNotes = useBillingStore((s) => s.creditNotes);
  const adjustments = useBillingStore((s) => s.adjustments);

  const seeded = existing?.lines?.length
    ? existing.lines
    : prefillLow
      ? lowStockAlerts(products, purchases, invoices, creditNotes, adjustments).map((item) => {
          const product = products.find((p) => p.id === item.productId);
          if (product) return fromProduct(product, item.orderQty);
          return {
            ...emptyLine(),
            productId: item.productId,
            name: item.name,
            pack: item.pack,
            unit: asUnit(item.unit),
            manufacturer: item.manufacturer,
            qty: item.orderQty,
          };
        })
      : [emptyLine()];

  const [supplierId, setSupplierId] = useState(existing?.supplierId ?? "");
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [neededBy, setNeededBy] = useState(existing?.neededBy ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [lines, setLines] = useState<PurchaseOrderLine[]>(seeded.length ? seeded : [emptyLine()]);

  function save(as: "draft" | "sent") {
    try {
      const saved = saveOrder({ id: existing?.id, date, supplierId, neededBy, notes, lines }, as);
      toast.success(as === "sent" ? `Sent ${saved.number}` : "Order saved");
      void navigate({ to: "/purchases/orders/$id", params: { id: saved.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the order");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Supplier</Label>
          <PartyPicker value={supplierId} role="supplier" onChange={(id) => setSupplierId(id)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="po-date">Date</Label>
          <Input id="po-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="po-need">Required by</Label>
          <Input id="po-need" type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="po-notes">Note to supplier</Label>
          <Textarea id="po-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl">Items requested</h2>
          <ProductPicker
            allowOutOfStock
            onSelect={(product) => setLines((current) => [...current.filter((line) => line.name), fromProduct(product)])}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">Product</th>
                <th className="py-2 font-medium">Pack</th>
                <th className="w-28 py-2 font-medium">Qty</th>
                <th className="py-2 font-medium">Note</th>
                <th className="w-10 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-t border-border">
                  <td className="py-2 pr-2">{line.name || "—"}</td>
                  <td className="py-2 pr-2 text-muted-foreground">{line.pack || "—"}</td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      min={1}
                      value={line.qty}
                      onChange={(e) =>
                        setLines((current) =>
                          current.map((row) => (row.id === line.id ? { ...row, qty: Number(e.target.value) } : row)),
                        )
                      }
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      value={line.note}
                      placeholder="Optional"
                      onChange={(e) =>
                        setLines((current) =>
                          current.map((row) => (row.id === line.id ? { ...row, note: e.target.value } : row)),
                        )
                      }
                    />
                  </td>
                  <td className="py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove line"
                      onClick={() => setLines((current) => current.filter((row) => row.id !== line.id))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => save("draft")}>
          Save draft
        </Button>
        <Button type="button" onClick={() => save("sent")}>
          Save and send
        </Button>
      </div>
    </div>
  );
}
