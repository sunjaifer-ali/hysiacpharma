export type GstRate = 0 | 5 | 12 | 18 | 28;

export type InvoiceStatus = "draft" | "issued" | "partial" | "paid" | "cancelled";

export type PurchaseStatus = "draft" | "posted" | "cancelled";

export type CreditNoteStatus = "draft" | "issued" | "cancelled";

export type CreditNoteKind = "sales_return" | "credit_note";

export type CreditNoteReason =
  | "sales_return"
  | "expired"
  | "damaged"
  | "rate_difference"
  | "scheme"
  | "shortage"
  | "other";

export type PartyKind = "registered" | "unregistered" | "composition";

export type TradeChannel = "stockist" | "retailer" | "hospital" | "walkin";

export type PriceList = "pts" | "ptr";

export type BillKind = "cash" | "credit";

export type BillCopy = "Original" | "Duplicate" | "Triplicate";

export type Unit = "Strip" | "Bottle" | "Box" | "Tube" | "Vial" | "Sachet" | "Jar" | "Pack";

export type CompanyProfile = {
  legalName: string;
  tradeName: string;
  gstin: string;
  cin: string;
  drugLicense: string;
  drugLicense20: string;
  drugLicense21: string;
  drugLicenseValidUpto: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateCode: string;
  pincode: string;
  phone: string;
  email: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bankBranch: string;
  invoicePrefix: string;
  nextNumber: number;
  purchasePrefix: string;
  nextPurchaseNumber: number;
  purchaseOrderPrefix: string;
  nextPurchaseOrderNumber: number;
  returnPrefix: string;
  nextReturnNumber: number;
  creditNotePrefix: string;
  nextCreditNoteNumber: number;
  quotePrefix?: string;
  nextQuoteNumber?: number;
  receiptPrefix?: string;
  nextReceiptNumber?: number;
  paymentVoucherPrefix?: string;
  nextPaymentVoucherNumber?: number;
  salesman: string;
  terms: string;
  signatory: string;
};

export type Product = {
  id: string;
  /** Shared id for the same medicine across batch / MRP lots. */
  itemId: string;
  name: string;
  genericName: string;
  pack: string;
  unit: Unit;
  hsn: string;
  gstRate: GstRate;
  mrp: number;
  /** @deprecated alias of pts — kept so older invoices still read */
  rate: number;
  pts: number;
  ptr: number;
  /** PTS as % of MRP */
  ptsPercent: number;
  /** PTR as % of MRP */
  ptrPercent: number;
  batch: string;
  expiry: string;
  manufacturer: string;
  active: boolean;
  /** Quantity already in the godown before the first purchase in this app. */
  openingQty?: number;
  /** Date that opening quantity is counted from. */
  openingDate?: string;
};

export type Party = {
  id: string;
  name: string;
  kind: PartyKind;
  channel: TradeChannel;
  isCustomer: boolean;
  isSupplier: boolean;
  gstin: string;
  drugLicense: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateCode: string;
  pincode: string;
  phone: string;
  email: string;
};

export type StockOutReason = "expired" | "damaged";

export type StockAdjustment = {
  id: string;
  date: string;
  productId: string;
  name: string;
  qty: number;
  reason: StockOutReason;
  note: string;
  createdAt: string;
};

export type OpeningDue = {
  id: string;
  partyId: string;
  partyName: string;
  kind: "customer" | "supplier";
  date: string;
  amount: number;
  paidAmount: number;
};

export type InvoiceLine = {
  id: string;
  productId: string;
  name: string;
  hsn: string;
  pack: string;
  unit: Unit;
  manufacturer: string;
  batch: string;
  expiry: string;
  qty: number;
  freeQty: number;
  mrp: number;
  pts: number;
  ptr: number;
  ptsPercent: number;
  ptrPercent: number;
  priceList: PriceList;
  rate: number;
  discount: number;
  gstRate: GstRate;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
};

export type PartySnapshot = {
  name: string;
  kind: PartyKind;
  channel: TradeChannel;
  gstin: string;
  drugLicense: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateCode: string;
  pincode: string;
  phone: string;
};

export type CompanySnapshot = {
  legalName: string;
  tradeName: string;
  gstin: string;
  cin: string;
  drugLicense: string;
  drugLicenseValidUpto?: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateCode: string;
  pincode: string;
  phone: string;
  email: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bankBranch: string;
  signatory: string;
};

export type Invoice = {
  id: string;
  number: string;
  date: string;
  status: InvoiceStatus;
  billKind: BillKind;
  salesman: string;
  poNumber: string;
  transport: string;
  ewayBill: string;
  partyId: string;
  party: PartySnapshot;
  company: CompanySnapshot;
  placeOfSupply: string;
  reverseCharge: boolean;
  priceList: PriceList;
  lines: InvoiceLine[];
  transportCharges: number;
  otherCharges: number;
  creditApplied: number;
  roundOff: number;
  notes: string;
  paidAmount: number;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceDraft = Omit<Invoice, "number" | "status" | "createdAt" | "updatedAt"> & {
  number?: string;
  status?: InvoiceStatus;
};

export type PurchaseLine = {
  id: string;
  productId: string;
  name: string;
  hsn: string;
  pack: string;
  unit: Unit;
  manufacturer: string;
  batch: string;
  expiry: string;
  mfgDate: string;
  qty: number;
  freeQty: number;
  mrp: number;
  ptsPercent: number;
  ptrPercent: number;
  pts: number;
  ptr: number;
  purchaseRate: number;
  discount: number;
  gstRate: GstRate;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  /** Insurance is a bill charge. It is not stock and cannot be sold. */
  kind?: "goods" | "insurance";
};

export type Purchase = {
  id: string;
  number: string;
  date: string;
  status: PurchaseStatus;
  supplierId: string;
  supplier: PartySnapshot;
  company: CompanySnapshot;
  placeOfSupply: string;
  billNo: string;
  billDate: string;
  challanNo: string;
  lrNumber: string;
  lrDate: string;
  transport: string;
  ewayBill: string;
  cases: number;
  lines: PurchaseLine[];
  roundOff: number;
  notes: string;
  /** Amount already paid to the supplier. Missing on older bills means unpaid. */
  paidAmount?: number;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseDraft = Omit<Purchase, "number" | "status" | "createdAt" | "updatedAt"> & {
  number?: string;
  status?: PurchaseStatus;
};

export type QuoteStatus = "draft" | "sent" | "ordered";

export type QuoteLine = {
  id: string;
  productId: string;
  name: string;
  hsn: string;
  pack: string;
  unit: Unit;
  manufacturer: string;
  qty: number;
  freeQty: number;
  mrp: number;
  listRate: number;
  rate: number;
  discountPct: number;
  offer: string;
  gstRate: GstRate;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
};

export type Quote = {
  id: string;
  number: string;
  date: string;
  validUntil: string;
  status: QuoteStatus;
  partyId: string;
  party: PartySnapshot;
  company: CompanySnapshot;
  placeOfSupply: string;
  priceList: PriceList;
  reference: string;
  attention: string;
  lines: QuoteLine[];
  offerNote: string;
  notes: string;
  invoiceId?: string;
  createdAt: string;
  updatedAt: string;
};

export type QuoteDraft = Omit<Quote, "number" | "status" | "createdAt" | "updatedAt"> & {
  number?: string;
  status?: QuoteStatus;
};

export type PaymentMode = "cash" | "bank" | "upi" | "cheque";

export type LedgerPayment = {
  id: string;
  kind: "receipt" | "payment";
  date: string;
  partyId: string;
  partyName: string;
  voucherId: string;
  voucherNumber: string;
  amount: number;
  mode: PaymentMode;
  reference: string;
  number?: string;
  createdAt: string;
};

export type RecycleEntry =
  | {
      id: string;
      kind: "invoice";
      deletedAt: string;
      title: string;
      subtitle: string;
      invoice: Invoice;
      creditNotes: CreditNote[];
      payments: LedgerPayment[];
    }
  | {
      id: string;
      kind: "purchase";
      deletedAt: string;
      title: string;
      subtitle: string;
      purchase: Purchase;
      payments: LedgerPayment[];
    }
  | {
      id: string;
      kind: "order";
      deletedAt: string;
      title: string;
      subtitle: string;
      order: PurchaseOrder;
    }
  | {
      id: string;
      kind: "quote";
      deletedAt: string;
      title: string;
      subtitle: string;
      quote: Quote;
    }
  | {
      id: string;
      kind: "product";
      deletedAt: string;
      title: string;
      subtitle: string;
      product: Product;
    }
  | {
      id: string;
      kind: "party";
      deletedAt: string;
      title: string;
      subtitle: string;
      party: Party;
    }
  | {
      id: string;
      kind: "payment";
      deletedAt: string;
      title: string;
      subtitle: string;
      payment: LedgerPayment;
    }
  | {
      id: string;
      kind: "adjustment";
      deletedAt: string;
      title: string;
      subtitle: string;
      adjustment: StockAdjustment;
    }
  | {
      id: string;
      kind: "opening";
      deletedAt: string;
      title: string;
      subtitle: string;
      opening: OpeningDue;
      payments: LedgerPayment[];
    };

export type PurchaseOrderStatus = "draft" | "sent" | "closed" | "cancelled";

export type PurchaseOrderLine = {
  id: string;
  productId: string;
  name: string;
  pack: string;
  unit: Unit;
  manufacturer: string;
  qty: number;
  note: string;
};

export type PurchaseOrder = {
  id: string;
  number: string;
  date: string;
  status: PurchaseOrderStatus;
  supplierId: string;
  supplier: PartySnapshot;
  company: CompanySnapshot;
  neededBy: string;
  notes: string;
  lines: PurchaseOrderLine[];
  createdAt: string;
  updatedAt: string;
};

export type PurchaseOrderDraft = {
  id?: string;
  date: string;
  supplierId: string;
  neededBy: string;
  notes: string;
  lines: PurchaseOrderLine[];
};

export type CreditNoteLine = InvoiceLine & {
  invoiceLineId: string;
};

export type CreditNote = {
  id: string;
  number: string;
  date: string;
  status: CreditNoteStatus;
  kind: CreditNoteKind;
  reason: CreditNoteReason;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  partyId: string;
  party: PartySnapshot;
  company: CompanySnapshot;
  placeOfSupply: string;
  priceList: PriceList;
  lines: CreditNoteLine[];
  roundOff: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type CreditNoteDraft = Omit<CreditNote, "number" | "status" | "createdAt" | "updatedAt"> & {
  number?: string;
  status?: CreditNoteStatus;
};
