import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CreditNotePreview } from "@/components/credit-note-preview";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatINR, todayISO } from "@/lib/format";
import { formatInvoiceNumber, invoiceTotals, isIntraState } from "@/lib/gst";
import { RETURN_REASONS, remainingReturnable, restocksInventory } from "@/lib/returns";
import { reline, useBillingStore } from "@/lib/store";
import type { CreditNote, CreditNoteDraft, CreditNoteLine, CreditNoteReason, Invoice } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function linesFromInvoice(
  invoice: Invoice,
  notes: CreditNote[],
  exceptNoteId: string | undefined,
  intra: boolean,
  existing?: CreditNoteLine[],
): CreditNoteLine[] {
  return invoice.lines.map((src) => {
    const prev = existing?.find((l) => l.invoiceLineId === src.id);
    const cap = remainingReturnable(invoice, notes, src.id, exceptNoteId);
    const qty = prev ? Math.min(prev.qty, cap.qty) : 0;
    const freeQty = prev ? Math.min(prev.freeQty, cap.freeQty) : 0;
    const merged = reline(
      {
        ...src,
        id: prev?.id ?? crypto.randomUUID(),
        qty,
        freeQty,
        rate: prev?.rate ?? src.rate,
        discount: prev?.discount ?? 0,
      },
      intra,
    );
    return { ...merged, invoiceLineId: src.id };
  });
}

export function CreditNoteEditor({
  existing,
  presetInvoiceId,
}: {
  existing?: CreditNote;
  presetInvoiceId?: string;
}) {
  const navigate = useNavigate();
  const company = useBillingStore((s) => s.company);
  const invoices = useBillingStore((s) => s.invoices);
  const notes = useBillingStore((s) => s.creditNotes);
  const saveCreditNote = useBillingStore((s) => s.saveCreditNote);

  const issuable = invoices.filter((i) => i.status !== "draft" && i.status !== "cancelled");
  const startId = existing?.invoiceId ?? presetInvoiceId ?? "";

  const [invoiceId, setInvoiceId] = useState(startId);
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [reason, setReason] = useState<CreditNoteReason>(existing?.reason ?? "sales_return");
  const [notesText, setNotesText] = useState(existing?.notes ?? "");
  const [roundOff, setRoundOff] = useState(existing?.roundOff ?? 0);

  const invoice = issuable.find((i) => i.id === invoiceId);
  const intra = invoice ? isIntraState(company.stateCode, invoice.placeOfSupply) : true;

  const [lines, setLines] = useState<CreditNoteLine[]>(() =>
    invoice ? linesFromInvoice(invoice, notes, existing?.id, intra, existing?.lines) : [],
  );

  useEffect(() => {
    if (!invoice) return;
    setLines((prev) =>
      prev.length ? prev : linesFromInvoice(invoice, notes, existing?.id, intra, existing?.lines),
    );
  }, [invoiceId, invoice, notes, existing, intra]);

  function selectInvoice(inv: Invoice) {
    setInvoiceId(inv.id);
    const nextIntra = isIntraState(company.stateCode, inv.placeOfSupply);
    setLines(linesFromInvoice(inv, notes, existing?.id, nextIntra, invoiceId === inv.id ? lines : undefined));
  }

  function patchLine(id: string, patch: Partial<CreditNoteLine>) {
    if (!invoice) return;
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const cap = remainingReturnable(invoice, notes, l.invoiceLineId, existing?.id);
        const qty = patch.qty !== undefined ? Math.max(0, Math.min(patch.qty, cap.qty)) : l.qty;
        const freeQty = patch.freeQty !== undefined ? Math.max(0, Math.min(patch.freeQty, cap.freeQty)) : l.freeQty;
        const merged = { ...l, ...patch, qty, freeQty };
        return { ...reline(merged, intra), invoiceLineId: l.invoiceLineId };
      }),
    );
  }

  function fillRemaining() {
    if (!invoice) return;
    setLines((prev) =>
      prev.map((l) => {
        const cap = remainingReturnable(invoice, notes, l.invoiceLineId, existing?.id);
        return { ...reline({ ...l, qty: cap.qty, freeQty: cap.freeQty }, intra), invoiceLineId: l.invoiceLineId };
      }),
    );
  }

  const preview: CreditNote = useMemo(() => {
    const filled = lines.filter((l) => l.qty > 0 || l.freeQty > 0).map((l) => ({ ...reline(l, intra), invoiceLineId: l.invoiceLineId }));
    return {
      id: existing?.id ?? "preview",
      number:
        existing?.number && existing.status !== "draft"
          ? existing.number
          : formatInvoiceNumber(company.returnPrefix, company.nextReturnNumber),
      date,
      status: existing?.status ?? "draft",
      kind: "sales_return",
      reason,
      invoiceId: invoice?.id ?? "",
      invoiceNumber: invoice?.number ?? "",
      invoiceDate: invoice?.date ?? "",
      partyId: invoice?.partyId ?? "",
      party: invoice?.party ?? {
        name: "Select invoice",
        kind: "unregistered",
        channel: "retailer",
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
      placeOfSupply: invoice?.placeOfSupply ?? company.stateCode,
      priceList: invoice?.priceList ?? "ptr",
      lines: filled,
      roundOff,
      notes: notesText,
      createdAt: existing?.createdAt ?? "",
      updatedAt: "",
    };
  }, [lines, intra, existing, company, date, reason, invoice, roundOff, notesText]);

  const totals = invoiceTotals(preview);

  function persist(as: "draft" | "issued") {
    if (!invoice) {
      toast.error("Choose the original invoice first.");
      return;
    }
    const draft: CreditNoteDraft = {
      id: existing?.id ?? crypto.randomUUID(),
      date,
      kind: "sales_return",
      reason,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      invoiceDate: invoice.date,
      partyId: invoice.partyId,
      party: invoice.party,
      company: preview.company,
      placeOfSupply: invoice.placeOfSupply,
      priceList: invoice.priceList,
      lines: lines.filter((l) => l.qty > 0 || l.freeQty > 0),
      roundOff,
      notes: notesText,
    };
    try {
      const saved = saveCreditNote(draft, as);
      toast.success(as === "issued" ? `Issued ${saved.number}` : "Draft saved");
      void navigate({ to: "/returns/$id", params: { id: saved.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <div className="grid gap-6">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Original invoice</Label>
            <InvoicePicker invoices={issuable} value={invoiceId} onChange={selectInvoice} />
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as CreditNoteReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETURN_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {restocksInventory({ kind: "sales_return", reason })
                ? "Returned quantity goes back to stock. Cannot exceed billed qty."
                : "Expired / damaged goods are not added back to stock. Quantity still cannot exceed billed qty."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cn-date">Date</Label>
            <Input id="cn-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Return items</Label>
            <Button type="button" variant="outline" size="sm" disabled={!invoice} onClick={fillRemaining}>
              Return remaining
            </Button>
          </div>
          {!invoice ? (
            <p className="rounded-xl bg-secondary/50 px-4 py-8 text-center text-sm text-muted-foreground">
              Pick an invoice to load billed quantity. Return cannot exceed what was billed.
            </p>
          ) : (
            <div className="space-y-3">
              {lines.map((line) => {
                const cap = remainingReturnable(invoice, notes, line.invoiceLineId, existing?.id);
                const src = invoice.lines.find((l) => l.id === line.invoiceLineId);
                return (
                  <div key={line.id} className="rounded-xl bg-secondary/50 p-3">
                    <p className="font-medium">{line.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Billed {src?.qty ?? 0}
                      {src?.freeQty ? ` + free ${src.freeQty}` : ""} · remaining {cap.qty}
                      {cap.freeQty ? ` + free ${cap.freeQty}` : ""} · {formatINR(line.rate)} · GST {line.gstRate}%
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="space-y-1">
                        <Label>Return qty</Label>
                        <Input
                          type="number"
                          min={0}
                          max={cap.qty}
                          value={line.qty}
                          onChange={(e) => patchLine(line.id, { qty: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Return free</Label>
                        <Input
                          type="number"
                          min={0}
                          max={cap.freeQty}
                          value={line.freeQty}
                          onChange={(e) => patchLine(line.id, { freeQty: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Rate</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.rate}
                          onChange={(e) => patchLine(line.id, { rate: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Line credit</Label>
                        <div className="flex h-11 items-center rounded-md px-3 text-sm tabular-nums">
                          {formatINR(line.taxable + line.cgst + line.sgst + line.igst)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
            <span>Return total</span>
            <span className="tabular-nums">{formatINR(totals.grand)}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cn-notes">Notes</Label>
          <Textarea id="cn-notes" value={notesText} onChange={(e) => setNotesText(e.target.value)} rows={3} />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" asChild>
            <Link to="/returns">Cancel</Link>
          </Button>
          <Button variant="secondary" onClick={() => persist("draft")}>
            Save draft
          </Button>
          <Button onClick={() => persist("issued")}>Issue return bill</Button>
        </div>
      </div>
      <CreditNotePreview note={preview} />
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
            {selected ? `${selected.number} · ${selected.party.name}` : "Search invoice"}
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
