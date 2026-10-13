import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PartyPicker } from "@/components/party-picker";
import { ProductPicker } from "@/components/product-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatINR, todayISO } from "@/lib/format";
import { GST_RATES, calcLine, invoiceTotals, isIntraState, round2, stateName } from "@/lib/gst";
import { priceListForChannel, priceListLabel, rateForList } from "@/lib/pricing";
import { useBillingStore } from "@/lib/store";
import type { GstRate, Party, PriceList, Product, Quote, QuoteLine } from "@/lib/types";
import { toast } from "sonner";

function plusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function taxLine(line: QuoteLine, intra: boolean): QuoteLine {
  const discount = round2((line.qty * line.rate * Math.max(0, line.discountPct)) / 100);
  return { ...line, ...calcLine({ qty: line.qty, rate: line.rate, discount, gstRate: line.gstRate, intraState: intra }) };
}

function fromProduct(p: Product, list: PriceList, intra: boolean): QuoteLine {
  const listRate = rateForList(p, list);
  return taxLine(
    {
      id: crypto.randomUUID(),
      productId: p.id,
      name: p.genericName ? `${p.name} (${p.genericName})` : p.name,
      hsn: p.hsn,
      pack: p.pack,
      unit: p.unit,
      manufacturer: p.manufacturer,
      qty: 1,
      freeQty: 0,
      mrp: p.mrp,
      listRate,
      rate: listRate,
      discountPct: 0,
      offer: "",
      gstRate: p.gstRate,
      taxable: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
    },
    intra,
  );
}

export function QuoteEditor({ existing }: { existing?: Quote }) {
  const navigate = useNavigate();
  const company = useBillingStore((s) => s.company);
  const parties = useBillingStore((s) => s.parties);
  const saveQuote = useBillingStore((s) => s.saveQuote);
  const today = todayISO();
  const [partyId, setPartyId] = useState(existing?.partyId ?? "");
  const [date, setDate] = useState(existing?.date ?? today);
  const [validUntil, setValidUntil] = useState(existing?.validUntil ?? plusDays(today, 15));
  const [placeOfSupply, setPlaceOfSupply] = useState(existing?.placeOfSupply ?? company.stateCode);
  const [priceList, setPriceList] = useState<PriceList>(existing?.priceList ?? "ptr");
  const [offerNote, setOfferNote] = useState(existing?.offerNote ?? "");
  const [reference, setReference] = useState(existing?.reference ?? "");
  const [attention, setAttention] = useState(existing?.attention ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [lines, setLines] = useState<QuoteLine[]>(existing?.lines?.length ? existing.lines : []);

  const party = parties.find((p) => p.id === partyId);
  const intra = isIntraState(company.stateCode, placeOfSupply);
  const priced = useMemo(() => lines.map((l) => taxLine(l, intra)), [lines, intra]);
  const totals = invoiceTotals({ lines: priced, roundOff: 0 });

  function chooseParty(id: string, next: Party) {
    setPartyId(id);
    setPlaceOfSupply(next.stateCode || company.stateCode);
    setPriceList(priceListForChannel(next.channel));
  }

  function patch(id: string, patch: Partial<QuoteLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function save(as: "draft" | "sent") {
    if (!party) {
      toast.error("Choose a customer first.");
      return;
    }
    try {
      const saved = saveQuote(
        {
          id: existing?.id ?? crypto.randomUUID(),
          date,
          validUntil,
          partyId,
          party: {
            name: party.name,
            kind: party.kind,
            channel: party.channel,
            gstin: party.gstin,
            drugLicense: party.drugLicense,
            addressLine1: party.addressLine1,
            addressLine2: party.addressLine2,
            city: party.city,
            stateCode: party.stateCode,
            pincode: party.pincode,
            phone: party.phone,
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
          priceList,
          reference,
          attention,
          lines: priced,
          offerNote,
          notes,
        },
        as,
      );
      toast.success(as === "sent" ? `Quotation ${saved.number}` : "Draft saved");
      void navigate({ to: "/quotes/$id", params: { id: saved.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Customer</Label>
          <PartyPicker value={partyId} channel="hospital" onChange={chooseParty} />
          <p className="text-[11px] text-muted-foreground">
            Choose a customer already on the books, or add a new hospital. Adding a customer here does not create a bill.
          </p>
          {party ? (
            <p className="text-[11px] text-muted-foreground">
              {party.city ? `${party.city}, ` : ""}
              {stateName(party.stateCode)} · {priceListLabel(priceList)} list
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label>Their reference</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Enquiry or email reference" />
        </div>
        <div className="space-y-1.5">
          <Label>Attention</Label>
          <Input value={attention} onChange={(e) => setAttention(e.target.value)} placeholder="Purchase officer or department" />
        </div>
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Valid until</Label>
          <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Price list</Label>
          <Select value={priceList} onValueChange={(v) => setPriceList(v as PriceList)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ptr">PTR — retailer / hospital</SelectItem>
              <SelectItem value="pts">PTS — stockist</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Place of supply</Label>
          <Input value={placeOfSupply} maxLength={2} onChange={(e) => setPlaceOfSupply(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label>Products</Label>
        <ProductPicker
          allowOutOfStock
          priceList={priceList}
          onSelect={(p) => setLines((prev) => [...prev, fromProduct(p, priceList, intra)])}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        List rate is {priceListLabel(priceList)}. Type a special rate, a discount, free quantity, or a short offer. A quotation does not change stock.
      </p>

      <div className="space-y-3">
        {priced.map((line, idx) => (
          <div key={line.id} className="rounded-xl bg-secondary/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">{idx + 1}. {line.name}</p>
              <Button type="button" variant="ghost" size="icon" onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label="Qty">
                <Input type="number" min={0} value={line.qty} onChange={(e) => patch(line.id, { qty: Number(e.target.value) })} />
              </Field>
              <Field label="Free offer">
                <Input type="number" min={0} value={line.freeQty} onChange={(e) => patch(line.id, { freeQty: Number(e.target.value) })} />
              </Field>
              <Field label={`${priceListLabel(priceList)} list`}>
                <Input value={line.listRate.toFixed(2)} readOnly />
              </Field>
              <Field label="Special rate">
                <Input type="number" min={0} step="0.01" value={line.rate} onChange={(e) => patch(line.id, { rate: Number(e.target.value) })} />
              </Field>
              <Field label="Discount %">
                <Input type="number" min={0} max={100} step="0.1" value={line.discountPct} onChange={(e) => patch(line.id, { discountPct: Number(e.target.value) })} />
              </Field>
              <Field label="GST %">
                <Select value={String(line.gstRate)} onValueChange={(v) => patch(line.id, { gstRate: Number(v) as GstRate })}>
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
              </Field>
              <Field label="Offer">
                <Input placeholder="10+1, launch scheme" value={line.offer} onChange={(e) => patch(line.id, { offer: e.target.value })} />
              </Field>
              <Field label="Amount">
                <Input value={formatINR(line.taxable + line.cgst + line.sgst + line.igst)} readOnly />
              </Field>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Special price or offer</Label>
          <Textarea value={offerNote} onChange={(e) => setOfferNote(e.target.value)} placeholder="Applies to this quotation only. Example: 3% extra on a 500-strip order." />
        </div>
        <div className="space-y-1.5">
          <Label>Note</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          Quoted value <span className="font-medium tabular-nums">{formatINR(totals.grand)}</span>
          <span className="text-muted-foreground"> incl. GST</span>
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => save("draft")}>
            Save draft
          </Button>
          <Button type="button" onClick={() => save("sent")}>
            Issue quotation
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-[11px] text-muted-foreground">
      {label}
      {children}
    </label>
  );
}
