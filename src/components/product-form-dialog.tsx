import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GST_RATES } from "@/lib/gst";
import { familyOf, lotCaption, sameLot, asLot } from "@/lib/lots";
import {
  applyMrp,
  applyPtsAmount,
  applyPtsPercent,
  applyPtrAmount,
  applyPtrPercent,
  normalizeProduct,
} from "@/lib/pricing";
import { useBillingStore } from "@/lib/store";
import type { GstRate, Product, Unit } from "@/lib/types";
import { toast } from "sonner";

const UNITS: Unit[] = ["Strip", "Bottle", "Box", "Tube", "Vial", "Sachet", "Jar", "Pack"];

const empty = (): Product => {
  const id = crypto.randomUUID();
  return normalizeProduct({
    id,
    itemId: id,
    name: "",
    genericName: "",
    pack: "",
    unit: "Strip",
    hsn: "300490",
    gstRate: 12,
    mrp: 0,
    rate: 0,
    pts: 0,
    ptr: 0,
    ptsPercent: 65,
    ptrPercent: 80,
    batch: "",
    expiry: "",
    manufacturer: "Hysiac Pharmaceuticals",
    active: true,
  });
};

export function ProductFormDialog({
  product,
  trigger,
  onSaved,
}: {
  product?: Product;
  trigger: ReactNode;
  onSaved?: (p: Product) => void;
}) {
  const upsert = useBillingStore((s) => s.upsertProduct);
  const products = useBillingStore((s) => s.products);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Product>(product ? normalizeProduct(product) : empty());

  const family = familyOf(
    products.filter((p) => p.id !== form.id),
    form,
  );
  const clash = family.find((p) => sameLot(asLot(p), asLot(form)));

  function set<K extends keyof Product>(key: K, value: Product[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    if (!form.name.trim()) {
      toast.error("Product name is required.");
      return;
    }
    try {
      const saved = normalizeProduct({ ...form, itemId: family[0]?.itemId || form.itemId || form.id });
      upsert(saved);
      onSaved?.(saved);
      toast.success(
        product
          ? "Lot updated"
          : family.length
            ? "New batch lot added — existing stock unchanged"
            : "Product added",
      );
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setForm(product ? normalizeProduct(product) : empty());
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? "Edit batch lot" : "New product / lot"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {family.length > 0 ? (
            <p className="rounded-lg bg-secondary px-3 py-2 text-[11px] leading-snug text-muted-foreground">
              {form.name} already in stock
              {family
                .slice(0, 3)
                .map((p) => ` · ${lotCaption(p)}`)
                .join("")}
              {clash
                ? ". This batch and MRP already exist — change batch or MRP to open a new lot."
                : ". Saving with different batch / MRP / PTS / PTR opens a new lot and leaves old stock as-is."}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Brand name</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Generic / composition</Label>
              <Input value={form.genericName} onChange={(e) => set("genericName", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Pack</Label>
              <Input value={form.pack} onChange={(e) => set("pack", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={form.unit} onValueChange={(v) => set("unit", v as Unit)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>HSN</Label>
              <Input value={form.hsn} onChange={(e) => set("hsn", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>GST %</Label>
              <Select value={String(form.gstRate)} onValueChange={(v) => set("gstRate", Number(v) as GstRate)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GST_RATES.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {r}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>MRP</Label>
              <Input
                type="number"
                step="0.01"
                value={form.mrp}
                onChange={(e) => setForm((f) => applyMrp(f, Number(e.target.value)))}
              />
            </div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3">
            <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Trade rates of MRP</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>PTS %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.ptsPercent}
                  onChange={(e) => setForm((f) => applyPtsPercent(f, Number(e.target.value)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>PTS ₹ (stockist)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.pts}
                  onChange={(e) => setForm((f) => applyPtsAmount(f, Number(e.target.value)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>PTR %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.ptrPercent}
                  onChange={(e) => setForm((f) => applyPtrPercent(f, Number(e.target.value)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>PTR ₹ (retailer)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.ptr}
                  onChange={(e) => setForm((f) => applyPtrAmount(f, Number(e.target.value)))}
                />
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Batch</Label>
              <Input value={form.batch} onChange={(e) => set("batch", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry</Label>
              <Input type="date" value={form.expiry} onChange={(e) => set("expiry", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Manufacturer</Label>
            <Input value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>Save product</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
