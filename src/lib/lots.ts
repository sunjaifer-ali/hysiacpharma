import { normalizeProduct } from "./pricing";
import { isInsuranceLine } from "./insurance";
import type { GstRate, Product, PurchaseLine, Unit } from "./types";

export type LotFields = {
  name: string;
  hsn: string;
  pack: string;
  manufacturer: string;
  batch: string;
  expiry: string;
  mrp: number;
  pts: number;
  ptr: number;
  gstRate: number;
};

export type LotChange = { field: string; from: string; to: string };

function compact(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** "Ferrobest Tab 10s (Ferrous …)" → "ferrobest tab 10s" */
export function brandName(name: string): string {
  return compact(name.replace(/\s*\([^)]*\)\s*$/g, ""));
}

export function itemKey(p: { name: string; hsn: string; manufacturer?: string; pack?: string }): string {
  return [brandName(p.name), compact(p.hsn), compact(p.manufacturer ?? ""), compact(p.pack ?? "")].join("|");
}

function money(n: number): string {
  return (Math.round((n || 0) * 100) / 100).toFixed(2);
}

function field(from: string, to: string): { from: string; to: string } | null {
  return compact(from) === compact(to) ? null : { from: from || "—", to: to || "—" };
}

export function lotChanges(oldLot: LotFields, nextLot: LotFields): LotChange[] {
  const rows: [string, string, string][] = [
    ["Batch", oldLot.batch, nextLot.batch],
    ["Expiry", oldLot.expiry, nextLot.expiry],
    ["MRP", money(oldLot.mrp), money(nextLot.mrp)],
    ["PTS", money(oldLot.pts), money(nextLot.pts)],
    ["PTR", money(oldLot.ptr), money(nextLot.ptr)],
    ["Pack", oldLot.pack, nextLot.pack],
    ["HSN", oldLot.hsn, nextLot.hsn],
    ["GST %", String(oldLot.gstRate), String(nextLot.gstRate)],
  ];
  const out: LotChange[] = [];
  for (const [label, from, to] of rows) {
    const diff = field(from, to);
    if (diff) out.push({ field: label, from: diff.from, to: diff.to });
  }
  return out;
}

export function sameLot(a: LotFields, b: LotFields): boolean {
  return lotChanges(a, b).length === 0;
}

export function asLot(p: {
  name: string;
  hsn: string;
  pack?: string;
  manufacturer?: string;
  batch?: string;
  expiry?: string;
  mrp?: number;
  pts?: number;
  ptr?: number;
  gstRate?: number;
}): LotFields {
  return {
    name: p.name,
    hsn: p.hsn,
    pack: p.pack ?? "",
    manufacturer: p.manufacturer ?? "",
    batch: p.batch ?? "",
    expiry: p.expiry ?? "",
    mrp: p.mrp ?? 0,
    pts: p.pts ?? 0,
    ptr: p.ptr ?? 0,
    gstRate: p.gstRate ?? 0,
  };
}

export function sameItem(a: { id?: string; itemId?: string; name: string; hsn: string; manufacturer?: string; pack?: string }, b: { id?: string; itemId?: string; name: string; hsn: string; manufacturer?: string; pack?: string }): boolean {
  const aid = a.itemId || a.id;
  const bid = b.itemId || b.id;
  if (aid && bid && aid === bid) return true;
  return itemKey(a) === itemKey(b);
}

export function familyOf(
  products: Product[],
  line: { productId?: string; name: string; hsn: string; manufacturer?: string; pack?: string },
): Product[] {
  const linked = line.productId ? products.find((p) => p.id === line.productId) : undefined;
  const familyId = linked?.itemId || linked?.id;
  const key = itemKey({
    name: line.name || linked?.name || "",
    hsn: line.hsn || linked?.hsn || "",
    manufacturer: line.manufacturer || linked?.manufacturer || "",
    pack: line.pack || linked?.pack || "",
  });
  return products.filter((p) => (familyId && (p.itemId === familyId || p.id === familyId)) || itemKey(p) === key);
}

function extractGeneric(name: string): string {
  const m = name.match(/\(([^)]+)\)\s*$/);
  return m?.[1]?.trim() ?? "";
}

export function lotFromPurchaseLine(line: PurchaseLine, family: Product | undefined): Product {
  const parent = family;
  const itemId = parent?.itemId || parent?.id || crypto.randomUUID();
  const name = parent?.name || brandName(line.name) || line.name;
  return normalizeProduct({
    id: crypto.randomUUID(),
    itemId,
    name,
    genericName: parent?.genericName || extractGeneric(line.name),
    pack: line.pack || parent?.pack || "",
    unit: (line.unit || parent?.unit || "Strip") as Unit,
    hsn: line.hsn || parent?.hsn || "",
    gstRate: line.gstRate as GstRate,
    mrp: line.mrp,
    rate: line.pts || line.purchaseRate,
    pts: line.pts || line.purchaseRate,
    ptr: line.ptr,
    ptsPercent: line.ptsPercent,
    ptrPercent: line.ptrPercent,
    batch: line.batch,
    expiry: line.expiry,
    manufacturer: line.manufacturer || parent?.manufacturer || "",
    active: true,
  });
}

export function applyPurchaseLots(
  products: Product[],
  lines: PurchaseLine[],
): { products: Product[]; lines: PurchaseLine[]; opened: Product[] } {
  let next = products.map((p) => normalizeProduct(p));
  const opened: Product[] = [];
  const outLines = lines.map((line) => {
    if (isInsuranceLine(line)) return { ...line, productId: "", kind: "insurance" as const };
    const family = familyOf(next, line);
    const exact = family.find((p) => sameLot(asLot(p), asLot(line)));
    if (exact) return { ...line, productId: exact.id };
    const lot = lotFromPurchaseLine(line, family[0]);
    next = [lot, ...next];
    opened.push(lot);
    return { ...line, productId: lot.id };
  });
  return { products: next, lines: outLines, opened };
}

/** Group products that are the same medicine into one family id. */
export function assignItemFamilies(products: Product[]): Product[] {
  const firstId = new Map<string, string>();
  return products.map((raw) => {
    const p = normalizeProduct(raw);
    const key = itemKey(p);
    const existing = firstId.get(key);
    if (existing) {
      return { ...p, itemId: p.itemId && p.itemId !== p.id ? p.itemId : existing };
    }
    const id = p.itemId || p.id;
    firstId.set(key, id);
    return { ...p, itemId: id };
  });
}

export function lotCaption(p: { batch?: string; expiry?: string; mrp?: number }): string {
  const batch = p.batch?.trim() || "no batch";
  const exp = p.expiry ? p.expiry.slice(0, 7) : "";
  const mrp = p.mrp ? `MRP ${money(p.mrp)}` : "";
  return [batch, exp, mrp].filter(Boolean).join(" · ");
}
