import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { CreditNotePreview } from "@/components/credit-note-preview";
import { PartyPicker } from "@/components/party-picker";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatINR, todayISO } from "@/lib/format";
import { GST_RATES, formatInvoiceNumber, invoiceTotals, isIntraState } from "@/lib/gst";
import { CREDIT_REASONS } from "@/lib/returns";
import { reline, useBillingStore } from "@/lib/store";
import type { CreditNote, CreditNoteDraft, CreditNoteLine, CreditNoteReason, GstRate, Invoice } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function valueLine(partial: Partial<CreditNoteLine> = {}): CreditNoteLine {
  return {
    id: crypto.randomUUID(),
    invoiceLineId: "",
    productId: "",
    name: "",
    hsn: "",
    pack: "",
    unit: "Pack",
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
    priceList: "ptr",
    rate: 0,
    discount: 0,
    gstRate: 0,
    taxable: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    ...partial,
  };
}

export function CreditValueEditor({
  existing,
  presetInvoiceId,
}: {
  existing?: CreditNote;
  presetInvoiceId?: string;
}) {
  const navigate = useNavigate();
  const company = useBillingStore((s) => s.company);
  const parties = useBillingStore((s) => s.parties);
  const invoices = useBillingStore((s) => s.invoices);
  const saveCreditNote = useBillingStore((s) => s.saveCreditNote);

  const issuable = invoices.filter((i) => i.status !== "draft" && i.status !== "cancelled");
  const startInvoice = existing?.invoiceId || presetInvoiceId || "";
  const startInv = issuable.find((i) => i.id === startInvoice);

  const [partyId, setPartyId] = useState(existing?.partyId || startInv?.partyId || "");
  const [invoiceId, setInvoiceId] = useState(startInvoice);
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [reason, setReason] = useState<CreditNoteReason>(existing?.reason ?? "other");
  const [notesText, setNotesText] = useState(existing?.notes ?? "");
  const [roundOff, setRoundOff] = useState(existing?.roundOff ?? 0);
  const [particulars, setParticulars] = useState(existing?.lines[0]?.name ?? "");
  const [hsn, setHsn] = useState(existing?.lines[0]?.hsn ?? "");
  const [amount, setAmount] = useState(existing?.lines[0]?.rate ?? 0);
  const [gstRate, setGstRate] = useState<GstRate>((existing?.lines[0]?.gstRate as GstRate) ?? 0);

  const party = parties.find((p) => p.id === partyId);
  const invoice = issuable.find((i) => i.id === invoiceId);
  const place = invoice?.placeOfSupply || party?.stateCode || company.stateCode;
  const intra = isIntraState(company.stateCode, place);
  const partyInvoices = issuable.filter((i) => !partyId || i.partyId === partyId);

  const line: CreditNoteLine = useMemo(() => {
    const invoiceLineId = existing?.lines[0]?.invoiceLineId ?? "";
    return {
      ...reline(
        valueLine({
          id: existing?.lines[0]?.id || crypto.randomUUID(),
          invoiceLineId,
          name: particulars.trim() || notesText.trim() || "Value credit",
          hsn,
          qty: 1,
          rate: Math.max(0, amount),
          gstRate,
        }),
        intra,
      ),
      invoiceLineId,
    };
  }, [particulars, notesText, hsn, amount, gstRate, intra, existing]);

  const preview: CreditNote = useMemo(() => {
    const snapParty = party
      ? {
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
        }
      : existing?.party ?? {
          name: "Select customer",
          kind: "unregistered" as const,
          channel: "retailer" as const,
          gstin: "",
          drugLicense: "",
          addressLine1: "",
          addressLine2: "",
          city: "",
          stateCode: company.stateCode,
          pincode: "",
          phone: "",
        };
    return {
      id: existing?.id ?? "preview",
      number:
        existing?.number && existing.status !== "draft"
          ? existing.number
          : formatInvoiceNumber(company.creditNotePrefix, company.nextCreditNoteNumber),
      date,
      status: existing?.status ?? "draft",
      kind: "credit_note",
      reason,
      invoiceId: invoice?.id ?? "",
      invoiceNumber: invoice?.number ?? "",
      invoiceDate: invoice?.date ?? "",
      partyId: party?.id ?? existing?.partyId ?? "",
      party: snapParty,
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
      placeOfSupply: place,
      priceList: invoice?.priceList ?? "ptr",
      lines: amount > 0 ? [line] : [],
      roundOff,
      notes: notesText,
      createdAt: existing?.createdAt ?? "",
      updatedAt: "",
    };
  }, [party, existing, company, date, reason, invoice, place, amount, line, roundOff, notesText]);

  const totals = invoiceTotals(preview);

  function persist(as: "draft" | "issued") {
    if (!party && !preview.party.name) {
      toast.error("Choose a customer first.");
      return;
    }
    if (amount <= 0) {
      toast.error("Enter the credit amount.");
      return;
    }
    const draft: CreditNoteDraft = {
      id: existing?.id ?? crypto.randomUUID(),
      date,
      kind: "credit_note",
      reason,
      invoiceId: invoice?.id ?? "",
      invoiceNumber: invoice?.number ?? "",
      invoiceDate: invoice?.date ?? "",
      partyId: party?.id ?? existing?.partyId ?? "",
      party: preview.party,
      company: preview.company,
      placeOfSupply: place,
      priceList: preview.priceList,
      lines: [line],
      roundOff,
      notes: notesText,
    };
    try {
      const saved = saveCreditNote(draft, as);
      toast.success(as === "issued" ? `Issued ${saved.number}` : "Draft saved");
      void navigate({ to: "/credits/$id", params: { id: saved.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Customer</Label>
            <PartyPicker
              value={partyId}
              role="customer"
              onChange={(id) => {
                setPartyId(id);
                if (invoice && invoice.partyId !== id) setInvoiceId("");
              }}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Original invoice (optional)</Label>
            <InvoicePicker
              invoices={partyInvoices}
              value={invoiceId}
              onChange={(inv) => {
                setInvoiceId(inv.id);
                setPartyId(inv.partyId);
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              Link an invoice if this credit reduces that bill. Leave blank for a standalone party credit.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as CreditNoteReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREDIT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cn-date">Date</Label>
            <Input id="cn-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cn-part">Particulars</Label>
            <Input
              id="cn-part"
              value={particulars}
              onChange={(e) => setParticulars(e.target.value)}
              placeholder="Rate difference / scheme / as per narration"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cn-amt">Taxable amount</Label>
            <Input
              id="cn-amt"
              type="number"
              min={0}
              step="0.01"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>GST %</Label>
            <Select value={String(gstRate)} onValueChange={(v) => setGstRate(Number(v) as GstRate)}>
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
            <Label htmlFor="cn-hsn">HSN (optional)</Label>
            <Input id="cn-hsn" value={hsn} onChange={(e) => setHsn(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cn-round">Round off</Label>
            <Input
              id="cn-round"
              type="number"
              step="0.01"
              value={roundOff}
              onChange={(e) => setRoundOff(Number(e.target.value))}
            />
          </div>
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
            <span>Credit total</span>
            <span className="tabular-nums">{formatINR(totals.grand)}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cn-notes">Narration</Label>
          <Textarea
            id="cn-notes"
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            rows={3}
            placeholder="Reference / UTR / remark"
          />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" asChild>
            <Link to="/credits">Cancel</Link>
          </Button>
          <Button variant="secondary" onClick={() => persist("draft")}>
            Save draft
          </Button>
          <Button onClick={() => persist("issued")}>Issue credit note</Button>
        </div>
      </div>
      <div className="xl:sticky xl:top-6">
        <CreditNotePreview note={preview} />
      </div>
    </div>
  );
}

function InvoicePicker({
  invoices,
  value,
  onChange,
}: {
  invoices: Invoice[];
  value: string;
  onChange: (invoice: Invoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = invoices.find((i) => i.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="h-11 w-full justify-between font-normal">
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? `${selected.number} · ${selected.party.name}` : "None — standalone credit"}
          </span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Number or party" />
          <CommandList>
            <CommandEmpty>No invoice found.</CommandEmpty>
            <CommandGroup>
              {invoices.map((i) => (
                <CommandItem
                  key={i.id}
                  value={`${i.number} ${i.party.name} ${i.party.gstin}`}
                  onSelect={() => {
                    onChange(i);
                    setOpen(false);
                  }}
                >
                  <div className="min-w-0">
                    <p className="truncate">
                      {i.number} · {i.party.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {formatDate(i.date)} · {formatINR(invoiceTotals(i).grand)}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
