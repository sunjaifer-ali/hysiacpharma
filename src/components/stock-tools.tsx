import { useMemo, useState } from "react";
import { ProductPicker } from "@/components/product-picker";
import { DeleteVoucherButton } from "@/components/delete-voucher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, todayISO } from "@/lib/format";
import { lotCaption } from "@/lib/lots";
import { stockRegister, unitsOnHand } from "@/lib/registers";
import { isInsuranceProduct } from "@/lib/insurance";
import { useBillingStore } from "@/lib/store";
import type { StockOutReason } from "@/lib/types";
import { toast } from "sonner";

function expiryDay(value: string): string {
  if (!value) return "";
  return value.length === 7 ? `${value}-01` : value.slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function ExpiryList() {
  const products = useBillingStore((s) => s.products);
  const purchases = useBillingStore((s) => s.purchases);
  const invoices = useBillingStore((s) => s.invoices);
  const creditNotes = useBillingStore((s) => s.creditNotes);
  const adjustments = useBillingStore((s) => s.adjustments);
  const today = todayISO();
  const soon = addDays(today, 90);
  const monthEnd = `${today.slice(0, 7)}-31`;
  const rows = useMemo(() => {
    return stockRegister(products, purchases, invoices, creditNotes, undefined, undefined, adjustments)
      .filter((row) => row.closing > 0.001 && expiryDay(row.expiry))
      .map((row) => ({ ...row, exp: expiryDay(row.expiry) }))
      .filter((row) => row.exp <= soon)
      .sort((a, b) => a.exp.localeCompare(b.exp) || a.name.localeCompare(b.name));
  }, [products, purchases, invoices, creditNotes, adjustments, soon]);

  return (
    <div className="mt-4">
      <p className="mb-3 text-sm text-muted-foreground">Batches still in stock that are expired, expire this month, or expire within 90 days. Use Stock out to remove them.</p>
      <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Expiry</th>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 text-right font-medium">Stock</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Nothing expiring in the next 90 days.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.productId} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3">
                    {row.name}
                    <span className="block text-[11px] text-muted-foreground">{row.batch || "No batch"}</span>
                  </td>
                  <td className="px-4 py-3">{formatDate(row.exp)}</td>
                  <td className="px-4 py-3">{row.exp < today ? "Expired" : row.exp <= monthEnd ? "This month" : "Within 90 days"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.closing}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StockOutPanel() {
  const products = useBillingStore((s) => s.products);
  const purchases = useBillingStore((s) => s.purchases);
  const invoices = useBillingStore((s) => s.invoices);
  const creditNotes = useBillingStore((s) => s.creditNotes);
  const adjustments = useBillingStore((s) => s.adjustments);
  const saveAdjustment = useBillingStore((s) => s.saveAdjustment);
  const deleteAdjustment = useBillingStore((s) => s.deleteAdjustment);
  const [productId, setProductId] = useState("");
  const [picked, setPicked] = useState("");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState<StockOutReason>("expired");
  const [note, setNote] = useState("");
  const stock = productId ? unitsOnHand(products, purchases, invoices, creditNotes, productId, undefined, adjustments) : 0;

  function save() {
    try {
      saveAdjustment({ productId, qty: Number(qty), date, reason, note });
      setQty("");
      setNote("");
      toast.success("Removed from stock");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove stock");
    }
  }

  return (
    <div className="mt-4 grid gap-4">
      <p className="text-sm text-muted-foreground">Use this when strips are broken or past expiry. It reduces stock only. It is not a sales invoice and it does not change GST.</p>
      <div className="grid gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Product</Label>
          <ProductPicker
            allowOutOfStock
            label={productId ? "Change product" : "Choose product"}
            onSelect={(p) => {
              setProductId(p.id);
              setPicked(`${p.name} · ${lotCaption(p)}`);
            }}
          />
          {productId ? <p className="text-[11px] text-muted-foreground">{picked} · in stock {stock}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label>Quantity out</Label>
          <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Reason</Label>
          <Select value={reason} onValueChange={(v) => setReason(v as StockOutReason)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="damaged">Damaged</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </div>
        <div className="sm:col-span-2">
          <Button type="button" onClick={save}>Remove from stock</Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
        {adjustments.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No stock has been written off.</p>
        ) : (
          <ul>
            {adjustments.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3 last:border-0">
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDate(item.date)} · {item.reason} · {item.qty}{item.note ? ` · ${item.note}` : ""}</p>
                </div>
                <DeleteVoucherButton
                  compact
                  title="Undo this stock out"
                  description="Moves this entry to the recycle bin and puts the quantity back in stock."
                  onConfirm={() => deleteAdjustment(item.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function OpeningStockPanel() {
  const products = useBillingStore((s) => s.products);
  const setOpeningStock = useBillingStore((s) => s.setOpeningStock);
  const [q, setQ] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { qty: string; date: string }>>({});
  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return products
      .filter((p) => !isInsuranceProduct(p))
      .filter((p) => !query || `${p.name} ${p.genericName} ${p.batch}`.toLowerCase().includes(query))
      .filter((p) => query || (p.openingQty || 0) > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 40);
  }, [products, q]);

  function draft(id: string, qty: number, date: string) {
    return drafts[id] ?? { qty: qty ? String(qty) : "", date: date || todayISO() };
  }

  return (
    <div className="mt-4">
      <p className="mb-3 text-sm text-muted-foreground">Stock already in the godown on the day you start. This is not a purchase bill and it does not create GST.</p>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a product to set opening stock" />
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-2xl bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-border)]">
            {q.trim() ? "No product matches." : "No opening stock yet. Search a product and enter the quantity."}
          </p>
        ) : (
          rows.map((p) => {
            const value = draft(p.id, p.openingQty || 0, p.openingDate || todayISO());
            return (
              <div key={p.id} className="grid gap-2 rounded-2xl bg-card p-3 shadow-[var(--shadow-border)] sm:grid-cols-[1fr_8rem_10rem_auto] sm:items-end">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">{lotCaption(p)}</p>
                </div>
                <Input
                  inputMode="decimal"
                  aria-label="Opening quantity"
                  value={value.qty}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [p.id]: { ...value, qty: e.target.value } }))}
                />
                <Input
                  type="date"
                  aria-label="Opening date"
                  value={value.date}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [p.id]: { ...value, date: e.target.value } }))}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpeningStock(p.id, Number(value.qty) || 0, value.date);
                    toast.success("Opening stock saved");
                  }}
                >
                  Save
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
