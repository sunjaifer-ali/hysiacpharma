import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { InvoicePreview } from "@/components/invoice-preview";
import { PartyPicker } from "@/components/party-picker";
import { ProductPicker } from "@/components/product-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { todayISO } from "@/lib/format";
import { GST_RATES, INDIAN_STATES, formatInvoiceNumber, gstModeCaption, invoiceTotals, isIntraState } from "@/lib/gst";
import { channelLabel, priceListForChannel, priceListLabel, rateForList, rateFromLine } from "@/lib/pricing";
import { reline, useBillingStore } from "@/lib/store";
import { unitsOnHand } from "@/lib/registers";
import type { BillKind, GstRate, Invoice, InvoiceDraft, InvoiceLine, PriceList, Product } from "@/lib/types";
import { toast } from "sonner";

function emptyLine(priceList: PriceList): InvoiceLine {
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
    qty: 1,
    freeQty: 0,
    mrp: 0,
    pts: 0,
    ptr: 0,
    ptsPercent: 0,
    ptrPercent: 0,
    priceList,
    rate: 0,
    discount: 0,
    gstRate: 12,
    taxable: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
  };
}

function fromProduct(p: Product, intra: boolean, list: PriceList): InvoiceLine {
  return reline(
    {
      ...emptyLine(list),
      productId: p.id,
      name: `${p.name} (${p.genericName})`,
      hsn: p.hsn,
      pack: p.pack,
      unit: p.unit,
      manufacturer: p.manufacturer,
      batch: p.batch,
      expiry: p.expiry,
      mrp: p.mrp,
      pts: p.pts,
      ptr: p.ptr,
      ptsPercent: p.ptsPercent,
      ptrPercent: p.ptrPercent,
      priceList: list,
      rate: rateForList(p, list),
      gstRate: p.gstRate,
    },
    intra,
  );
}

function applyList(lines: InvoiceLine[], list: PriceList, intra: boolean): InvoiceLine[] {
  return lines.map((l) => reline({ ...l, priceList: list, rate: rateFromLine(l, list) }, intra));
}

export function InvoiceEditor({ existing, quoteId }: { existing?: Invoice; quoteId?: string }) {
  const navigate = useNavigate();
  const company = useBillingStore((s) => s.company);
  const parties = useBillingStore((s) => s.parties);
  const products = useBillingStore((s) => s.products);
  const purchases = useBillingStore((s) => s.purchases);
  const invoices = useBillingStore((s) => s.invoices);
  const creditNotes = useBillingStore((s) => s.creditNotes);
  const adjustments = useBillingStore((s) => s.adjustments);
  const saveInvoice = useBillingStore((s) => s.saveInvoice);
  const markQuoteOrdered = useBillingStore((s) => s.markQuoteOrdered);

  const [partyId, setPartyId] = useState(existing?.partyId ?? "");
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [placeOfSupply, setPlaceOfSupply] = useState(existing?.placeOfSupply ?? company.stateCode);
  const [reverseCharge, setReverseCharge] = useState(existing?.reverseCharge ?? false);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [roundOff, setRoundOff] = useState(existing?.roundOff ?? 0);
  const [salesman, setSalesman] = useState(existing?.salesman ?? company.salesman);
  const [poNumber, setPoNumber] = useState(existing?.poNumber ?? "");
  const [transport, setTransport] = useState(existing?.transport ?? "");
  const [ewayBill, setEwayBill] = useState(existing?.ewayBill ?? "");
  const [billKind, setBillKind] = useState<BillKind>(existing?.billKind ?? "credit");
  const initialParty = parties.find((p) => p.id === (existing?.partyId ?? ""));
  const [priceList, setPriceList] = useState<PriceList>(
    existing?.priceList ?? priceListForChannel(initialParty?.channel),
  );
  const [lines, setLines] = useState<InvoiceLine[]>(
    existing?.lines?.length ? existing.lines : [emptyLine(priceList)],
  );

  const party = parties.find((p) => p.id === partyId);
  const intra = isIntraState(company.stateCode, placeOfSupply);
  const exceptId = existing?.status === "draft" ? undefined : existing?.id;

  function onHand(productId: string): number {
    return unitsOnHand(products, purchases, invoices, creditNotes, productId, exceptId, adjustments);
  }

  function roomFor(line: InvoiceLine, all: InvoiceLine[]): number {
    if (!line.productId) return 999999;
    const used = all
      .filter((l) => l.id !== line.id && l.productId === line.productId)
      .reduce((s, l) => s + l.qty + l.freeQty, 0);
    return Math.max(0, onHand(line.productId) - used);
  }

  const preview: Invoice = useMemo(() => {
    const relined = lines.map((l) => reline(l, intra));
    return {
      id: existing?.id ?? "preview",
      number:
        existing?.number && existing.status !== "draft"
          ? existing.number
          : formatInvoiceNumber(company.invoicePrefix, company.nextNumber),
      date,
      status: existing?.status ?? "draft",
      partyId,
      party: party
        ? {
            name: party.name,
            kind: party.kind,
            channel: party.channel,
            gstin: party.gstin,
            drugLicense: party.drugLicense ?? "",
            addressLine1: party.addressLine1,
            addressLine2: party.addressLine2,
            city: party.city,
            stateCode: party.stateCode,
            pincode: party.pincode,
            phone: party.phone,
          }
        : {
            name: "Select customer",
            kind: "unregistered",
            channel: priceList === "pts" ? "stockist" : "retailer",
            gstin: "",
            drugLicense: "",
            addressLine1: "",
            addressLine2: "",
            city: "",
            stateCode: placeOfSupply,
            pincode: "",
            phone: "",
          },
      company: {
        legalName: company.legalName,
        tradeName: company.tradeName,
        gstin: company.gstin,
        cin: company.cin,
        drugLicense: company.drugLicense,
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
      reverseCharge,
      priceList,
      billKind,
      salesman,
      poNumber,
      transport,
      ewayBill,
      transportCharges: existing?.transportCharges ?? 0,
      otherCharges: existing?.otherCharges ?? 0,
      creditApplied: existing?.creditApplied ?? 0,
      lines: relined,
      roundOff,
      notes,
      paidAmount: existing?.paidAmount ?? 0,
      createdAt: existing?.createdAt ?? "",
      updatedAt: "",
    };
  }, [lines, intra, existing, company, date, partyId, party, placeOfSupply, reverseCharge, roundOff, notes, priceList, billKind, salesman, poNumber, transport, ewayBill]);

  const totals = invoiceTotals(preview);

  function patchLine(id: string, patch: Partial<InvoiceLine>) {
    setLines((prev) => {
      let changed = false;
      const next = prev.map((l) => {
        if (l.id !== id) return l;
        const merged = { ...l, ...patch };
        if (patch.qty !== undefined || patch.freeQty !== undefined) {
          const room = roomFor(l, prev);
          let qty = Math.max(0, merged.qty);
          let freeQty = Math.max(0, merged.freeQty);
          if (qty + freeQty > room) {
            if (patch.qty !== undefined) {
              qty = Math.min(qty, room);
              freeQty = Math.min(freeQty, Math.max(0, room - qty));
            } else {
              freeQty = Math.min(freeQty, room);
              qty = Math.min(qty, Math.max(0, room - freeQty));
            }
            toast.error(`${l.name || "Item"}: only ${room} left in stock`);
          }
          merged.qty = qty;
          merged.freeQty = freeQty;
        }
        if (
          merged.name === l.name &&
          merged.hsn === l.hsn &&
          merged.batch === l.batch &&
          merged.expiry === l.expiry &&
          merged.qty === l.qty &&
          merged.freeQty === l.freeQty &&
          merged.rate === l.rate &&
          merged.discount === l.discount &&
          merged.gstRate === l.gstRate &&
          merged.pack === l.pack
        ) {
          return l;
        }
        changed = true;
        return reline(merged, intra);
      });
      return changed ? next : prev;
    });
  }

  function addProduct(p: Product) {
    const have = onHand(p.id);
    if (have <= 0) {
      toast.error(`${p.name} is out of stock`);
      return;
    }
    setLines((prev) => {
      const used = prev.filter((l) => l.productId === p.id).reduce((s, l) => s + l.qty + l.freeQty, 0);
      const room = Math.max(0, have - used);
      if (room <= 0) {
        toast.error(`${p.name}: already using all ${have} in stock`);
        return prev;
      }
      const next = prev.filter((l) => l.productId || l.name);
      const line = fromProduct(p, intra, priceList);
      line.qty = Math.min(1, room);
      return [...next, reline(line, intra)];
    });
  }

  function persist(as: "draft" | "issued") {
    if (!partyId) {
      toast.error("Choose a customer first.");
      return;
    }
    const filled = lines.filter((l) => l.name && (l.qty > 0 || l.freeQty > 0));
    if (filled.length === 0) {
      toast.error("Add at least one item.");
      return;
    }
    const draft: InvoiceDraft = {
      id: existing?.id ?? crypto.randomUUID(),
      date,
      partyId,
      party: preview.party,
      company: preview.company,
      placeOfSupply,
      reverseCharge,
      priceList,
      billKind,
      salesman,
      poNumber,
      transport,
      ewayBill,
      transportCharges: existing?.transportCharges ?? 0,
      otherCharges: existing?.otherCharges ?? 0,
      creditApplied: existing?.creditApplied ?? 0,
      lines: filled.map((l) => reline({ ...l, priceList }, intra)),
      roundOff,
      notes,
      paidAmount: existing?.paidAmount ?? 0,
    };
    try {
      const saved = saveInvoice(draft, as);
      if (quoteId) markQuoteOrdered(quoteId, saved.id);
      toast.success(as === "issued" ? `Issued ${saved.number}` : "Draft saved");
      void navigate({ to: "/invoices/$id", params: { id: saved.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  const form = (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Customer</Label>
          <PartyPicker
            value={partyId}
            onChange={(id, p) => {
              const list = priceListForChannel(p.channel);
              const nextIntra = isIntraState(company.stateCode, p.stateCode);
              setPartyId(id);
              setPlaceOfSupply(p.stateCode);
              setPriceList(list);
              setBillKind(p.channel === "walkin" ? "cash" : "credit");
              setLines((prev) => applyList(prev, list, nextIntra));
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-date">Invoice date</Label>
          <Input id="inv-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Place of supply</Label>
          <Select value={placeOfSupply} onValueChange={setPlaceOfSupply}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INDIAN_STATES.map((s) => (
                <SelectItem key={s.code} value={s.code}>
                  {s.code} — {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Price list</Label>
          <Select
            value={priceList}
            onValueChange={(v) => {
              const list = v as PriceList;
              setPriceList(list);
              setLines((prev) => applyList(prev, list, intra));
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pts">PTS — stockist</SelectItem>
              <SelectItem value="ptr">PTR — retailer / hospital</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            {party
              ? `${channelLabel(party.channel)} defaults to ${priceListLabel(priceListForChannel(party.channel))}.`
              : "Stockists bill at PTS; retailers, hospitals and walk-in at PTR."}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={reverseCharge} onCheckedChange={(v) => setReverseCharge(Boolean(v))} />
          Reverse charge applicable
        </label>
        <div className="space-y-1.5">
          <Label>Cash / credit</Label>
          <Select value={billKind} onValueChange={(v) => setBillKind(v as BillKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="credit">Credit bill</SelectItem>
              <SelectItem value="cash">Cash bill</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="salesman">Salesman</Label>
          <Input id="salesman" value={salesman} onChange={(e) => setSalesman(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="po">P.O. number</Label>
          <Input id="po" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-transport">Transport</Label>
          <Input id="inv-transport" placeholder="VRL" value={transport} onChange={(e) => setTransport(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-eway">E-way bill</Label>
          <Input id="inv-eway" value={ewayBill} onChange={(e) => setEwayBill(e.target.value)} />
        </div>
      </div>

      <div className="rounded-xl bg-secondary/60 px-3 py-2 text-xs">
        {gstModeCaption(company.stateCode, placeOfSupply)}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Items</Label>
          <ProductPicker onSelect={addProduct} priceList={priceList} />
        </div>
        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div key={line.id} className="rounded-xl bg-secondary/50 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">#{idx + 1}</p>
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
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label>Particulars</Label>
                  <Input value={line.name} onChange={(e) => patchLine(line.id, { name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>HSN</Label>
                  <Input value={line.hsn} onChange={(e) => patchLine(line.id, { hsn: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Batch</Label>
                    <Input value={line.batch} onChange={(e) => patchLine(line.id, { batch: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Expiry</Label>
                    <Input type="date" value={line.expiry} onChange={(e) => patchLine(line.id, { expiry: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                  <div className="space-y-1">
                    <Label>Qty {line.productId ? <span className="font-normal text-muted-foreground">(stock {roomFor(line, lines)}{line.batch ? ` · ${line.batch}` : ""})</span> : null}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={line.productId ? roomFor(line, lines) : undefined}
                      value={line.qty}
                      onChange={(e) => patchLine(line.id, { qty: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Free {line.productId ? <span className="font-normal text-muted-foreground">(max {Math.max(0, roomFor(line, lines) - line.qty)})</span> : null}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={line.productId ? Math.max(0, roomFor(line, lines) - line.qty) : undefined}
                      value={line.freeQty}
                      onChange={(e) => patchLine(line.id, { freeQty: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>MRP</Label>
                    <div className="flex h-11 items-center rounded-md border border-transparent px-3 text-sm tabular-nums">
                      ₹{line.mrp.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                  <div className="rounded-lg bg-background/70 px-3 py-2 text-[11px] text-muted-foreground">
                    PTS {line.ptsPercent ? `${line.ptsPercent.toFixed(1)}%` : "—"} · ₹{line.pts.toFixed(2)}
                  </div>
                  <div className="rounded-lg bg-background/70 px-3 py-2 text-[11px] text-muted-foreground">
                    PTR {line.ptrPercent ? `${line.ptrPercent.toFixed(1)}%` : "—"} · ₹{line.ptr.toFixed(2)}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                  <div className="space-y-1">
                    <Label>{priceListLabel(priceList)} rate</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.rate}
                      onChange={(e) => patchLine(line.id, { rate: Number(e.target.value) })}
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
                <div className="sm:col-span-2">
                  <Label>Line total</Label>
                  <div className="flex h-11 items-center rounded-md border border-transparent px-3 text-sm tabular-nums">
                    ₹{(line.taxable + line.cgst + line.sgst + line.igst).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" onClick={() => setLines((prev) => [...prev, emptyLine(priceList)])}>
          <Plus className="size-4" />
          Blank line
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="round">Round off</Label>
          <Input
            id="round"
            type="number"
            step="0.01"
            value={roundOff}
            onChange={(e) => setRoundOff(Number(e.target.value))}
          />
        </div>
        <div className="rounded-xl bg-secondary/70 p-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Taxable</span>
            <span className="tabular-nums">₹{totals.taxable.toFixed(2)}</span>
          </div>
          {totals.cgst > 0 ? (
            <div className="flex justify-between text-muted-foreground">
              <span>CGST / SGST</span>
              <span className="tabular-nums">
                ₹{totals.cgst.toFixed(2)} / ₹{totals.sgst.toFixed(2)}
              </span>
            </div>
          ) : null}
          {totals.igst > 0 ? (
            <div className="flex justify-between text-muted-foreground">
              <span>IGST</span>
              <span className="tabular-nums">₹{totals.igst.toFixed(2)}</span>
            </div>
          ) : null}
          <div className="mt-1 flex justify-between font-medium">
            <span>Grand total</span>
            <span className="tabular-nums">₹{totals.grand.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" asChild>
          <Link to="/invoices">Cancel</Link>
        </Button>
        <Button variant="secondary" onClick={() => persist("draft")}>
          Save draft
        </Button>
        <Button onClick={() => persist("issued")}>Issue invoice</Button>
      </div>
    </div>
  );

  return (
    <div className="grid gap-6">
      <div>{form}</div>
      <div>
        <InvoicePreview invoice={preview} />
      </div>
    </div>
  );
}
