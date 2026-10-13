import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { InvoiceEditor } from "@/components/invoice-editor";
import { todayISO } from "@/lib/format";
import { isIntraState } from "@/lib/gst";
import { reline, useBillingStore } from "@/lib/store";
import type { Invoice, InvoiceLine, Product, Quote } from "@/lib/types";

type NewSearch = { duplicate?: string; quote?: string };

export const Route = createFileRoute("/invoices/new")({
  validateSearch: (search: Record<string, unknown>): NewSearch => ({
    duplicate: typeof search.duplicate === "string" ? search.duplicate : undefined,
    quote: typeof search.quote === "string" ? search.quote : undefined,
  }),
  component: NewInvoicePage,
});

function NewInvoicePage() {
  const invoices = useBillingStore((s) => s.invoices);
  const quotes = useBillingStore((s) => s.quotes);
  const products = useBillingStore((s) => s.products);
  const company = useBillingStore((s) => s.company);
  const { duplicate, quote: quoteId } = Route.useSearch();
  const source = duplicate ? invoices.find((i) => i.id === duplicate) : undefined;
  const quote = quoteId ? quotes.find((q) => q.id === quoteId) : undefined;
  const fromQuote = useMemo(() => (quote ? quoteAsInvoice(quote, products, company.stateCode) : undefined), [quote, products, company.stateCode]);
  const existing = source
    ? {
        ...source,
        id: `copy-${source.id}`,
        number: "DRAFT",
        status: "draft" as const,
        paidAmount: 0,
        date: todayISO(),
        lines: source.lines.map((l, i) => ({ ...l, id: `copy-${source.id}-${i}` })),
      }
    : fromQuote;

  return (
    <AppShell wide>
      <div className="mb-5">
        <h1 className="font-display text-3xl">{source ? "Duplicate invoice" : quote ? "Invoice from quotation" : "New tax invoice"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {quote
            ? `Rates and offers are from ${quote.number}. Confirm the batch, then issue the bill after the hospital order.`
            : "Stockists bill at PTS, retailers and hospitals at PTR. Intra-Kerala splits CGST/SGST; other states charge IGST."}
        </p>
      </div>
      <InvoiceEditor existing={existing} quoteId={quote?.id} />
    </AppShell>
  );
}

function quoteAsInvoice(quote: Quote, products: Product[], sellerState: string): Invoice {
  const intra = isIntraState(sellerState, quote.placeOfSupply);
  const lines: InvoiceLine[] = quote.lines.map((line) => {
    const product = products.find((item) => item.id === line.productId);
    const discount = Math.round(((line.qty * line.rate * Math.max(0, line.discountPct)) / 100) * 100) / 100;
    return reline(
      {
        id: crypto.randomUUID(),
        productId: line.productId,
        name: line.name,
        hsn: line.hsn,
        pack: line.pack,
        unit: line.unit,
        manufacturer: line.manufacturer,
        batch: product?.batch ?? "",
        expiry: product?.expiry ?? "",
        qty: line.qty,
        freeQty: line.freeQty,
        mrp: line.mrp,
        pts: product?.pts ?? line.listRate,
        ptr: product?.ptr ?? line.listRate,
        ptsPercent: product?.ptsPercent ?? 0,
        ptrPercent: product?.ptrPercent ?? 0,
        priceList: quote.priceList,
        rate: line.rate,
        discount,
        gstRate: line.gstRate,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
      },
      intra,
    );
  });
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    number: "DRAFT",
    date: todayISO(),
    status: "draft",
    billKind: quote.party.channel === "walkin" ? "cash" : "credit",
    salesman: "",
    poNumber: "",
    transport: "",
    ewayBill: "",
    partyId: quote.partyId,
    party: quote.party,
    company: quote.company,
    placeOfSupply: quote.placeOfSupply,
    reverseCharge: false,
    priceList: quote.priceList,
    lines,
    transportCharges: 0,
    otherCharges: 0,
    creditApplied: 0,
    roundOff: 0,
    notes: [`Against quotation ${quote.number}.`, quote.offerNote, quote.notes].filter(Boolean).join(" "),
    paidAmount: 0,
    createdAt: now,
    updatedAt: now,
  };
}
