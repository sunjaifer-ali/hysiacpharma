import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Search } from "lucide-react";
import { DeleteVoucherButton } from "@/components/delete-voucher";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProductFormDialog } from "@/components/product-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatINR } from "@/lib/format";
import { lotCaption } from "@/lib/lots";
import { unitsOnHand } from "@/lib/registers";
import { isInsuranceProduct } from "@/lib/insurance";
import { ExpiryList, OpeningStockPanel, StockOutPanel } from "@/components/stock-tools";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBillingStore } from "@/lib/store";
import type { Product } from "@/lib/types";

export const Route = createFileRoute("/products")({ component: ProductsPage });

function ProductsPage() {
  const products = useBillingStore((s) => s.products);
  const purchases = useBillingStore((s) => s.purchases);
  const invoices = useBillingStore((s) => s.invoices);
  const creditNotes = useBillingStore((s) => s.creditNotes);
  const adjustments = useBillingStore((s) => s.adjustments);
  const remove = useBillingStore((s) => s.deleteProduct);
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const query = q.trim().toLowerCase();
    const filtered = products.filter((p) => {
      if (isInsuranceProduct(p)) return false;
      if (!query) return true;
      return `${p.name} ${p.genericName} ${p.hsn} ${p.batch} ${p.manufacturer}`.toLowerCase().includes(query);
    });
    const map = new Map<string, Product[]>();
    for (const p of filtered) {
      const key = p.itemId || p.id;
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return [...map.values()]
      .map((lots) => lots.slice().sort((a, b) => a.batch.localeCompare(b.batch)))
      .sort((a, b) => a[0]!.name.localeCompare(b[0]!.name));
  }, [products, q]);

  function stockOf(id: string) {
    return unitsOnHand(products, purchases, invoices, creditNotes, id, undefined, adjustments);
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One medicine can have several lots (batch, MRP, PTS, PTR). Stock is counted per lot.
          </p>
        </div>
        <ProductFormDialog
          trigger={
            <Button>
              <Plus className="size-4" />
              Add product
            </Button>
          }
        />
      </div>

      <Tabs defaultValue="list" className="mt-5">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="list">Products</TabsTrigger>
          <TabsTrigger value="expiry">Expiry</TabsTrigger>
          <TabsTrigger value="out">Stock out</TabsTrigger>
          <TabsTrigger value="opening">Opening stock</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search name, generic, HSN, batch" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="mt-4 space-y-3">
        {groups.length === 0 ? (
          <p className="rounded-2xl bg-card px-4 py-10 text-center text-sm text-muted-foreground shadow-[var(--shadow-border)]">
            No products match.
          </p>
        ) : (
          groups.map((lots) => {
            const head = lots[0]!;
            return (
              <article key={head.itemId || head.id} className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3">
                  <div>
                    <p className="font-medium">{head.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {head.genericName} · {head.pack} · HSN {head.hsn}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {lots.length} lot{lots.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <ul>
                  {lots.map((p) => {
                    const stock = stockOf(p.id);
                    return (
                      <li
                        key={p.id}
                        className="flex flex-col gap-2 border-b border-border/70 px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-sm">{lotCaption(p)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            GST {p.gstRate}% · PTS {formatINR(p.pts)} · PTR {formatINR(p.ptr)}
                            {p.expiry ? ` · exp ${formatDate(p.expiry)}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-sm tabular-nums">
                            <span className="text-muted-foreground">Stock </span>
                            {stock}
                          </p>
                          <ProductFormDialog
                            product={p}
                            trigger={
                              <Button variant="ghost" size="icon" className="size-10" aria-label="Edit lot">
                                <Pencil className="size-4" />
                              </Button>
                            }
                          />
                          <DeleteVoucherButton
                            compact
                            title="Delete this batch"
                            description="Moves this batch to the recycle bin. Invoices that already used it stay as they are."
                            onConfirm={() => remove(p.id)}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })
        )}
      </div>
        </TabsContent>
        <TabsContent value="expiry">
          <ExpiryList />
        </TabsContent>
        <TabsContent value="out">
          <StockOutPanel />
        </TabsContent>
        <TabsContent value="opening">
          <OpeningStockPanel />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
