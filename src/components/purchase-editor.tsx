import { Link, useNavigate } from "@tanstack/react-router";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PartyPicker } from "@/components/party-picker";
import { ProductPicker } from "@/components/product-picker";
import { PurchasePreview } from "@/components/purchase-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatINR, todayISO } from "@/lib/format";
import { GST_RATES, formatInvoiceNumber, gstModeCaption, invoiceTotals, isIntraState, stateName } from "@/lib/gst";
import { asLot, familyOf, lotCaption, lotChanges } from "@/lib/lots";
import { isInsuranceLine, isInsuranceText } from "@/lib/insurance";
import { syncPurchaseTrade } from "@/lib/pricing";
import { relinePurchase, useBillingStore } from "@/lib/store";
import type { GstRate, Product, Purchase, PurchaseDraft, PurchaseLine } from "@/lib/types";
import { toast } from "sonner";

function emptyLine(): PurchaseLine {
  return {
    id: crypto.randomUUID(),
    productId: "",
    name: "",
    hsn: "",
    pack: "",
    unit: "Strip",
    manufacturer: "",
    batch: "",
    expiry: "",
    mfgDate: "",
    qty: 1,
    freeQty: 0,
    mrp: 0,
    ptsPercent: 65,
    ptrPercent: 80,
    pts: 0,
    ptr: 0,
    purchaseRate: 0,
    discount: 0,
    gstRate: 12,
    taxable: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
  };
}

function fromProduct(p: Product, intra: boolean): PurchaseLine {
  return relinePurchase(
    {
      ...emptyLine(),
      productId: p.id,
      name: `${p.name} (${p.genericName})`,
      hsn: p.hsn,
      pack: p.pack,
      unit: p.unit,
      manufacturer: p.manufacturer,
      batch: p.batch,
      expiry: p.expiry,
      mrp: p.mrp,
      ptsPercent: p.ptsPercent,
      ptrPercent: p.ptrPercent,
      pts: p.pts,
      ptr: p.ptr,
      purchaseRate: p.pts,
      gstRate: p.gstRate,
    },
    intra,
  );
}

export function PurchaseEditor({ existing }: { existing?: Purchase }) {
  const navigate = useNavigate();
  const company = useBillingStore((s) => s.company);
  const parties = useBillingStore((s) => s.parties);
  const products = useBillingStore((s) => s.products);
  const savePurchase = useBillingStore((s) => s.savePurchase);

  const [supplierId, setSupplierId] = useState(existing?.supplierId ?? "");
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [billNo, setBillNo] = useState(existing?.billNo ?? existing?.challanNo ?? "");
  const [billDate, setBillDate] = useState(existing?.billDate ?? todayISO());
  const [challanNo, setChallanNo] = useState(existing?.challanNo ?? existing?.billNo ?? "");
  const [lrNumber, setLrNumber] = useState(existing?.lrNumber ?? "");
  const [lrDate, setLrDate] = useState(existing?.lrDate ?? "");
  const [transport, setTransport] = useState(existing?.transport ?? "");
  const [ewayBill, setEwayBill] = useState(existing?.ewayBill ?? "");
  const [cases, setCases] = useState(existing?.cases ?? 0);
  const [placeOfSupply, setPlaceOfSupply] = useState(existing?.placeOfSupply ?? company.stateCode);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [roundOff, setRoundOff] = useState(existing?.roundOff ?? 0);
  const [lines, setLines] = useState<PurchaseLine[]>(existing?.lines?.length ? existing.lines : [emptyLine()]);

  const supplier = parties.find((p) => p.id === supplierId);
  const intra = isIntraState(supplier?.stateCode ?? company.stateCode, placeOfSupply);
  const posted = existing?.status === "posted";

  const preview: Purchase = useMemo(() => {
    const relined = lines.map((l) => relinePurchase(l, intra));
    return {
      id: existing?.id ?? "preview",
      number:
        existing?.number && existing.status !== "draft"
          ? existing.number
          : formatInvoiceNumber(company.purchasePrefix, company.nextPurchaseNumber),
      date,
      status: existing?.status ?? "draft",
      supplierId,
      supplier: supplier
        ? {
            name: supplier.name,
            kind: supplier.kind,
            channel: supplier.channel,
            gstin: supplier.gstin,
            drugLicense: supplier.drugLicense ?? "",
            addressLine1: supplier.addressLine1,
            addressLine2: supplier.addressLine2,
            city: supplier.city,
            stateCode: supplier.stateCode,
            pincode: supplier.pincode,
            phone: supplier.phone,
          }
        : {
            name: "Select supplier",
            kind: "registered",
            channel: "stockist",
            gstin: "",
            drugLicense: "",
            addressLine1: "",
            addressLine2: "",
            city: "",
            stateCode: company.stateCode,
            pincode: "",
            phone: "",
          },
      company: {
        legalName: company.legalName,
        tradeName: company.tradeName,
        gstin: company.gstin,
        cin: company.cin,
        drugLicense: company.drugLicense,
        drugLicenseValidUpto: company.drugLicenseValidUpto,
        addressLine1: company.addressLine1,
        addressLine2: company.addressLine2,
        city: company.city,
        stateCode: company.stateCode,
        pincode: company.pincode,
        phone: company.phone,
        email: company.email,
        bankName: company.bankName,
        bankAccount: company.bankAccount,
        bankIfsc: company.bankIfsc,
        bankBranch: company.bankBranch,
        signatory: company.signatory,
      },
      placeOfSupply,
      billNo,
      billDate,
      challanNo: challanNo || billNo,
      lrNumber,
      lrDate,
      transport,
      ewayBill,
      cases,
      lines: relined,
      roundOff,
      notes,
      createdAt: existing?.createdAt ?? "",
      updatedAt: "",
    };
  }, [
    lines,
    intra,
    existing,
    company,
    date,
    supplierId,
    supplier,
    placeOfSupply,
    billNo,
    billDate,
    challanNo,
    lrNumber,
    lrDate,
    transport,
    ewayBill,
    cases,
    roundOff,
    notes,
  ]);

  const totals = invoiceTotals(preview);

  function patchLine(id: string, patch: Partial<PurchaseLine>) {
    setLines((prev) => {
      let changed = false;
      const next = prev.map((l) => {
        if (l.id !== id) return l;
        const merged = syncPurchaseTrade(l, patch);
        const insurance = isInsuranceText(merged.name);
        const stamped = insurance ? { ...merged, kind: "insurance" as const, productId: "" } : { ...merged, kind: "goods" as const };
        if (
          stamped.name === l.name &&
          stamped.hsn === l.hsn &&
          stamped.kind === l.kind &&
          stamped.productId === l.productId &&
          merged.pack === l.pack &&
          merged.manufacturer === l.manufacturer &&
          merged.batch === l.batch &&
          merged.expiry === l.expiry &&
          merged.mfgDate === l.mfgDate &&
          merged.qty === l.qty &&
          merged.freeQty === l.freeQty &&
          merged.mrp === l.mrp &&
          merged.pts === l.pts &&
          merged.ptr === l.ptr &&
          merged.ptsPercent === l.ptsPercent &&
          merged.ptrPercent === l.ptrPercent &&
          merged.purchaseRate === l.purchaseRate &&
          merged.discount === l.discount &&
          merged.gstRate === l.gstRate
        ) {
          return l;
        }
        changed = true;
        return relinePurchase(stamped, intra);
      });
      return changed ? next : prev;
    });
  }

  function addInsurance() {
    setLines((prev) => {
      const next = prev.filter((l) => l.productId || l.name);
      return [
        ...next,
        relinePurchase(
          {
            ...emptyLine(),
            kind: "insurance",
            name: "Insurance",
            hsn: "997139",
            unit: "Pack",
            qty: 1,
            gstRate: 18,
            ptsPercent: 0,
            ptrPercent: 0,
            mrp: 0,
          },
          intra,
        ),
      ];
    });
  }

  function addProduct(p: Product) {
    setLines((prev) => {
      const next = prev.filter((l) => l.productId || l.name);
      return [...next, fromProduct(p, intra)];
    });
  }

  function persist(as: "draft" | "posted") {
    if (!supplierId) {
      toast.error("Choose a supplier first.");
      return;
    }
    const posting = posted || as === "posted";
    if (posting && !billNo.trim() && !challanNo.trim()) {
      toast.error("Enter the supplier challan / bill number before posting.");
      return;
    }
    const filled = lines.filter((l) => l.name && l.qty > 0);
    if (filled.length === 0) {
      toast.error("Add at least one item.");
      return;
    }
    const draft: PurchaseDraft = {
      id: existing?.id ?? crypto.randomUUID(),
      date,
      supplierId,
      supplier: preview.supplier,
      company: preview.company,
      placeOfSupply,
      billNo: billNo || challanNo,
      billDate,
      challanNo: challanNo || billNo,
      lrNumber,
      lrDate,
      transport,
      ewayBill,
      cases,
      lines: filled.map((l) => relinePurchase(l, intra)),
      roundOff,
      notes,
    };
    try {
      const idsBefore = new Set(useBillingStore.getState().products.map((p) => p.id));
      const saved = savePurchase(draft, posting ? "posted" : "draft");
      if (posting) {
        const opened = useBillingStore.getState().products.filter((p) => !idsBefore.has(p.id));
        if (opened.length) {
          toast.success(
            `Saved ${saved.number}. Opened ${opened.length} new batch lot${opened.length === 1 ? "" : "s"} — old stock kept as-is.`,
          );
        } else {
          toast.success(posted ? `Updated ${saved.number}` : `Posted ${saved.number}`);
        }
      } else {
        toast.success("Draft saved");
      }
      void navigate({ to: "/purchases/$id", params: { id: saved.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  const form = (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Supplier</Label>
          <PartyPicker
            role="supplier"
            value={supplierId}
            onChange={(id) => {
              setSupplierId(id);
              setPlaceOfSupply(company.stateCode);
            }}
          />
          {supplier ? (
            <p className="text-[11px] text-muted-foreground">
              GSTIN {supplier.gstin || "—"}
              {supplier.drugLicense ? ` · D.L. ${supplier.drugLicense}` : ""}
              {` · ${supplier.city || stateName(supplier.stateCode)}`}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">Search or add the company on the supplier bill.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pur-date">Received on</Label>
          <Input id="pur-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bill-date">Invoice / challan date</Label>
          <Input
            id="bill-date"
            type="date"
            value={billDate}
            onChange={(e) => {
              setBillDate(e.target.value);
              if (!lrDate) setLrDate(e.target.value);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="challan-no">Challan no.</Label>
          <Input
            id="challan-no"
            placeholder="CA01667"
            value={challanNo}
            onChange={(e) => {
              setChallanNo(e.target.value);
              if (!billNo) setBillNo(e.target.value);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bill-no">Supplier bill no.</Label>
          <Input
            id="bill-no"
            placeholder="Same as challan if blank"
            value={billNo}
            onChange={(e) => setBillNo(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl bg-secondary/60 px-3 py-2 text-xs">{gstModeCaption(supplier?.stateCode ?? "", placeOfSupply)}</div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="transport">Transport</Label>
          <Input id="transport" placeholder="VRL" value={transport} onChange={(e) => setTransport(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lr-no">L.R. no.</Label>
          <Input id="lr-no" value={lrNumber} onChange={(e) => setLrNumber(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lr-date">L.R. date</Label>
          <Input id="lr-date" type="date" value={lrDate} onChange={(e) => setLrDate(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="eway">E-way bill</Label>
          <Input id="eway" value={ewayBill} onChange={(e) => setEwayBill(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cases">Cases</Label>
          <Input id="cases" type="number" min={0} value={cases} onChange={(e) => setCases(Number(e.target.value))} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Items from the supplier bill</Label>
          <div className="flex flex-wrap gap-2">
            <ProductPicker onSelect={addProduct} allowOutOfStock />
            <Button type="button" variant="outline" size="sm" onClick={addInsurance}>
              Add insurance
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Same medicine with a new batch, MRP, PTS or PTR is stored as a new lot. Existing stock is never overwritten.
        </p>
        <div className="space-y-3">
          {lines.map((line, idx) => {
            const insurance = isInsuranceLine(line);
            const family = insurance ? [] : familyOf(products, line);
            const linked = family.find((p) => p.id === line.productId) ?? family[0];
            const changes = linked ? lotChanges(asLot(linked), asLot(line)) : [];
            return (
            <div key={line.id} className="rounded-xl bg-secondary/50 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">#{idx + 1}</p>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    onClick={() =>
                      setLines((prev) => [...prev, relinePurchase({ ...line, id: crypto.randomUUID() }, intra)])
                    }
                  >
                    <Copy className="size-4" />
                    <span className="sr-only">Duplicate line</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">Remove line</span>
                  </Button>
                </div>
              </div>
              {insurance ? (
                <p className="mb-2 rounded-lg bg-secondary px-3 py-2 text-[11px] leading-snug text-muted-foreground">
                  Insurance only. It stays on this purchase bill and is not added to stock or sales.
                </p>
              ) : linked && changes.length > 0 ? (
                <p className="mb-2 rounded-lg bg-warning/15 px-3 py-2 text-[11px] leading-snug text-warning">
                  New lot on post — old stock stays ({lotCaption(linked)}). Changed:{" "}
                  {changes.map((c) => `${c.field} ${c.from} → ${c.to}`).join(", ")}.
                </p>
              ) : linked ? (
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Same lot as stock ({lotCaption(linked)}). Quantity will add to that batch.
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label>Particulars</Label>
                  <Input value={line.name} onChange={(e) => patchLine(line.id, { name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>HSN</Label>
                  <Input value={line.hsn} onChange={(e) => patchLine(line.id, { hsn: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Pack</Label>
                  <Input value={line.pack} onChange={(e) => patchLine(line.id, { pack: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                  <div className="space-y-1">
                    <Label>Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      value={line.qty}
                      onChange={(e) => patchLine(line.id, { qty: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Free</Label>
                    <Input
                      type="number"
                      min={0}
                      value={line.freeQty}
                      onChange={(e) => patchLine(line.id, { freeQty: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>MRP</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.mrp}
                      onChange={(e) => patchLine(line.id, { mrp: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                  <div className="space-y-1">
                    <Label>Rate</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.purchaseRate}
                      onChange={(e) => patchLine(line.id, { purchaseRate: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Discount ₹</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.discount}
                      onChange={(e) => patchLine(line.id, { discount: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>GST %</Label>
                    <Select
                      value={String(line.gstRate)}
                      onValueChange={(v) => patchLine(line.id, { gstRate: Number(v) as GstRate })}
                    >
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
                </div>
                <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                  <div className="space-y-1">
                    <Label>Batch</Label>
                    <Input value={line.batch} onChange={(e) => patchLine(line.id, { batch: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Mfg</Label>
                    <Input
                      type="month"
                      value={line.mfgDate}
                      onChange={(e) => patchLine(line.id, { mfgDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Expiry</Label>
                    <Input type="date" value={line.expiry} onChange={(e) => patchLine(line.id, { expiry: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Line total</Label>
                    <div className="flex h-11 items-center rounded-md px-3 text-sm tabular-nums font-medium">
                      {formatINR(line.taxable + line.cgst + line.sgst + line.igst)}
                    </div>
                  </div>
                </div>
                <details className="sm:col-span-2">
                  <summary className="cursor-pointer text-[11px] text-muted-foreground">
                    Selling PTS / PTR for this lot only
                  </summary>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>PTS %</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.ptsPercent}
                        onChange={(e) => patchLine(line.id, { ptsPercent: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>PTS ₹</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.pts}
                        onChange={(e) => patchLine(line.id, { pts: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>PTR %</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.ptrPercent}
                        onChange={(e) => patchLine(line.id, { ptrPercent: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>PTR ₹</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.ptr}
                        onChange={(e) => patchLine(line.id, { ptr: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </details>
              </div>
            </div>
            );
          })}
        </div>
        <Button type="button" variant="outline" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
          <Plus className="size-4" />
          Blank line
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pur-round">Round off</Label>
          <Input
            id="pur-round"
            type="number"
            step="0.01"
            value={roundOff}
            onChange={(e) => setRoundOff(Number(e.target.value))}
          />
        </div>
        <div className="rounded-xl bg-secondary/70 p-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Taxable</span>
            <span className="tabular-nums">{formatINR(totals.taxable)}</span>
          </div>
          {totals.cgst > 0 ? (
            <div className="flex justify-between text-muted-foreground">
              <span>CGST / SGST</span>
              <span className="tabular-nums">
                {formatINR(totals.cgst)} / {formatINR(totals.sgst)}
              </span>
            </div>
          ) : null}
          {totals.igst > 0 ? (
            <div className="flex justify-between text-muted-foreground">
              <span>IGST</span>
              <span className="tabular-nums">{formatINR(totals.igst)}</span>
            </div>
          ) : null}
          <div className="mt-1 flex justify-between font-medium">
            <span>Grand total</span>
            <span className="tabular-nums">{formatINR(totals.grand)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pur-notes">Notes</Label>
        <Textarea id="pur-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="sticky bottom-2 z-10 flex flex-col-reverse gap-2 rounded-xl bg-background/95 p-2 shadow-[var(--shadow-border)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="px-2 text-sm font-medium tabular-nums">{formatINR(totals.grand)}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" asChild>
            <Link to="/purchases">Cancel</Link>
          </Button>
          {posted ? null : (
            <Button variant="secondary" onClick={() => persist("draft")}>
              Save draft
            </Button>
          )}
          <Button onClick={() => persist("posted")}>{posted ? "Save changes" : "Post purchase"}</Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div>{form}</div>
      <div className="xl:sticky xl:top-6">
        <PurchasePreview purchase={preview} />
      </div>
    </div>
  );
}
