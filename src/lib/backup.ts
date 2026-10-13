import type { CompanyProfile, CreditNote, Invoice, LedgerPayment, OpeningDue, Party, Product, Purchase, PurchaseOrder, Quote, RecycleEntry, StockAdjustment } from "./types";

export const BACKUP_APP = "hysiac-gst";
export const BACKUP_FOLDER_NAME = "Hysiac GST Backups";
export const BACKUP_LATEST_NAME = "hysiac-gst-latest.json";

export type BooksSnapshot = {
  company: CompanyProfile;
  products: Product[];
  parties: Party[];
  invoices: Invoice[];
  purchases: Purchase[];
  purchaseOrders: PurchaseOrder[];
  quotes: Quote[];
  creditNotes: CreditNote[];
  payments: LedgerPayment[];
  adjustments?: StockAdjustment[];
  openingDues?: OpeningDue[];
  bin?: RecycleEntry[];
};

export type BackupFile = BooksSnapshot & {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
};

export type BackupTarget = "google-drive" | "folder" | "share" | "download";

export function datedBackupName(at = new Date()): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  return `hysiac-gst-${y}-${m}-${d}.json`;
}

export function stampBackupName(at = new Date()): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  const hh = String(at.getHours()).padStart(2, "0");
  const mm = String(at.getMinutes()).padStart(2, "0");
  return `hysiac-gst-${y}${m}${d}-${hh}${mm}.json`;
}

export function wrapBackup(books: BooksSnapshot, at = new Date()): BackupFile {
  return {
    app: BACKUP_APP,
    version: 1,
    exportedAt: at.toISOString(),
    ...books,
  };
}

export function backupJson(books: BooksSnapshot, at = new Date()): string {
  return JSON.stringify(wrapBackup(books, at), null, 2);
}

function fnv1a(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function booksFingerprint(books: BooksSnapshot): string {
  return fnv1a(
    JSON.stringify({
      company: books.company,
      products: books.products,
      parties: books.parties,
      invoices: books.invoices,
      purchases: books.purchases,
      purchaseOrders: books.purchaseOrders,
      quotes: books.quotes,
      creditNotes: books.creditNotes,
      payments: books.payments,
      adjustments: books.adjustments ?? [],
      openingDues: books.openingDues ?? [],
      bin: books.bin ?? [],
    }),
  );
}

export function parseBooksBackup(raw: unknown): BooksSnapshot {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!data) throw new Error("Not a Hysiac backup");
  const company = data.company as CompanyProfile | undefined;
  const invoices = data.invoices as Invoice[] | undefined;
  if (!company || !Array.isArray(invoices)) throw new Error("Not a Hysiac backup");
  return {
    company,
    products: Array.isArray(data.products) ? (data.products as Product[]) : [],
    parties: Array.isArray(data.parties) ? (data.parties as Party[]) : [],
    invoices,
    purchases: Array.isArray(data.purchases) ? (data.purchases as Purchase[]) : [],
    purchaseOrders: Array.isArray(data.purchaseOrders) ? (data.purchaseOrders as PurchaseOrder[]) : [],
    quotes: Array.isArray(data.quotes) ? (data.quotes as Quote[]) : [],
    creditNotes: Array.isArray(data.creditNotes) ? (data.creditNotes as CreditNote[]) : [],
    payments: Array.isArray(data.payments) ? (data.payments as LedgerPayment[]) : [],
    adjustments: Array.isArray(data.adjustments) ? (data.adjustments as StockAdjustment[]) : [],
    openingDues: Array.isArray(data.openingDues) ? (data.openingDues as OpeningDue[]) : [],
    bin: Array.isArray(data.bin) ? (data.bin as RecycleEntry[]) : [],
  };
}

export function parseBackupText(text: string): BooksSnapshot {
  return parseBooksBackup(JSON.parse(text) as unknown);
}

export function downloadBackupFile(json: string, fileName: string) {
  const android = androidBridge();
  if (android) {
    android.saveTextFile(fileName, json);
    return;
  }
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function androidBridge(): { saveTextFile: (name: string, text: string) => void } | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as unknown as { HysiacAndroid?: { saveTextFile?: (name: string, text: string) => void } })
    .HysiacAndroid;
  return bridge && typeof bridge.saveTextFile === "function" ? { saveTextFile: bridge.saveTextFile.bind(bridge) } : null;
}

export async function shareBackupFile(json: string, fileName: string): Promise<boolean> {
  if (typeof navigator === "undefined" || typeof File === "undefined") return false;
  const file = new File([json], fileName, { type: "application/json" });
  const payload = { files: [file], title: "Hysiac GST backup", text: fileName };
  if (!navigator.canShare?.(payload)) return false;
  try {
    await navigator.share(payload);
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return false;
    return false;
  }
}
