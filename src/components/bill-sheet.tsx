import { formatDate, formatDateDMY, formatINR } from "@/lib/format";
import { GST_RATES, inrInWords, invoiceTotals, stateName, taxHeadsForRate } from "@/lib/gst";
import type { BillCopy, BillKind, CreditNote, Invoice, InvoiceLine, PriceList } from "@/lib/types";
import { cn } from "@/lib/utils";

export type BillSheetDoc = {
  title: string;
  against?: string;
  number: string;
  date: string;
  billKind: BillKind;
  salesman: string;
  poNumber?: string;
  transport?: string;
  ewayBill?: string;
  copy: BillCopy;
  company: Invoice["company"];
  party: Invoice["party"];
  placeOfSupply: string;
  reverseCharge?: boolean;
  priceList: PriceList;
  lines: InvoiceLine[];
  roundOff: number;
  notes: string;
  transportCharges?: number;
  otherCharges?: number;
  creditApplied?: number;
  showAck?: boolean;
};

export function invoiceToSheet(invoice: Invoice, copy: BillCopy, creditApplied = 0): BillSheetDoc {
  return {
    title: "Tax Invoice",
    number: invoice.number,
    date: invoice.date,
    billKind: invoice.billKind ?? "credit",
    salesman: invoice.salesman ?? "",
    poNumber: invoice.poNumber,
    transport: invoice.transport,
    ewayBill: invoice.ewayBill,
    copy,
    company: invoice.company,
    party: invoice.party,
    placeOfSupply: invoice.placeOfSupply,
    reverseCharge: invoice.reverseCharge,
    priceList: invoice.priceList ?? "ptr",
    lines: invoice.lines,
    roundOff: invoice.roundOff,
    notes: invoice.notes,
    transportCharges: invoice.transportCharges,
    otherCharges: invoice.otherCharges,
    creditApplied,
    showAck: true,
  };
}

export function creditNoteToSheet(note: CreditNote, copy: BillCopy): BillSheetDoc {
  return {
    title: note.kind === "sales_return" ? "Return Bill" : "Credit Note",
    against: `Against Invoice ${note.invoiceNumber} dated ${formatDate(note.invoiceDate)}`,
    number: note.number,
    date: note.date,
    billKind: "credit",
    salesman: "",
    copy,
    company: note.company,
    party: note.party,
    placeOfSupply: note.placeOfSupply,
    priceList: note.priceList,
    lines: note.lines,
    roundOff: note.roundOff,
    notes: note.notes,
    showAck: false,
  };
}

function billName(name: string): string {
  return name.replace(/\s+PRIVATE LIMITED\s*$/i, " PVT LTD");
}

function Signatory({ name }: { name: string }) {
  const text = name.trim();
  const isTitle = /^authori[sz]ed signatory$/i.test(text);
  return (
    <>
      {text && !isTitle ? <p className="bill-signatory">{text}</p> : null}
      <p className="bill-kicker">Authorised Signatory</p>
    </>
  );
}

function expShort(iso: string): string {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  return y && m ? `${m}-${y.slice(2)}` : iso;
}

type Totals = ReturnType<typeof invoiceTotals>;
type Head = ReturnType<typeof taxHeadsForRate>;

export function BillSheet({ doc, className }: { doc: BillSheetDoc; className?: string }) {
  const totals = invoiceTotals({
    lines: doc.lines,
    roundOff: doc.roundOff,
    transportCharges: doc.transportCharges,
    otherCharges: doc.otherCharges,
    creditApplied: doc.creditApplied,
  });
  const isIgst = totals.igst > 0;
  const heads = GST_RATES.map((rate) => taxHeadsForRate(doc.lines, rate)).filter((h) => h.taxable);
  const colCount = isIgst ? 16 : 17;

  return (
    <article className={cn("print-sheet bill-frame bill-land bg-paper text-ink", className)}>
      <div className="bill-mobile-only">
        <BillChrome doc={doc} />
      </div>

      <div className="bill-body">
        <div className="bill-lines-stack">
          {doc.lines.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No items</p>
          ) : (
            doc.lines.map((l, i) => {
              const tax = l.cgst + l.sgst + l.igst;
              return (
                <div key={l.id} className="bill-card">
                  <p className="font-medium leading-snug">
                    {i + 1}. {l.name}
                  </p>
                  <p className="bill-card-meta">
                    HSN {l.hsn}
                    {l.manufacturer ? ` · ${l.manufacturer}` : ""}
                    {l.pack ? ` · ${l.pack}` : ""}
                    {l.batch ? ` · Batch ${l.batch}` : ""}
                    {l.expiry ? ` · Exp ${expShort(l.expiry)}` : ""}
                  </p>
                  <p className="bill-card-meta tabular-nums">
                    Qty {l.qty}
                    {l.freeQty ? ` + ${l.freeQty} free` : ""} · MRP {formatINR(l.mrp)} · Rate {formatINR(l.rate)}
                  </p>
                  <p className="bill-card-meta tabular-nums">
                    Amount {formatINR(l.taxable)} · GST {l.gstRate}% {formatINR(tax)} ·{" "}
                    <span className="font-medium">{formatINR(l.taxable + tax)}</span>
                  </p>
                </div>
              );
            })
          )}
        </div>

        <table className="bill-lines-table">
          <colgroup>
            <col className="c-sl" />
            <col className="c-hsn" />
            <col className="c-desc" />
            <col className="c-mfr" />
            <col className="c-batch" />
            <col className="c-exp" />
            <col className="c-pack" />
            <col className="c-qty" />
            <col className="c-free" />
            <col className="c-mrp" />
            <col className="c-rate" />
            <col className="c-disc" />
            <col className="c-amt" />
            <col className="c-gst" />
            {isIgst ? (
              <col className="c-tax" />
            ) : (
              <>
                <col className="c-tax" />
                <col className="c-tax" />
              </>
            )}
            <col className="c-tot" />
          </colgroup>
          <thead>
            <tr className="bill-chrome-row">
              <td colSpan={colCount}>
                <BillChrome doc={doc} />
              </td>
            </tr>
            <tr>
              <th>SL</th>
              <th>HSN</th>
              <th>Description</th>
              <th>Mfr</th>
              <th>Batch</th>
              <th>Exp</th>
              <th>Pack</th>
              <th className="num">Qty</th>
              <th className="num">Free</th>
              <th className="num">MRP</th>
              <th className="num">Rate</th>
              <th className="num">Disc</th>
              <th className="num">Amount</th>
              <th className="num">GST%</th>
              {isIgst ? (
                <th className="num">IGST</th>
              ) : (
                <>
                  <th className="num">CGST</th>
                  <th className="num">SGST</th>
                </>
              )}
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="py-6 text-center text-muted-foreground">
                  No items
                </td>
              </tr>
            ) : (
              doc.lines.map((l, i) => (
                <tr key={l.id}>
                  <td className="num">{i + 1}</td>
                  <td className="mono">{l.hsn}</td>
                  <td className="desc">{l.name}</td>
                  <td>{l.manufacturer || "—"}</td>
                  <td className="mono">{l.batch || "—"}</td>
                  <td className="num">{expShort(l.expiry) || "—"}</td>
                  <td>{l.pack || l.unit}</td>
                  <td className="num">{l.qty}</td>
                  <td className="num">{l.freeQty || ""}</td>
                  <td className="num">{l.mrp ? l.mrp.toFixed(2) : ""}</td>
                  <td className="num">{l.rate.toFixed(2)}</td>
                  <td className="num">{l.discount ? l.discount.toFixed(2) : "0"}</td>
                  <td className="num">{l.taxable.toFixed(2)}</td>
                  <td className="num">{l.gstRate.toFixed(2)}</td>
                  {isIgst ? (
                    <td className="num">{l.igst.toFixed(2)}</td>
                  ) : (
                    <>
                      <td className="num">{l.cgst.toFixed(2)}</td>
                      <td className="num">{l.sgst.toFixed(2)}</td>
                    </>
                  )}
                  <td className="num strong">{(l.taxable + l.cgst + l.sgst + l.igst).toFixed(2)}</td>
                </tr>
              ))
            )}
            {Array.from({ length: 6 }).map((_, n) => (
              <tr key={`pad-${n}`} className="bill-pad" aria-hidden="true">
                {Array.from({ length: colCount }).map((__, c) => (
                  <td key={c}>&nbsp;</td>
                ))}
              </tr>
            ))}
            <tr className="bill-fill" aria-hidden="true">
              <td colSpan={colCount} />
            </tr>
          </tbody>
          <tfoot>
            <tr className="bill-foot-row">
              <td colSpan={colCount}>
                <BillGstBlock doc={doc} totals={totals} heads={heads} />
                {doc.showAck ? <BillAck doc={doc} grand={totals.grand} /> : null}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="bill-mobile-only">
        <BillGstBlock doc={doc} totals={totals} heads={heads} />
        {doc.showAck ? <BillAck doc={doc} grand={totals.grand} /> : null}
      </div>
    </article>
  );
}

function BillChrome({ doc }: { doc: BillSheetDoc }) {
  const c = doc.company;
  const p = doc.party;
  const copies: BillCopy[] = ["Original", "Duplicate", "Triplicate"];
  return (
    <>
      <p className="bill-copy-row">
        <span className="bill-copy-kind">{doc.billKind === "cash" ? "Cash Bill" : "Credit Bill"}</span>
        {copies.map((copy) => (
          <span key={copy} className={cn("bill-copy-mark", doc.copy === copy && "is-on")}>
            {copy}
          </span>
        ))}
      </p>
      <div className="bill-top">
        <section>
          <h1 className="bill-co">{billName(c.legalName)}</h1>
          <p className="bill-addr">
            {c.addressLine1}
            {c.addressLine2 ? `, ${c.addressLine2}` : ""}
            <br />
            {c.city}, {stateName(c.stateCode)} {c.pincode}
            <br />
            Phone : {c.phone || "—"}
          </p>
          <p className="bill-id">GSTIN : {c.gstin}</p>
          {c.drugLicense ? <p className="bill-id">D.L. No : {c.drugLicense}</p> : null}
        </section>
        <section>
          <p className="bill-kicker">To</p>
          <p className="bill-party">{p.name}</p>
          <p className="bill-addr">
            {p.addressLine1}
            {p.addressLine2 ? `, ${p.addressLine2}` : ""}
            {p.city ? `, ${p.city}` : ""} {p.pincode}
          </p>
          <p className="bill-id">
            State : {stateName(doc.placeOfSupply)} &nbsp; Code : {doc.placeOfSupply}
          </p>
          {p.gstin ? <p className="bill-id">GSTIN : {p.gstin}</p> : <p className="bill-id">GSTIN : Unregistered</p>}
          {p.drugLicense ? <p className="bill-id">D.L. No : {p.drugLicense}</p> : null}
        </section>
        <section>
          <h2 className="bill-title">{doc.title}</h2>
          {doc.against ? <p className="bill-against">{doc.against}</p> : null}
          {doc.poNumber ? (
            <p className="bill-id">
              P.O. No : <span className="font-medium">{doc.poNumber}</span>
            </p>
          ) : null}
          <p className="bill-id">
            Invoice No : <span className="font-medium">{doc.number || "DRAFT"}</span>
          </p>
          <p className="bill-id">Invoice Date : {formatDateDMY(doc.date)}</p>
          {doc.salesman ? <p className="bill-id">Salesman : {doc.salesman}</p> : null}
          {doc.transport ? <p className="bill-id">Transport : {doc.transport}</p> : null}
          {doc.ewayBill ? <p className="bill-id">E-way Bill : {doc.ewayBill}</p> : null}
          {doc.reverseCharge ? <p className="bill-id">Reverse charge : Yes</p> : null}
        </section>
      </div>
    </>
  );
}

function BillGstBlock({ doc, totals, heads }: { doc: BillSheetDoc; totals: Totals; heads: Head[] }) {
  const c = doc.company;
  return (
    <div className="bill-gst-block">
      <div>
        <p className="bill-bar">GST details</p>
        <table className="bill-gst-table">
          <thead>
            <tr>
              <th>GST %</th>
              <th className="num">Taxable</th>
              <th className="num">CGST</th>
              <th className="num">SGST</th>
              <th className="num">IGST</th>
            </tr>
          </thead>
          <tbody>
            {heads.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-muted-foreground">
                  —
                </td>
              </tr>
            ) : (
              heads.map((h) => (
                <tr key={h.rate}>
                  <td className="num">{h.rate}%</td>
                  <td className="num">{h.taxable.toFixed(2)}</td>
                  <td className="num">{h.cgst.toFixed(2)}</td>
                  <td className="num">{h.sgst.toFixed(2)}</td>
                  <td className="num">{h.igst.toFixed(2)}</td>
                </tr>
              ))
            )}
            <tr className="bill-gst-total">
              <td>Total</td>
              <td className="num">{totals.taxable.toFixed(2)}</td>
              <td className="num">{totals.cgst.toFixed(2)}</td>
              <td className="num">{totals.sgst.toFixed(2)}</td>
              <td className="num">{totals.igst.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <p className="bill-qty">
          Billed Qty : {totals.qty} &nbsp; Free Qty : {totals.freeQty} &nbsp; Total Qty Shipped : {totals.shipped}
        </p>
        <div className="bill-sign-row">
          <span>Prepared by</span>
          <span>Checked by</span>
        </div>
        <p className="bill-words">
          <span>Rupees :</span> {inrInWords(totals.grand)}
        </p>
        {c.bankName ? (
          <p className="bill-bank">
            Bank : {c.bankName}, {c.bankBranch} &nbsp; A/c : {c.bankAccount} &nbsp; IFSC : {c.bankIfsc}
          </p>
        ) : null}
        <p className="bill-decl">
          Declaration : We declare that this invoice shows the actual price of the goods described and that all
          particulars are true and correct. E & OE.
        </p>
        {doc.notes && !doc.showAck ? <p className="bill-note">Note : {doc.notes}</p> : null}
      </div>
      <div className="bill-tot-col">
        <dl className="bill-tot">
          <Row label="Sub total" value={totals.subtotal.toFixed(2)} />
          {totals.creditApplied > 0 ? <Row label="Credit note" value={totals.creditApplied.toFixed(2)} /> : null}
          <Row label="Transport charges" value={(doc.transportCharges ?? 0).toFixed(2)} />
          <Row label="Other charges" value={(doc.otherCharges ?? 0).toFixed(2)} />
          <Row label="Round off" value={totals.roundOff.toFixed(2)} />
        </dl>
        <div className="bill-grand">
          <span>Grand total</span>
          <span className="tabular-nums">{formatINR(totals.grand)}</span>
        </div>
        <div className="bill-sign">
          <p className="bill-kicker">For {billName(c.legalName)}</p>
          <div className="bill-sign-space" />
          <Signatory name={c.signatory} />
        </div>
      </div>
    </div>
  );
}

function BillAck({ doc, grand }: { doc: BillSheetDoc; grand: number }) {
  const p = doc.party;
  return (
    <div className="bill-ack">
      <p className="bill-bar">Acknowledgement slip</p>
      <div className="bill-ack-grid">
        <div>
          <p className="bill-kicker">Customer</p>
          <p className="font-medium leading-snug">{p.name}</p>
        </div>
        <div>
          <p className="bill-kicker">Invoice No</p>
          <p>{doc.number || "DRAFT"}</p>
        </div>
        <div>
          <p className="bill-kicker">Date</p>
          <p>{formatDateDMY(doc.date)}</p>
        </div>
        <div>
          <p className="bill-kicker">Amount</p>
          <p className="tabular-nums">{grand.toFixed(2)}</p>
        </div>
        <div>
          <p className="bill-kicker">Customer signature</p>
          <p className="bill-sign-line">________________</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="bill-tot-row">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
