import { HysiacMark } from "@/components/logo";
import { formatDate, formatINR, formatMfg } from "@/lib/format";
import { GST_RATES, inrInWords, invoiceTotals, stateName, taxHeadsForRate } from "@/lib/gst";
import type { Purchase } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PurchasePreview({ purchase, className }: { purchase: Purchase; className?: string }) {
  const totals = invoiceTotals(purchase);
  const c = purchase.company;
  const s = purchase.supplier;
  const heads = GST_RATES.map((r) => taxHeadsForRate(purchase.lines, r)).filter((h) => h.taxable > 0);
  const isIgst = totals.igst > 0 || purchase.lines.some((l) => l.igst > 0);
  const challan = purchase.challanNo || purchase.billNo;

  return (
    <article
      className={cn(
        "print-sheet bg-paper text-ink shadow-[var(--shadow-lift)] rounded-2xl overflow-hidden",
        className,
      )}
    >
      <div className="border-b-2 border-primary px-6 py-5 sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="text-primary">
              <HysiacMark className="size-11" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-xl leading-tight text-forest sm:text-2xl">{c.legalName}</h1>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-sage">
                {c.addressLine1}
                {c.addressLine2 ? `, ${c.addressLine2}` : ""}, {c.city}, {stateName(c.stateCode)} {c.pincode}
              </p>
              <p className="mt-1 font-mono text-[11px] text-foreground">GSTIN {c.gstin}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary">Purchase voucher</p>
            <p className="mt-1 font-display text-lg leading-none">{purchase.number || "DRAFT"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatDate(purchase.date)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-b border-border px-6 py-4 text-xs sm:grid-cols-3 sm:px-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Supplier</p>
          <p className="mt-1 font-medium">{s.name}</p>
          <p className="text-muted-foreground">
            {s.addressLine1}
            {s.addressLine2 ? `, ${s.addressLine2}` : ""}
            {s.city ? `, ${s.city}` : ""} {s.pincode}
          </p>
          {s.gstin ? <p className="mt-1 font-mono">GSTIN {s.gstin}</p> : null}
          {s.drugLicense ? <p className="font-mono text-muted-foreground">D.L. {s.drugLicense}</p> : null}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Supplier bill</p>
          <p className="mt-1">Challan / bill: {challan || "—"}</p>
          <p>Bill date: {purchase.billDate ? formatDate(purchase.billDate) : "—"}</p>
          <p>
            Place of supply: {stateName(purchase.placeOfSupply)} ({purchase.placeOfSupply})
          </p>
          <p className="mt-1 text-muted-foreground">{isIgst ? "IGST (inter-state)" : "CGST + SGST (intra-state)"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Dispatch</p>
          <p className="mt-1">Transport: {purchase.transport || "—"}</p>
          <p>
            L.R. {purchase.lrNumber || "—"}
            {purchase.lrDate ? ` · ${formatDate(purchase.lrDate)}` : ""}
          </p>
          <p>E-way: {purchase.ewayBill || "—"}</p>
          <p>Cases: {purchase.cases ?? 0}</p>
        </div>
      </div>

      <div className="px-4 py-3 sm:px-6">
        <div className="space-y-3 sm:hidden">
          {purchase.lines.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No items</p>
          ) : (
            purchase.lines.map((l, i) => (
              <div key={l.id} className="border-b border-border/70 pb-3">
                <p className="text-[11px] text-muted-foreground">#{i + 1}</p>
                <p className="font-medium">{l.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {l.pack ? `${l.pack} · ` : ""}
                  {l.batch ? `B. ${l.batch}` : ""}
                  {l.mfgDate ? ` · Mfg ${formatMfg(l.mfgDate)}` : ""}
                  {l.expiry ? ` · Exp ${formatDate(l.expiry)}` : ""}
                </p>
                <div className="mt-1 grid grid-cols-3 gap-2 text-[11px]">
                  <span>
                    Qty {l.qty}
                    {l.freeQty ? ` + ${l.freeQty} free` : ""}
                  </span>
                  <span className="text-right">Rate {formatINR(l.purchaseRate, { withSymbol: false })}</span>
                  <span className="text-right font-medium">
                    {formatINR(l.taxable + l.cgst + l.sgst + l.igst, { withSymbol: false })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <table className="hidden sm:table w-full text-left text-[11px]">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-2 font-medium">#</th>
              <th className="py-2 pr-2 font-medium">Particulars</th>
              <th className="py-2 pr-2 font-medium text-right">Qty</th>
              <th className="py-2 pr-2 font-medium text-right">MRP</th>
              <th className="py-2 pr-2 font-medium text-right">Rate</th>
              <th className="py-2 pr-2 font-medium text-right">GST</th>
              <th className="py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {purchase.lines.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  No items
                </td>
              </tr>
            ) : (
              purchase.lines.map((l, i) => {
                const tax = l.cgst + l.sgst + l.igst;
                return (
                  <tr key={l.id} className="border-b border-border/70 align-top">
                    <td className="py-2 pr-2 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="min-w-0 py-2 pr-2">
                      <div className="font-medium">{l.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {l.hsn ? `HSN ${l.hsn}` : ""}
                        {l.pack ? ` · ${l.pack}` : ""}
                        {l.batch ? ` · B. ${l.batch}` : ""}
                        {l.mfgDate ? ` · Mfg ${formatMfg(l.mfgDate)}` : ""}
                        {l.expiry ? ` · Exp ${formatDate(l.expiry)}` : ""}
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums whitespace-normal">
                      {l.qty}
                      {l.freeQty ? (
                        <>
                          <br />+ {l.freeQty} free
                        </>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums whitespace-nowrap">
                      {l.mrp ? formatINR(l.mrp, { withSymbol: false }) : "—"}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums whitespace-nowrap">
                      {formatINR(l.purchaseRate, { withSymbol: false })}
                      {l.discount ? (
                        <div className="text-[10px] text-muted-foreground">
                          Dis {formatINR(l.discount, { withSymbol: false })}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2 text-right whitespace-normal">
                      {l.gstRate}%
                      <br />
                      {formatINR(tax, { withSymbol: false })}
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium whitespace-nowrap">
                      {formatINR(l.taxable + tax, { withSymbol: false })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 border-t border-border px-6 py-4 sm:grid-cols-2 sm:px-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Amount in words</p>
          <p className="mt-1 text-sm font-medium leading-snug">{inrInWords(totals.grand)}</p>
          {heads.length > 0 ? (
            <table className="mt-3 w-full max-w-sm text-[11px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-1 text-left font-medium">Class</th>
                  <th className="py-1 text-right font-medium">Taxable</th>
                  {isIgst ? (
                    <th className="py-1 text-right font-medium">IGST</th>
                  ) : (
                    <>
                      <th className="py-1 text-right font-medium">CGST</th>
                      <th className="py-1 text-right font-medium">SGST</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {heads.map((h) => (
                  <tr key={h.rate}>
                    <td className="py-0.5">{h.rate}%</td>
                    <td className="py-0.5 text-right tabular-nums">{formatINR(h.taxable, { withSymbol: false })}</td>
                    {isIgst ? (
                      <td className="py-0.5 text-right tabular-nums">{formatINR(h.igst, { withSymbol: false })}</td>
                    ) : (
                      <>
                        <td className="py-0.5 text-right tabular-nums">{formatINR(h.cgst, { withSymbol: false })}</td>
                        <td className="py-0.5 text-right tabular-nums">{formatINR(h.sgst, { withSymbol: false })}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
        <div className="text-sm">
          <dl className="space-y-1.5">
            <Row label="Taxable value" value={formatINR(totals.taxable)} />
            {totals.cgst > 0 ? <Row label="CGST" value={formatINR(totals.cgst)} /> : null}
            {totals.sgst > 0 ? <Row label="SGST" value={formatINR(totals.sgst)} /> : null}
            {totals.igst > 0 ? <Row label="IGST payable" value={formatINR(totals.igst)} /> : null}
            {totals.roundOff !== 0 ? <Row label="Round off" value={formatINR(totals.roundOff)} /> : null}
            <div className="flex items-baseline justify-between border-t border-border pt-2 font-medium">
              <dt>Grand total</dt>
              <dd className="font-display text-xl tabular-nums text-forest">{formatINR(totals.grand)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {purchase.notes ? (
        <div className="border-t border-border px-6 py-3 text-[10px] text-muted-foreground sm:px-8">
          Note: {purchase.notes}
        </div>
      ) : null}
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
