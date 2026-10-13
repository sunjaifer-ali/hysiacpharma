import { round2 } from "./gst";
import type { PriceList, Product, PurchaseLine, TradeChannel } from "./types";

export function pctOf(part: number, whole: number): number {
  if (!whole) return 0;
  return round2((part / whole) * 100);
}

export function fromPct(whole: number, pct: number): number {
  return round2(whole * (pct / 100));
}

export function derivePtrPercent(ptsPercent: number): number {
  const lifted = round2(ptsPercent + 16);
  if (lifted <= ptsPercent) return round2(Math.min(95, ptsPercent + 8));
  return Math.min(92, lifted);
}

export function normalizeProduct(raw: Product): Product {
  const mrp = raw.mrp ?? 0;
  const pts = raw.pts ?? raw.rate ?? 0;
  const ptsPercent = raw.ptsPercent ?? pctOf(pts, mrp);
  const ptrPercent = raw.ptrPercent ?? derivePtrPercent(ptsPercent);
  const ptr = raw.ptr ?? fromPct(mrp, ptrPercent);
  return {
    ...raw,
    itemId: raw.itemId || raw.id,
    mrp,
    pts,
    ptr,
    ptsPercent,
    ptrPercent,
    rate: pts,
  };
}

export function applyMrp(p: Product, mrp: number): Product {
  const pts = fromPct(mrp, p.ptsPercent);
  const ptr = fromPct(mrp, p.ptrPercent);
  return { ...p, mrp, pts, ptr, rate: pts };
}

export function applyPtsPercent(p: Product, ptsPercent: number): Product {
  const pts = fromPct(p.mrp, ptsPercent);
  return { ...p, ptsPercent, pts, rate: pts };
}

export function applyPtrPercent(p: Product, ptrPercent: number): Product {
  const ptr = fromPct(p.mrp, ptrPercent);
  return { ...p, ptrPercent, ptr };
}

export function applyPtsAmount(p: Product, pts: number): Product {
  return { ...p, pts, rate: pts, ptsPercent: pctOf(pts, p.mrp) };
}

export function applyPtrAmount(p: Product, ptr: number): Product {
  return { ...p, ptr, ptrPercent: pctOf(ptr, p.mrp) };
}

export function priceListForChannel(channel: TradeChannel | undefined): PriceList {
  return channel === "stockist" ? "pts" : "ptr";
}

export function rateForList(p: Pick<Product, "pts" | "ptr">, list: PriceList): number {
  return list === "pts" ? p.pts : p.ptr;
}

export function rateFromLine(
  line: { pts: number; ptr: number; rate: number },
  list: PriceList,
): number {
  if (list === "pts" && line.pts) return line.pts;
  if (list === "ptr" && line.ptr) return line.ptr;
  return line.rate;
}


export function channelLabel(channel: TradeChannel): string {
  switch (channel) {
    case "stockist":
      return "Stockist";
    case "retailer":
      return "Retailer";
    case "hospital":
      return "Hospital";
    default:
      return "Walk-in";
  }
}

export function priceListLabel(list: PriceList): string {
  return list === "pts" ? "PTS" : "PTR";
}

export function tradeCaption(
  line: { mrp: number; pts: number; ptr: number; ptsPercent?: number; ptrPercent?: number },
  list: PriceList = "ptr",
): string {
  if (!line.mrp) return "";
  const ptsPct = (line.ptsPercent ?? pctOf(line.pts, line.mrp)).toFixed(1);
  const ptrPct = (line.ptrPercent ?? pctOf(line.ptr, line.mrp)).toFixed(1);
  return list === "pts"
    ? `PTS ${ptsPct}% of MRP · PTR ${ptrPct}%`
    : `PTR ${ptrPct}% of MRP · PTS ${ptsPct}%`;
}

export function syncPurchaseTrade(line: PurchaseLine, patch: Partial<PurchaseLine>): PurchaseLine {
  const next = { ...line, ...patch };
  const mrp = next.mrp;
  if (patch.mrp !== undefined) {
    next.pts = fromPct(mrp, next.ptsPercent);
    next.ptr = fromPct(mrp, next.ptrPercent);
  } else if (patch.ptsPercent !== undefined) {
    next.pts = fromPct(mrp, next.ptsPercent);
  } else if (patch.ptrPercent !== undefined) {
    next.ptr = fromPct(mrp, next.ptrPercent);
  } else if (patch.pts !== undefined) {
    next.ptsPercent = pctOf(next.pts, mrp);
  } else if (patch.ptr !== undefined) {
    next.ptrPercent = pctOf(next.ptr, mrp);
  }
  return next;
}

