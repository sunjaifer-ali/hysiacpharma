import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { todayISO } from "./format";
import { calcLine, formatInvoiceNumber, invoiceTotals, isIntraState, round2 } from "./gst";
import { normalizeProduct, priceListForChannel } from "./pricing";
import { invoiceNetDue, remainingReturnable } from "./returns";
import { unitsOnHand } from "./registers";
import { applyPurchaseLots, assignItemFamilies, familyOf, sameLot, asLot } from "./lots";
import {
  DEFAULT_COMPANY,
} from "./seed";
import type {
  CompanyProfile,
  CreditNote,
  CreditNoteDraft,
  CreditNoteStatus,
  Invoice,
  InvoiceDraft,
  InvoiceLine,
  InvoiceStatus,
  LedgerPayment,
  OpeningDue,
  Party,
  Product,
  Purchase,
  PurchaseDraft,
  PurchaseOrder,
  PurchaseOrderDraft,
  PurchaseOrderStatus,
  PurchaseStatus,
  Quote,
  QuoteDraft,
  RecycleEntry,
  StockAdjustment,
  TradeChannel,
} from "./types";

type BillingState = {
  company: CompanyProfile;
  products: Product[];
  parties: Party[];
  invoices: Invoice[];
  purchases: Purchase[];
  purchaseOrders: PurchaseOrder[];
  quotes: Quote[];
  creditNotes: CreditNote[];
  payments: LedgerPayment[];
  adjustments: StockAdjustment[];
  openingDues: OpeningDue[];
  bin: RecycleEntry[];
  updateCompany: (patch: Partial<CompanyProfile>) => void;
  upsertProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  upsertParty: (party: Party) => void;
  deleteParty: (id: string) => void;
  saveInvoice: (draft: InvoiceDraft, as: "draft" | "issued") => Invoice;
  setInvoiceStatus: (id: string, status: InvoiceStatus) => void;
  recordPayment: (id: string, amount: number, meta?: { date?: string; mode?: LedgerPayment["mode"]; reference?: string }) => LedgerPayment | undefined;
  recordPurchasePayment: (id: string, amount: number, meta?: { date?: string; mode?: LedgerPayment["mode"]; reference?: string }) => LedgerPayment | undefined;
  deletePayment: (id: string) => void;
  savePurchase: (draft: PurchaseDraft, as: "draft" | "posted") => Purchase;
  setPurchaseStatus: (id: string, status: PurchaseStatus) => void;
  savePurchaseOrder: (draft: PurchaseOrderDraft, as: "draft" | "sent") => PurchaseOrder;
  setPurchaseOrderStatus: (id: string, status: PurchaseOrderStatus) => void;
  deletePurchaseOrder: (id: string) => void;
  saveQuote: (draft: QuoteDraft, as: "draft" | "sent") => Quote;
  markQuoteOrdered: (id: string, invoiceId: string) => void;
  deleteQuote: (id: string) => void;
  saveCreditNote: (draft: CreditNoteDraft, as: "draft" | "issued") => CreditNote;
  setCreditNoteStatus: (id: string, status: CreditNoteStatus) => void;
  deleteInvoice: (id: string) => void;
  deletePurchase: (id: string) => void;
  setOpeningStock: (productId: string, qty: number, date: string) => void;
  saveAdjustment: (input: { productId: string; qty: number; date: string; reason: StockAdjustment["reason"]; note: string }) => StockAdjustment;
  deleteAdjustment: (id: string) => void;
  saveOpeningDue: (input: { partyId: string; kind: OpeningDue["kind"]; date: string; amount: number }) => OpeningDue;
  settleOpeningDue: (id: string, amount: number, meta?: { date?: string; mode?: LedgerPayment["mode"]; reference?: string }) => LedgerPayment | undefined;
  deleteOpeningDue: (id: string) => void;
  restoreBin: (id: string) => void;
  purgeBin: (id: string) => void;
  emptyBin: () => void;
  resetDemo: () => void;
  replaceAll: (data: {
    company: CompanyProfile;
    products: Product[];
    parties: Party[];
    invoices: Invoice[];
    purchases: Purchase[];
    purchaseOrders: PurchaseOrder[];
    quotes?: Quote[];
    creditNotes: CreditNote[];
    payments?: LedgerPayment[];
    adjustments?: StockAdjustment[];
    openingDues?: OpeningDue[];
    bin?: RecycleEntry[];
  }) => void;
};

function companySnap(c: CompanyProfile) {
  return {
    legalName: c.legalName,
    tradeName: c.tradeName,
    gstin: c.gstin,
    cin: c.cin,
    drugLicense: c.drugLicense,
    drugLicenseValidUpto: c.drugLicenseValidUpto,
    addressLine1: c.addressLine1,
    addressLine2: c.addressLine2,
    city: c.city,
    stateCode: c.stateCode,
    pincode: c.pincode,
    phone: c.phone,
    email: c.email,
    bankName: c.bankName,
    bankAccount: c.bankAccount,
    bankIfsc: c.bankIfsc,
    bankBranch: c.bankBranch,
    signatory: c.signatory,
  };
}

function partySnap(p: Party) {
  return {
    name: p.name,
    kind: p.kind,
    channel: p.channel,
    gstin: p.gstin,
    drugLicense: p.drugLicense ?? "",
    addressLine1: p.addressLine1,
    addressLine2: p.addressLine2,
    city: p.city,
    stateCode: p.stateCode,
    pincode: p.pincode,
    phone: p.phone,
  };
}

export function reline(line: InvoiceLine, intra: boolean): InvoiceLine {
  const tax = calcLine({
    qty: line.qty,
    rate: line.rate,
    discount: line.discount,
    gstRate: line.gstRate,
    intraState: intra,
  });
  return { ...line, ...tax };
}

export function relinePurchase(line: Purchase["lines"][number], intra: boolean) {
  const tax = calcLine({
    qty: line.qty,
    rate: line.purchaseRate,
    discount: line.discount ?? 0,
    gstRate: line.gstRate,
    intraState: intra,
  });
  return { ...line, ...tax };
}

function normalizeParty(raw: Party): Party {
  const channel: TradeChannel =
    raw.channel ?? (raw.kind === "unregistered" ? "walkin" : "retailer");
  return {
    ...raw,
    channel,
    drugLicense: raw.drugLicense ?? "",
    isCustomer: raw.isCustomer ?? true,
    isSupplier: raw.isSupplier ?? false,
  };
}

function overlaySeller(c: Invoice["company"]): Invoice["company"] {
  const oldBank = c.bankName === "Federal Bank" || c.bankAccount === "18990100012345" || !c.bankAccount;
  return {
    ...c,
    phone: c.phone === "9965080431" || !c.phone ? DEFAULT_COMPANY.phone : c.phone,
    bankName: oldBank ? DEFAULT_COMPANY.bankName : c.bankName,
    bankAccount: oldBank ? DEFAULT_COMPANY.bankAccount : c.bankAccount,
    bankIfsc: oldBank ? DEFAULT_COMPANY.bankIfsc : c.bankIfsc,
    bankBranch: oldBank ? DEFAULT_COMPANY.bankBranch : c.bankBranch || DEFAULT_COMPANY.bankBranch,
  };
}

function normalizeInvoice(inv: Invoice): Invoice {
  const channel = inv.party?.channel ?? "retailer";
  return {
    ...inv,
    billKind: inv.billKind ?? "credit",
    salesman: inv.salesman ?? "",
    poNumber: inv.poNumber ?? "",
    transport: inv.transport ?? "",
    ewayBill: inv.ewayBill ?? "",
    transportCharges: inv.transportCharges ?? 0,
    otherCharges: inv.otherCharges ?? 0,
    creditApplied: inv.creditApplied ?? 0,
    priceList: inv.priceList ?? priceListForChannel(channel),
    party: { ...inv.party, channel, drugLicense: inv.party?.drugLicense ?? "" },
    company: overlaySeller(inv.company),
    lines: inv.lines.map((l) => ({
      ...l,
      manufacturer: l.manufacturer ?? "",
      pts: l.pts ?? l.rate,
      ptr: l.ptr ?? l.rate,
      ptsPercent: l.ptsPercent ?? 0,
      ptrPercent: l.ptrPercent ?? 0,
      priceList: l.priceList ?? inv.priceList ?? "pts",
    })),
  };
}

function normalizePurchaseLine(l: Purchase["lines"][number]): Purchase["lines"][number] {
  return {
    ...l,
    manufacturer: l.manufacturer ?? "",
    mfgDate: l.mfgDate ?? "",
    discount: l.discount ?? 0,
  };
}

function normalizePurchase(p: Purchase): Purchase {
  return {
    ...p,
    challanNo: p.challanNo ?? p.billNo ?? "",
    lrNumber: p.lrNumber ?? "",
    lrDate: p.lrDate ?? "",
    transport: p.transport ?? "",
    ewayBill: p.ewayBill ?? "",
    cases: p.cases ?? 0,
    paidAmount: p.paidAmount ?? 0,
    supplier: { ...p.supplier, drugLicense: p.supplier?.drugLicense ?? "" },
    lines: p.lines.map((l) => {
      const n = normalizePurchaseLine(l);
      if (p.id === "pur-3" && l.productId === "p-ferrobest" && n.qty < 800) {
        return { ...n, qty: 900 };
      }
      return n;
    }),
  };
}

function normalizePurchaseOrder(order: PurchaseOrder): PurchaseOrder {
  return {
    ...order,
    neededBy: order.neededBy ?? "",
    notes: order.notes ?? "",
    status: order.status ?? "draft",
    supplier: { ...order.supplier, drugLicense: order.supplier?.drugLicense ?? "" },
    lines: (order.lines ?? []).map((line) => ({
      ...line,
      pack: line.pack ?? "",
      unit: line.unit || "Strip",
      manufacturer: line.manufacturer ?? "",
      qty: Number(line.qty) || 0,
      note: line.note ?? "",
    })),
  };
}

function composeDrugLicense(c: { drugLicense20?: string; drugLicense21?: string; drugLicense?: string }) {
  const parts = [c.drugLicense20, c.drugLicense21].map((s) => s?.trim()).filter(Boolean) as string[];
  if (parts.length) return parts.join(", ");
  return c.drugLicense?.trim() ?? "";
}

function normalizeCompany(c: CompanyProfile): CompanyProfile {
  const oldSeed = !c.drugLicense20 && !c.drugLicense21 && (c.drugLicense ?? "").includes("KL-MLP-15118");
  let drugLicense20 = c.drugLicense20 ?? "";
  let drugLicense21 = c.drugLicense21 ?? "";
  if (oldSeed || (!drugLicense20 && !drugLicense21 && !c.drugLicense)) {
    drugLicense20 = DEFAULT_COMPANY.drugLicense20;
    drugLicense21 = DEFAULT_COMPANY.drugLicense21;
  } else if (!drugLicense20 && !drugLicense21 && c.drugLicense) {
    const [a, b] = c.drugLicense.split(",").map((s) => s.trim());
    drugLicense20 = a ?? "";
    drugLicense21 = b ?? "";
  }
  const oldBank = c.bankName === "Federal Bank" || c.bankAccount === "18990100012345" || !c.bankAccount;
  return {
    ...c,
    purchasePrefix: c.purchasePrefix ?? "HY/PUR/2627/",
    nextPurchaseNumber: c.nextPurchaseNumber ?? 1,
    purchaseOrderPrefix: c.purchaseOrderPrefix ?? "HY/PO/2627/",
    nextPurchaseOrderNumber: c.nextPurchaseOrderNumber ?? 1,
    returnPrefix: c.returnPrefix ?? "HY/RET/2627/",
    nextReturnNumber: c.nextReturnNumber ?? 1,
    creditNotePrefix: c.creditNotePrefix ?? "HY/CN/2627/",
    nextCreditNoteNumber: c.nextCreditNoteNumber ?? 1,
    quotePrefix: c.quotePrefix ?? "HY/QT/2627/",
    nextQuoteNumber: c.nextQuoteNumber ?? 1,
    receiptPrefix: c.receiptPrefix ?? "HY/RC/2627/",
    nextReceiptNumber: c.nextReceiptNumber ?? 1,
    paymentVoucherPrefix: c.paymentVoucherPrefix ?? "HY/PV/2627/",
    nextPaymentVoucherNumber: c.nextPaymentVoucherNumber ?? 1,
    salesman: c.salesman ?? "DIRECT",
    drugLicense20,
    drugLicense21,
    drugLicenseValidUpto: c.drugLicenseValidUpto || DEFAULT_COMPANY.drugLicenseValidUpto,
    drugLicense: composeDrugLicense({ drugLicense20, drugLicense21, drugLicense: c.drugLicense }),
    phone: c.phone === "9965080431" || !c.phone ? DEFAULT_COMPANY.phone : c.phone,
    bankName: oldBank ? DEFAULT_COMPANY.bankName : c.bankName,
    bankAccount: oldBank ? DEFAULT_COMPANY.bankAccount : c.bankAccount,
    bankIfsc: oldBank ? DEFAULT_COMPANY.bankIfsc : c.bankIfsc,
    bankBranch: oldBank ? DEFAULT_COMPANY.bankBranch : c.bankBranch || DEFAULT_COMPANY.bankBranch,
  };
}

type Persisted = Partial<BillingState> & {
  company?: CompanyProfile;
  products?: Product[];
  parties?: Party[];
  invoices?: Invoice[];
  purchases?: Purchase[];
  purchaseOrders?: PurchaseOrder[];
  quotes?: Quote[];
  creditNotes?: CreditNote[];
  payments?: LedgerPayment[];
  adjustments?: StockAdjustment[];
  openingDues?: OpeningDue[];
  bin?: RecycleEntry[];
};

export function normalizeBooks(data: Persisted): {
  company: CompanyProfile;
  products: Product[];
  parties: Party[];
  invoices: Invoice[];
  purchases: Purchase[];
  purchaseOrders: PurchaseOrder[];
  quotes: Quote[];
  creditNotes: CreditNote[];
  payments: LedgerPayment[];
  adjustments: StockAdjustment[];
  openingDues: OpeningDue[];
  bin: RecycleEntry[];
} {
  const invoices = (data.invoices ?? []).map(normalizeInvoice);
  const parties = (data.parties ?? []).map(normalizeParty);
  const products = assignItemFamilies((data.products ?? []).map(normalizeProduct));
  const purchases = (Array.isArray(data.purchases) ? data.purchases : []).map(normalizePurchase);
  const purchaseOrders = (Array.isArray(data.purchaseOrders) ? data.purchaseOrders : []).map(normalizePurchaseOrder);
  const company = normalizeCompany(data.company ?? DEFAULT_COMPANY);
  const maxPur = purchases.reduce((n, p) => {
    const m = Number((p.number ?? "").split("/").pop());
    return Number.isFinite(m) ? Math.max(n, m) : n;
  }, 0);
  if (maxPur >= company.nextPurchaseNumber) {
    company.nextPurchaseNumber = maxPur + 1;
  }
  const maxPo = purchaseOrders.reduce((n, p) => {
    const m = Number((p.number ?? "").split("/").pop());
    return Number.isFinite(m) ? Math.max(n, m) : n;
  }, 0);
  if (maxPo >= company.nextPurchaseOrderNumber) {
    company.nextPurchaseOrderNumber = maxPo + 1;
  }
  const maxInv = invoices.reduce((n, i) => {
    const m = Number((i.number ?? "").split("/").pop());
    return Number.isFinite(m) ? Math.max(n, m) : n;
  }, 0);
  if (maxInv >= company.nextNumber) {
    company.nextNumber = maxInv + 1;
  }
  const quotes = (Array.isArray(data.quotes) ? data.quotes : []).map((q) => ({
    ...q,
    reference: q.reference ?? "",
    attention: q.attention ?? "",
    offerNote: q.offerNote ?? "",
    notes: q.notes ?? "",
  }));
  const maxQt = quotes.reduce((n, q) => {
    const m = Number((q.number ?? "").split("/").pop());
    return Number.isFinite(m) ? Math.max(n, m) : n;
  }, 0);
  if (maxQt >= (company.nextQuoteNumber ?? 1)) company.nextQuoteNumber = maxQt + 1;
  const numbered = assignPaymentNumbers(Array.isArray(data.payments) ? data.payments : [], company);
  return {
    company: numbered.company,
    products,
    parties,
    invoices,
    purchases,
    purchaseOrders,
    quotes,
    creditNotes: Array.isArray(data.creditNotes)
      ? data.creditNotes.map((n) => ({ ...n, company: overlaySeller(n.company) }))
      : [],
    payments: numbered.payments,
    adjustments: Array.isArray(data.adjustments) ? data.adjustments : [],
    openingDues: Array.isArray(data.openingDues) ? data.openingDues : [],
    bin: Array.isArray(data.bin) ? data.bin : [],
  };
}

function assignPaymentNumbers(rows: LedgerPayment[], company: CompanyProfile): { payments: LedgerPayment[]; company: CompanyProfile } {
  let receiptSeq = company.nextReceiptNumber ?? 1;
  let paymentSeq = company.nextPaymentVoucherNumber ?? 1;
  const receiptPrefix = company.receiptPrefix ?? "HY/RC/2627/";
  const paymentPrefix = company.paymentVoucherPrefix ?? "HY/PV/2627/";
  const payments = [...rows]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((row) => {
      if (row.number) {
        const n = Number(String(row.number).split("/").pop());
        if (Number.isFinite(n)) {
          if (row.kind === "receipt") receiptSeq = Math.max(receiptSeq, n + 1);
          else paymentSeq = Math.max(paymentSeq, n + 1);
        }
        return row;
      }
      if (row.kind === "receipt") return { ...row, number: formatInvoiceNumber(receiptPrefix, receiptSeq++) };
      return { ...row, number: formatInvoiceNumber(paymentPrefix, paymentSeq++) };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    payments,
    company: {
      ...company,
      receiptPrefix,
      paymentVoucherPrefix: paymentPrefix,
      nextReceiptNumber: receiptSeq,
      nextPaymentVoucherNumber: paymentSeq,
    },
  };
}

type BinDraft = {
  [K in RecycleEntry["kind"]]: Omit<Extract<RecycleEntry, { kind: K }>, "id" | "deletedAt">;
}[RecycleEntry["kind"]];

function binItem(entry: BinDraft): RecycleEntry {
  return { ...entry, id: crypto.randomUUID(), deletedAt: new Date().toISOString() } as RecycleEntry;
}

export const useBillingStore = create<BillingState>()(
  persist(
    (set, get) => ({
      company: DEFAULT_COMPANY,
      products: [],
      parties: [],
      invoices: [],
      purchases: [],
      purchaseOrders: [],
      quotes: [],
      creditNotes: [],
      payments: [],
      adjustments: [],
      openingDues: [],
      bin: [],
      updateCompany: (patch) => set({ company: normalizeCompany({ ...get().company, ...patch }) }),
      upsertProduct: (product) => {
        const saved = normalizeProduct(product);
        const others = get().products.filter((p) => p.id !== saved.id);
        const family = familyOf(others, saved);
        if (family.length) saved.itemId = family[0]!.itemId || family[0]!.id;
        const clash = family.find((p) => sameLot(asLot(p), asLot(saved)));
        if (clash) {
          throw new Error(
            `${saved.name} already has this lot (batch ${clash.batch || "—"}, MRP ${clash.mrp.toFixed(2)}). Open a new batch if MRP or details changed.`,
          );
        }
        set({
          products: get().products.some((p) => p.id === saved.id)
            ? get().products.map((p) => (p.id === saved.id ? saved : p))
            : [saved, ...get().products],
        });
      },
      deleteProduct: (id) => {
        const product = get().products.find((p) => p.id === id);
        if (!product) return;
        set({
          products: get().products.filter((p) => p.id !== id),
          bin: [binItem({ kind: "product", title: product.name, subtitle: product.batch || product.pack, product }), ...get().bin],
        });
      },
      upsertParty: (party) =>
        set({
          parties: get().parties.some((p) => p.id === party.id)
            ? get().parties.map((p) => (p.id === party.id ? normalizeParty(party) : p))
            : [normalizeParty(party), ...get().parties],
        }),
      deleteParty: (id) => {
        const party = get().parties.find((p) => p.id === id);
        if (!party) return;
        set({
          parties: get().parties.filter((p) => p.id !== id),
          bin: [binItem({ kind: "party", title: party.name, subtitle: party.gstin || party.city, party }), ...get().bin],
        });
      },
      saveInvoice: (draft, as) => {
        const state = get();
        const party = state.parties.find((p) => p.id === draft.partyId);
        if (!party) throw new Error("Select a customer before saving.");
        const existing = draft.id ? state.invoices.find((i) => i.id === draft.id) : undefined;
        const issuing = as === "issued";
        let number = existing?.number ?? "";
        let nextNumber = state.company.nextNumber;
        if (issuing && (!existing || existing.status === "draft" || number === "DRAFT")) {
          number = formatInvoiceNumber(state.company.invoicePrefix, nextNumber);
          nextNumber += 1;
        }
        const intra = isIntraState(state.company.stateCode, draft.placeOfSupply || party.stateCode);
        const lines = draft.lines.map((l) => reline(l, intra));
        if (issuing) {
          const need = new Map<string, { name: string; qty: number }>();
          for (const l of lines) {
            const key = l.productId;
            if (!key) continue;
            const cur = need.get(key) ?? { name: l.name, qty: 0 };
            cur.qty += l.qty + l.freeQty;
            need.set(key, cur);
          }
          for (const [productId, v] of need) {
            const have = unitsOnHand(
              state.products,
              state.purchases,
              state.invoices,
              state.creditNotes,
              productId,
              existing?.id,
              state.adjustments,
            );
            if (v.qty > have + 0.0001) {
              throw new Error(`${v.name}: only ${have} in stock (this bill needs ${v.qty}).`);
            }
          }
        }
        const paid = existing?.paidAmount ?? 0;
        const credited = state.creditNotes
          .filter((n) => n.status === "issued" && n.invoiceId === (existing?.id ?? draft.id))
          .reduce((s, n) => s + invoiceTotals(n).grand, 0);
        const net = invoiceTotals({
          lines,
          roundOff: draft.roundOff,
          transportCharges: draft.transportCharges,
          otherCharges: draft.otherCharges,
          creditApplied: draft.creditApplied,
        }).grand - credited;
        let status: InvoiceStatus = "draft";
        if (issuing) {
          if (paid <= 0.009) status = "issued";
          else if (paid >= net - 0.009) status = "paid";
          else status = "partial";
        }
        const now = new Date().toISOString();
        const invoice: Invoice = {
          id: existing?.id ?? draft.id ?? crypto.randomUUID(),
          number: number || "DRAFT",
          date: draft.date || todayISO(),
          status,
          billKind: draft.billKind ?? (party.channel === "walkin" ? "cash" : "credit"),
          salesman: draft.salesman ?? state.company.salesman,
          poNumber: draft.poNumber ?? "",
          transport: draft.transport ?? "",
          ewayBill: draft.ewayBill ?? "",
          partyId: party.id,
          party: partySnap(party),
          company: companySnap(state.company),
          placeOfSupply: draft.placeOfSupply || party.stateCode,
          reverseCharge: draft.reverseCharge,
          priceList: draft.priceList ?? priceListForChannel(party.channel),
          lines,
          transportCharges: draft.transportCharges ?? 0,
          otherCharges: draft.otherCharges ?? 0,
          creditApplied: draft.creditApplied ?? 0,
          roundOff: draft.roundOff,
          notes: draft.notes,
          paidAmount: existing?.paidAmount ?? 0,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        const invoices = existing
          ? state.invoices.map((i) => (i.id === invoice.id ? invoice : i))
          : [invoice, ...state.invoices];
        set({ invoices, company: { ...state.company, nextNumber } });
        return invoice;
      },
      setInvoiceStatus: (id, status) =>
        set({
          invoices: get().invoices.map((i) => {
            if (i.id !== id) return i;
            const paidAmount = status === "paid" ? invoiceTotals(i).grand : i.paidAmount;
            return { ...i, status, paidAmount, updatedAt: new Date().toISOString() };
          }),
        }),
      recordPayment: (id, amount, meta) => {
        const state = get();
        const invoice = state.invoices.find((i) => i.id === id);
        if (!invoice || invoice.status === "draft" || invoice.status === "cancelled") return;
        const due = invoiceNetDue(invoice, state.creditNotes);
        const add = round2(Math.min(Math.max(0, amount), due));
        if (add <= 0) return;
        const paid = round2(invoice.paidAmount + add);
        const net = invoiceTotals(invoice).grand - state.creditNotes.filter((n) => n.status === "issued" && n.invoiceId === id).reduce((s, n) => s + invoiceTotals(n).grand, 0);
        const status: InvoiceStatus = paid >= net - 0.009 ? "paid" : "partial";
        const seq = state.company.nextReceiptNumber ?? 1;
        const prefix = state.company.receiptPrefix ?? "HY/RC/2627/";
        const entry: LedgerPayment = {
          id: crypto.randomUUID(),
          number: formatInvoiceNumber(prefix, seq),
          kind: "receipt",
          date: meta?.date || todayISO(),
          partyId: invoice.partyId,
          partyName: invoice.party.name,
          voucherId: invoice.id,
          voucherNumber: invoice.number,
          amount: add,
          mode: meta?.mode || "cash",
          reference: meta?.reference?.trim() || "",
          createdAt: new Date().toISOString(),
        };
        set({
          invoices: state.invoices.map((i) => (i.id === id ? { ...i, paidAmount: paid, status, updatedAt: entry.createdAt } : i)),
          payments: [entry, ...state.payments],
          company: { ...state.company, receiptPrefix: prefix, nextReceiptNumber: seq + 1 },
        });
        return entry;
      },
      recordPurchasePayment: (id, amount, meta) => {
        const state = get();
        const purchase = state.purchases.find((p) => p.id === id);
        if (!purchase || purchase.status !== "posted") return;
        const due = round2(Math.max(0, invoiceTotals(purchase).grand - (purchase.paidAmount || 0)));
        const add = round2(Math.min(Math.max(0, amount), due));
        if (add <= 0) return;
        const paid = round2((purchase.paidAmount || 0) + add);
        const seq = state.company.nextPaymentVoucherNumber ?? 1;
        const prefix = state.company.paymentVoucherPrefix ?? "HY/PV/2627/";
        const entry: LedgerPayment = {
          id: crypto.randomUUID(),
          number: formatInvoiceNumber(prefix, seq),
          kind: "payment",
          date: meta?.date || todayISO(),
          partyId: purchase.supplierId,
          partyName: purchase.supplier.name,
          voucherId: purchase.id,
          voucherNumber: purchase.billNo || purchase.number,
          amount: add,
          mode: meta?.mode || "bank",
          reference: meta?.reference?.trim() || "",
          createdAt: new Date().toISOString(),
        };
        set({
          purchases: state.purchases.map((p) => (p.id === id ? { ...p, paidAmount: paid, updatedAt: entry.createdAt } : p)),
          payments: [entry, ...state.payments],
          company: { ...state.company, paymentVoucherPrefix: prefix, nextPaymentVoucherNumber: seq + 1 },
        });
        return entry;
      },
      deletePayment: (id) => {
        const state = get();
        const entry = state.payments.find((p) => p.id === id);
        if (!entry) return;
        if (entry.kind === "receipt") {
          set({
            payments: state.payments.filter((p) => p.id !== id),
            invoices: state.invoices.map((i) => {
              if (i.id !== entry.voucherId) return i;
              const paid = round2(Math.max(0, i.paidAmount - entry.amount));
              const credited = state.creditNotes.filter((n) => n.status === "issued" && n.invoiceId === i.id).reduce((s, n) => s + invoiceTotals(n).grand, 0);
              const net = invoiceTotals(i).grand - credited;
              let status: InvoiceStatus = i.status;
              if (i.status !== "cancelled" && i.status !== "draft") {
                status = paid >= net - 0.009 ? "paid" : paid > 0 ? "partial" : "issued";
              }
              return { ...i, paidAmount: paid, status, updatedAt: new Date().toISOString() };
            }),
            bin: [binItem({ kind: "payment", title: entry.number || "Receipt", subtitle: entry.partyName, payment: entry }), ...state.bin],
            openingDues: state.openingDues.map((d) =>
              d.id === entry.voucherId ? { ...d, paidAmount: round2(Math.max(0, (d.paidAmount || 0) - entry.amount)) } : d,
            ),
          });
          return;
        }
        set({
          payments: state.payments.filter((p) => p.id !== id),
          purchases: state.purchases.map((p) =>
            p.id === entry.voucherId
              ? { ...p, paidAmount: round2(Math.max(0, (p.paidAmount || 0) - entry.amount)), updatedAt: new Date().toISOString() }
              : p,
          ),
          bin: [binItem({ kind: "payment", title: entry.number || "Payment", subtitle: entry.partyName, payment: entry }), ...state.bin],
          openingDues: state.openingDues.map((d) =>
            d.id === entry.voucherId ? { ...d, paidAmount: round2(Math.max(0, (d.paidAmount || 0) - entry.amount)) } : d,
          ),
        });
      },
      savePurchase: (draft, as) => {
        const state = get();
        const supplier = state.parties.find((p) => p.id === draft.supplierId);
        if (!supplier) throw new Error("Select a supplier before saving.");
        const existing = draft.id ? state.purchases.find((i) => i.id === draft.id) : undefined;
        const posting = as === "posted";
        let number = existing?.number ?? "";
        let nextPurchaseNumber = state.company.nextPurchaseNumber;
        if (posting && (!existing || existing.status === "draft" || number === "DRAFT")) {
          number = formatInvoiceNumber(state.company.purchasePrefix, nextPurchaseNumber);
          nextPurchaseNumber += 1;
        }
        const intra = isIntraState(supplier.stateCode, draft.placeOfSupply || state.company.stateCode);
        const relined = draft.lines.map((l) => relinePurchase(l, intra));
        const now = new Date().toISOString();
        let products = state.products;
        let lines = relined;
        if (posting) {
          const resolved = applyPurchaseLots(products, relined);
          products = resolved.products;
          lines = resolved.lines;
        }
        const purchase: Purchase = {
          id: existing?.id ?? draft.id ?? crypto.randomUUID(),
          number: number || "DRAFT",
          date: draft.date || todayISO(),
          status: posting ? "posted" : "draft",
          supplierId: supplier.id,
          supplier: partySnap(supplier),
          company: companySnap(state.company),
          placeOfSupply: draft.placeOfSupply || state.company.stateCode,
          billNo: draft.billNo,
          billDate: draft.billDate,
          challanNo: draft.challanNo ?? draft.billNo ?? "",
          lrNumber: draft.lrNumber ?? "",
          lrDate: draft.lrDate ?? "",
          transport: draft.transport ?? "",
          ewayBill: draft.ewayBill ?? "",
          cases: draft.cases ?? 0,
          lines,
          roundOff: draft.roundOff,
          notes: draft.notes,
          paidAmount: existing?.paidAmount ?? draft.paidAmount ?? 0,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        const purchases = existing
          ? state.purchases.map((i) => (i.id === purchase.id ? purchase : i))
          : [purchase, ...state.purchases];
        set({ purchases, products, company: { ...state.company, nextPurchaseNumber } });
        return purchase;
      },
      setPurchaseStatus: (id, status) =>
        set({
          purchases: get().purchases.map((p) =>
            p.id === id ? { ...p, status, updatedAt: new Date().toISOString() } : p,
          ),
        }),
      savePurchaseOrder: (draft, as) => {
        const state = get();
        const supplier = state.parties.find((p) => p.id === draft.supplierId);
        if (!supplier) throw new Error("Select a supplier before saving.");
        const lines = draft.lines.filter((l) => l.name.trim() && l.qty > 0);
        if (lines.length === 0) throw new Error("Add at least one product and quantity.");
        const existing = draft.id ? state.purchaseOrders.find((o) => o.id === draft.id) : undefined;
        let number = existing?.number ?? "";
        let nextPurchaseOrderNumber = state.company.nextPurchaseOrderNumber;
        const sending = as === "sent";
        if (sending && (!number || number === "DRAFT")) {
          number = formatInvoiceNumber(state.company.purchaseOrderPrefix, nextPurchaseOrderNumber);
          nextPurchaseOrderNumber += 1;
        }
        const keepStatus = existing?.status === "sent" || existing?.status === "closed" ? existing.status : "draft";
        const now = new Date().toISOString();
        const order: PurchaseOrder = {
          id: existing?.id ?? crypto.randomUUID(),
          number: number || "DRAFT",
          date: draft.date || todayISO(),
          status: sending ? "sent" : keepStatus,
          supplierId: supplier.id,
          supplier: partySnap(supplier),
          company: companySnap(state.company),
          neededBy: draft.neededBy ?? "",
          notes: draft.notes ?? "",
          lines,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        const purchaseOrders = existing
          ? state.purchaseOrders.map((o) => (o.id === order.id ? order : o))
          : [order, ...state.purchaseOrders];
        set({
          purchaseOrders,
          company: { ...state.company, nextPurchaseOrderNumber },
        });
        return order;
      },
      setPurchaseOrderStatus: (id, status) =>
        set({
          purchaseOrders: get().purchaseOrders.map((o) =>
            o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o,
          ),
        }),
      deletePurchaseOrder: (id) => {
        const order = get().purchaseOrders.find((o) => o.id === id);
        if (!order) return;
        set({
          purchaseOrders: get().purchaseOrders.filter((o) => o.id !== id),
          bin: [binItem({ kind: "order", title: order.number, subtitle: order.supplier.name, order }), ...get().bin],
        });
      },
      saveQuote: (draft, as) => {
        const state = get();
        const party = state.parties.find((p) => p.id === draft.partyId);
        if (!party) throw new Error("Select a customer before saving.");
        const lines = draft.lines.filter((l) => l.name.trim() && l.qty > 0);
        if (lines.length === 0) throw new Error("Add at least one product.");
        const existing = draft.id ? state.quotes.find((q) => q.id === draft.id) : undefined;
        let number = existing?.number ?? "";
        let nextQuoteNumber = state.company.nextQuoteNumber ?? 1;
        const sending = as === "sent";
        if (sending && (!number || number === "DRAFT")) {
          number = formatInvoiceNumber(state.company.quotePrefix ?? "HY/QT/2627/", nextQuoteNumber);
          nextQuoteNumber += 1;
        }
        const now = new Date().toISOString();
        const quote: Quote = {
          id: existing?.id ?? draft.id ?? crypto.randomUUID(),
          number: number || "DRAFT",
          date: draft.date || todayISO(),
          validUntil: draft.validUntil || draft.date || todayISO(),
          status: existing?.status === "ordered" ? "ordered" : sending ? "sent" : existing?.status === "sent" ? "sent" : "draft",
          partyId: party.id,
          party: partySnap(party),
          company: companySnap(state.company),
          placeOfSupply: draft.placeOfSupply || party.stateCode,
          priceList: draft.priceList,
          reference: draft.reference?.trim() ?? "",
          attention: draft.attention?.trim() ?? "",
          lines,
          offerNote: draft.offerNote ?? "",
          notes: draft.notes ?? "",
          invoiceId: existing?.invoiceId,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        const quotes = existing ? state.quotes.map((q) => (q.id === quote.id ? quote : q)) : [quote, ...state.quotes];
        set({ quotes, company: { ...state.company, quotePrefix: state.company.quotePrefix ?? "HY/QT/2627/", nextQuoteNumber } });
        return quote;
      },
      markQuoteOrdered: (id, invoiceId) =>
        set({
          quotes: get().quotes.map((q) =>
            q.id === id ? { ...q, status: "ordered", invoiceId, updatedAt: new Date().toISOString() } : q,
          ),
        }),
      deleteQuote: (id) => {
        const quote = get().quotes.find((q) => q.id === id);
        if (!quote) return;
        set({
          quotes: get().quotes.filter((q) => q.id !== id),
          bin: [binItem({ kind: "quote", title: quote.number, subtitle: quote.party.name, quote }), ...get().bin],
        });
      },
      saveCreditNote: (draft, as) => {
        const state = get();
        const isReturn = draft.kind === "sales_return";
        const invoice = draft.invoiceId ? state.invoices.find((i) => i.id === draft.invoiceId) : undefined;
        if (isReturn && (!invoice || invoice.status === "draft" || invoice.status === "cancelled")) {
          throw new Error("Select an issued invoice to return against.");
        }
        const party =
          state.parties.find((p) => p.id === draft.partyId) ??
          (invoice ? state.parties.find((p) => p.id === invoice.partyId) : undefined);
        if (!party && !draft.party?.name) throw new Error("Select a customer.");
        const existing = draft.id ? state.creditNotes.find((n) => n.id === draft.id) : undefined;
        const issuing = as === "issued";
        let number = existing?.number ?? "";
        let nextReturnNumber = state.company.nextReturnNumber;
        let nextCreditNoteNumber = state.company.nextCreditNoteNumber;
        if (issuing && (!existing || existing.status === "draft" || number === "DRAFT")) {
          if (isReturn) {
            number = formatInvoiceNumber(state.company.returnPrefix, nextReturnNumber);
            nextReturnNumber += 1;
          } else {
            number = formatInvoiceNumber(state.company.creditNotePrefix, nextCreditNoteNumber);
            nextCreditNoteNumber += 1;
          }
        }
        const place = draft.placeOfSupply || invoice?.placeOfSupply || party?.stateCode || state.company.stateCode;
        const intra = isIntraState(state.company.stateCode, place);
        const filled = draft.lines.filter((l) => l.qty > 0 || l.freeQty > 0 || l.rate > 0 || l.taxable > 0);
        if (filled.length === 0) {
          throw new Error(isReturn ? "Enter a return quantity on at least one item." : "Enter the credit amount.");
        }
        if (isReturn && invoice) {
          for (const line of filled) {
            if (!line.invoiceLineId) continue;
            const cap = remainingReturnable(invoice, state.creditNotes, line.invoiceLineId, existing?.id);
            if (line.qty - cap.qty > 0.0001 || line.freeQty - cap.freeQty > 0.0001) {
              throw new Error(`Return qty for ${line.name} exceeds billed quantity.`);
            }
          }
        }
        const lines = filled.map((l) => ({ ...reline(l, intra), invoiceLineId: l.invoiceLineId || "" }));
        const now = new Date().toISOString();
        const note: CreditNote = {
          id: existing?.id ?? draft.id ?? crypto.randomUUID(),
          number: number || "DRAFT",
          date: draft.date || todayISO(),
          status: issuing ? "issued" : "draft",
          kind: draft.kind,
          reason: draft.reason,
          invoiceId: invoice?.id ?? draft.invoiceId ?? "",
          invoiceNumber: invoice?.number ?? draft.invoiceNumber ?? "",
          invoiceDate: invoice?.date ?? draft.invoiceDate ?? "",
          partyId: party?.id ?? draft.partyId,
          party: party ? partySnap(party) : draft.party,
          company: companySnap(state.company),
          placeOfSupply: place,
          priceList: draft.priceList ?? invoice?.priceList ?? "ptr",
          lines,
          roundOff: draft.roundOff,
          notes: draft.notes,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        const creditNotes = existing
          ? state.creditNotes.map((n) => (n.id === note.id ? note : n))
          : [note, ...state.creditNotes];
        set({
          creditNotes,
          company: { ...state.company, nextReturnNumber, nextCreditNoteNumber },
        });
        return note;
      },
      setCreditNoteStatus: (id, status) =>
        set({
          creditNotes: get().creditNotes.map((n) =>
            n.id === id ? { ...n, status, updatedAt: new Date().toISOString() } : n,
          ),
        }),
      deleteInvoice: (id) => {
        const state = get();
        const invoice = state.invoices.find((i) => i.id === id);
        if (!invoice) return;
        const creditNotes = state.creditNotes.filter((n) => n.invoiceId === id);
        const payments = state.payments.filter((p) => p.kind === "receipt" && p.voucherId === id);
        set({
          invoices: state.invoices.filter((i) => i.id !== id),
          creditNotes: state.creditNotes.filter((n) => n.invoiceId !== id),
          payments: state.payments.filter((p) => !(p.kind === "receipt" && p.voucherId === id)),
          bin: [binItem({ kind: "invoice", title: invoice.number, subtitle: invoice.party.name, invoice, creditNotes, payments }), ...state.bin],
        });
      },
      deletePurchase: (id) => {
        const state = get();
        const purchase = state.purchases.find((p) => p.id === id);
        if (!purchase) return;
        const payments = state.payments.filter((p) => p.kind === "payment" && p.voucherId === id);
        set({
          purchases: state.purchases.filter((p) => p.id !== id),
          payments: state.payments.filter((p) => !(p.kind === "payment" && p.voucherId === id)),
          bin: [binItem({ kind: "purchase", title: purchase.billNo || purchase.number, subtitle: purchase.supplier.name, purchase, payments }), ...state.bin],
        });
      },
      setOpeningStock: (productId, qty, date) => {
        const product = get().products.find((p) => p.id === productId);
        if (!product) return;
        get().upsertProduct({ ...product, openingQty: round2(Math.max(0, qty)), openingDate: date || todayISO() });
      },
      saveAdjustment: (input) => {
        const state = get();
        const product = state.products.find((p) => p.id === input.productId);
        if (!product) throw new Error("Select a product.");
        const qty = round2(Math.max(0, input.qty));
        if (qty <= 0) throw new Error("Enter the quantity to remove.");
        const have = unitsOnHand(state.products, state.purchases, state.invoices, state.creditNotes, product.id, undefined, state.adjustments);
        if (qty > have + 0.0001) throw new Error(`Only ${have} in stock.`);
        const entry: StockAdjustment = {
          id: crypto.randomUUID(),
          date: input.date || todayISO(),
          productId: product.id,
          name: product.name,
          qty,
          reason: input.reason,
          note: input.note.trim(),
          createdAt: new Date().toISOString(),
        };
        set({ adjustments: [entry, ...state.adjustments] });
        return entry;
      },
      deleteAdjustment: (id) => {
        const entry = get().adjustments.find((a) => a.id === id);
        if (!entry) return;
        set({
          adjustments: get().adjustments.filter((a) => a.id !== id),
          bin: [binItem({ kind: "adjustment", title: entry.name, subtitle: entry.reason, adjustment: entry }), ...get().bin],
        });
      },
      saveOpeningDue: (input) => {
        const state = get();
        const party = state.parties.find((p) => p.id === input.partyId);
        if (!party) throw new Error("Select a party.");
        const amount = round2(Math.max(0, input.amount));
        if (amount <= 0) throw new Error("Enter the opening amount.");
        const entry: OpeningDue = {
          id: crypto.randomUUID(),
          partyId: party.id,
          partyName: party.name,
          kind: input.kind,
          date: input.date || todayISO(),
          amount,
          paidAmount: 0,
        };
        set({ openingDues: [entry, ...state.openingDues] });
        return entry;
      },
      settleOpeningDue: (id, amount, meta) => {
        const state = get();
        const item = state.openingDues.find((d) => d.id === id);
        if (!item) return;
        const due = round2(Math.max(0, item.amount - (item.paidAmount || 0)));
        const add = round2(Math.min(Math.max(0, amount), due));
        if (add <= 0) return;
        const receipt = item.kind === "customer";
        const seq = receipt ? (state.company.nextReceiptNumber ?? 1) : (state.company.nextPaymentVoucherNumber ?? 1);
        const prefix = receipt ? (state.company.receiptPrefix ?? "HY/RC/2627/") : (state.company.paymentVoucherPrefix ?? "HY/PV/2627/");
        const entry: LedgerPayment = {
          id: crypto.randomUUID(),
          number: formatInvoiceNumber(prefix, seq),
          kind: receipt ? "receipt" : "payment",
          date: meta?.date || todayISO(),
          partyId: item.partyId,
          partyName: item.partyName,
          voucherId: item.id,
          voucherNumber: "Opening",
          amount: add,
          mode: meta?.mode || (receipt ? "cash" : "bank"),
          reference: meta?.reference?.trim() || "",
          createdAt: new Date().toISOString(),
        };
        set({
          openingDues: state.openingDues.map((d) => (d.id === id ? { ...d, paidAmount: round2((d.paidAmount || 0) + add) } : d)),
          payments: [entry, ...state.payments],
          company: receipt
            ? { ...state.company, receiptPrefix: prefix, nextReceiptNumber: seq + 1 }
            : { ...state.company, paymentVoucherPrefix: prefix, nextPaymentVoucherNumber: seq + 1 },
        });
        return entry;
      },
      deleteOpeningDue: (id) => {
        const state = get();
        const item = state.openingDues.find((d) => d.id === id);
        if (!item) return;
        const payments = state.payments.filter((p) => p.voucherId === id);
        set({
          openingDues: state.openingDues.filter((d) => d.id !== id),
          payments: state.payments.filter((p) => p.voucherId !== id),
          bin: [binItem({ kind: "opening", title: item.partyName, subtitle: item.kind, opening: item, payments }), ...state.bin],
        });
      },
      restoreBin: (id) => {
        const state = get();
        const entry = state.bin.find((item) => item.id === id);
        if (!entry) return;
        const bin = state.bin.filter((item) => item.id !== id);
        if (entry.kind === "invoice") {
          set({
            bin,
            invoices: [entry.invoice, ...state.invoices.filter((i) => i.id !== entry.invoice.id)],
            creditNotes: [...entry.creditNotes, ...state.creditNotes.filter((n) => !entry.creditNotes.some((c) => c.id === n.id))],
            payments: [...entry.payments, ...state.payments.filter((p) => !entry.payments.some((saved) => saved.id === p.id))],
          });
          return;
        }
        if (entry.kind === "purchase") {
          set({
            bin,
            purchases: [entry.purchase, ...state.purchases.filter((p) => p.id !== entry.purchase.id)],
            payments: [...entry.payments, ...state.payments.filter((p) => !entry.payments.some((saved) => saved.id === p.id))],
          });
          return;
        }
        if (entry.kind === "order") {
          set({ bin, purchaseOrders: [entry.order, ...state.purchaseOrders.filter((o) => o.id !== entry.order.id)] });
          return;
        }
        if (entry.kind === "quote") {
          set({ bin, quotes: [entry.quote, ...state.quotes.filter((q) => q.id !== entry.quote.id)] });
          return;
        }
        if (entry.kind === "product") {
          set({ bin, products: [entry.product, ...state.products.filter((p) => p.id !== entry.product.id)] });
          return;
        }
        if (entry.kind === "party") {
          set({ bin, parties: [entry.party, ...state.parties.filter((p) => p.id !== entry.party.id)] });
          return;
        }
        if (entry.kind === "adjustment") {
          set({ bin, adjustments: [entry.adjustment, ...state.adjustments.filter((a) => a.id !== entry.adjustment.id)] });
          return;
        }
        if (entry.kind === "opening") {
          set({
            bin,
            openingDues: [entry.opening, ...state.openingDues.filter((d) => d.id !== entry.opening.id)],
            payments: [...entry.payments, ...state.payments.filter((p) => !entry.payments.some((saved) => saved.id === p.id))],
          });
          return;
        }
        const pay = entry.payment;
        set({
          bin,
          payments: [pay, ...state.payments.filter((p) => p.id !== pay.id)],
          invoices:
            pay.kind === "receipt"
              ? state.invoices.map((i) => {
                  if (i.id !== pay.voucherId) return i;
                  const paid = round2(i.paidAmount + pay.amount);
                  const credited = state.creditNotes
                    .filter((n) => n.status === "issued" && n.invoiceId === i.id)
                    .reduce((s, n) => s + invoiceTotals(n).grand, 0);
                  const net = invoiceTotals(i).grand - credited;
                  const status: InvoiceStatus =
                    i.status === "cancelled" || i.status === "draft" ? i.status : paid >= net - 0.009 ? "paid" : "partial";
                  return { ...i, paidAmount: paid, status, updatedAt: new Date().toISOString() };
                })
              : state.invoices,
          purchases:
            pay.kind === "payment"
              ? state.purchases.map((p) =>
                  p.id === pay.voucherId
                    ? { ...p, paidAmount: round2((p.paidAmount || 0) + pay.amount), updatedAt: new Date().toISOString() }
                    : p,
                )
              : state.purchases,
          openingDues: state.openingDues.map((d) =>
            d.id === pay.voucherId ? { ...d, paidAmount: round2((d.paidAmount || 0) + pay.amount) } : d,
          ),
        });
      },
      purgeBin: (id) => set({ bin: get().bin.filter((item) => item.id !== id) }),
      emptyBin: () => set({ bin: [] }),
      resetDemo: () => {
        const company = get().company;
        set({
          company: {
            ...company,
            nextNumber: 1,
            nextPurchaseNumber: 1,
            nextPurchaseOrderNumber: 1,
            nextReturnNumber: 1,
            nextCreditNoteNumber: 1,
          },
          products: [],
          parties: [],
          invoices: [],
          purchases: [],
          purchaseOrders: [],
          quotes: [],
          creditNotes: [],
          payments: [],
          adjustments: [],
          openingDues: [],
          bin: [],
        });
      },
      replaceAll: (data) => set(normalizeBooks(data)),
    }),
    {
      name: "hysiac-gst-billing",
      version: 9,
      migrate: (persisted, from) => {
        const p = (persisted ?? {}) as Persisted;
        const company = normalizeCompany(p.company ?? DEFAULT_COMPANY);
        if (from < 9) {
          return {
            company: {
              ...company,
              nextNumber: 1,
              nextPurchaseNumber: 1,
              nextReturnNumber: 1,
              nextCreditNoteNumber: 1,
            },
            products: [],
            parties: [],
            invoices: [],
            purchases: [],
            creditNotes: [],
          };
        }
        return persisted as Persisted;
      },
      merge: (persisted, current) => {
        const books = normalizeBooks((persisted ?? {}) as Persisted);
        return { ...current, ...books };
      },
    },
  ),
);

export function useHasHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useBillingStore.persist.onFinishHydration(() => setHydrated(true));
    if (useBillingStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}
