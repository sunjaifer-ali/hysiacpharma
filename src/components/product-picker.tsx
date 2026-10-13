import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { ProductFormDialog } from "@/components/product-form-dialog";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatINR } from "@/lib/format";
import { lotCaption } from "@/lib/lots";
import { priceListLabel, rateForList } from "@/lib/pricing";
import { unitsOnHand } from "@/lib/registers";
import { isInsuranceProduct } from "@/lib/insurance";
import { useBillingStore } from "@/lib/store";
import type { PriceList, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductPicker({
  onSelect,
  priceList,
  allowOutOfStock = false,
  label = "Add item",
}: {
  onSelect: (p: Product) => void;
  priceList?: PriceList;
  allowOutOfStock?: boolean;
  label?: string;
}) {
  const products = useBillingStore((s) => s.products).filter((p) => p.active && !isInsuranceProduct(p));
  const purchases = useBillingStore((s) => s.purchases);
  const invoices = useBillingStore((s) => s.invoices);
  const creditNotes = useBillingStore((s) => s.creditNotes);
  const adjustments = useBillingStore((s) => s.adjustments);
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => {
    return [...products]
      .map((p) => ({
        product: p,
        stock: unitsOnHand(products, purchases, invoices, creditNotes, p.id, undefined, adjustments),
      }))
      .sort((a, b) => a.product.name.localeCompare(b.product.name) || a.product.batch.localeCompare(b.product.batch));
  }, [products, purchases, invoices, creditNotes, adjustments]);

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Plus className="size-4" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0">
          <Command>
            <CommandInput placeholder="Search medicine, batch, HSN" />
            <CommandList>
              <CommandEmpty>No product found.</CommandEmpty>
              <CommandGroup>
                {rows.map(({ product: p, stock }) => {
                  const billed = priceList ? rateForList(p, priceList) : p.pts;
                  const out = stock <= 0;
                  const blocked = out && !allowOutOfStock;
                  return (
                    <CommandItem
                      key={p.id}
                      value={`${p.name} ${p.genericName} ${p.hsn} ${p.manufacturer} ${p.batch} ${p.mrp}`}
                      disabled={blocked}
                      onSelect={() => {
                        if (blocked) return;
                        onSelect(p);
                        setOpen(false);
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate", blocked && "text-muted-foreground")}>{p.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {lotCaption(p)} · stock {stock}
                          {out ? " — out" : ""}
                        </p>
                      </div>
                      <div className="text-right text-[11px] tabular-nums text-muted-foreground">
                        {priceList ? (
                          <span className="font-medium text-foreground">
                            {priceListLabel(priceList)} {formatINR(billed)}
                          </span>
                        ) : (
                          <>
                            <div>PTS {formatINR(p.pts)}</div>
                            <div>PTR {formatINR(p.ptr)}</div>
                          </>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <ProductFormDialog
        onSaved={onSelect}
        trigger={
          <Button type="button" variant="ghost" size="sm">
            New product
          </Button>
        }
      />
    </div>
  );
}
