import { formatDate, formatDateDMY, formatINR } from "@/lib/format";
import { GST_RATES, inrInWords, invoiceTotals, stateName, taxHeadsForRate } from "@/lib/gst";
import { reasonLabel } from "@/lib/returns";
import type { BillCopy, CreditNote } from "@/lib/types";
import { cn } from "@/lib/utils";

function billName(name: string): string {
  return name.replace(/\s+PRIVATE LIMITED\s*$/i, " PVT LTD");
}

export function CreditNoteSheet({
  note,
  copy = "Original",
  className,
}: {
  note: CreditNote;
  copy?: BillCopy;
  className?: string;
}) {
  const totals = invoiceTotals(note);
  const c = note.company;
  const p = note.party;
  const isIgst = totals.igst > 0;
  const heads = GST_RATES.map((rate) => taxHeadsForRate(note.lines, rate)).filter((h) => h.taxable);
  const copies: BillCopy[] = ["Original", "Duplicate", "Triplicate"];
  const colCount = isIgst ? 7 : 8;

  return (
    <article className={cn("print-sheet bill-frame cn-sheet bg-paper text-ink", className)}>
      <p className="bill-copy-row">
        <span className="bill-copy-kind">Credit Note</span>
        {copies.map((mark) => (
          <span key={mark} className={cn("bill-copy-mark", copy === mark && "is-on")}>
            {mark}
          </span>
        ))}
      </p>

      <div className="cn-top">
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
          <h2 className="bill-title">Credit Note</h2>
          <p className="bill-id">
            Credit Note No : <span className="font-medium">{note.number || "DRAFT"}</span>
          </p>
          <p className="bill-id">Date : {formatDateDMY(note.date)}</p>
          {note.invoiceNumber ? (
            <p className="bill-id">
              Against Invoice : {note.invoiceNumber}
              {note.invoiceDate ? ` dated ${formatDate(note.invoiceDate)}` : ""}
            </p>
          ) : null}
          <p className="bill-id">Reason : {reasonLabel(note.reason)}</p>
        </section>
      </div>

      <div className="cn-party">
        <p className="bill-kicker">To</p>
        <p className="bill-party">{p.name}</p>
        <p className="bill-addr">
          {p.addressLine1}
          {p.addressLine2 ? `, ${p.addressLine2}` : ""}
          {p.city ? `, ${p.city}` : ""} {p.pincode}
        </p>
        <p className="bill-id">
          State : {stateName(note.placeOfSupply)} &nbsp; Code : {note.placeOfSupply}
        </p>
        {p.gstin ? <p className="bill-id">GSTIN : {p.gstin}</p> : <p className="bill-id">Unregistered (B2C)</p>}
      </div>

      <table className="cn-table">
        <thead>
          <tr>
            <th>SL</th>
            <th>Particulars</th>
            <th>HSN</th>
            <th className="num">GST%</th>
            <th className="num">Taxable</th>
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
          {note.lines.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="py-8 text-center text-muted-foreground">
                No particulars
              </td>
            </tr>
          ) : (
            note.lines.map((l, i) => (
              <tr key={l.id}>
                <td className="num">{i + 1}</td>
                <td className="desc">
                  {l.name}
                  {l.qty && l.qty !== 1 ? ` · Qty ${l.qty}` : ""}
                  {l.rate ? ` · Rate ${l.rate.toFixed(2)}` : ""}
                </td>
                <td className="mono">{l.hsn || "—"}</td>
                <td className="num">{l.gstRate.toFixed(2)}</td>
                <td className="num">{l.taxable.toFixed(2)}</td>
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
        </tbody>
      </table>

      <div className="cn-foot">
        <div>
          {heads.length > 0 ? (
            <table className="bill-gst-table cn-gst">
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
                {heads.map((h) => (
                  <tr key={h.rate}>
                    <td className="num">{h.rate}%</td>
                    <td className="num">{h.taxable.toFixed(2)}</td>
                    <td className="num">{h.cgst.toFixed(2)}</td>
                    <td className="num">{h.sgst.toFixed(2)}</td>
                    <td className="num">{h.igst.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <p className="bill-words">
            <span>Rupees :</span> {inrInWords(totals.grand)}
          </p>
          {note.notes ? <p className="bill-note">Narration : {note.notes}</p> : null}
          <p className="bill-decl">
            Declaration : We declare that this credit note shows the actual credit allowed and that all particulars are
            true and correct. E & OE.
          </p>
        </div>
        <div className="bill-tot-col">
          <dl className="bill-tot">
            <div className="bill-tot-row">
              <dt>Taxable</dt>
              <dd className="tabular-nums">{totals.taxable.toFixed(2)}</dd>
            </div>
            {totals.cgst > 0 ? (
              <div className="bill-tot-row">
                <dt>CGST</dt>
                <dd className="tabular-nums">{totals.cgst.toFixed(2)}</dd>
              </div>
            ) : null}
            {totals.sgst > 0 ? (
              <div className="bill-tot-row">
                <dt>SGST</dt>
                <dd className="tabular-nums">{totals.sgst.toFixed(2)}</dd>
              </div>
            ) : null}
            {totals.igst > 0 ? (
              <div className="bill-tot-row">
                <dt>IGST</dt>
                <dd className="tabular-nums">{totals.igst.toFixed(2)}</dd>
              </div>
            ) : null}
            <div className="bill-tot-row">
              <dt>Round off</dt>
              <dd className="tabular-nums">{totals.roundOff.toFixed(2)}</dd>
            </div>
          </dl>
          <div className="bill-grand">
            <span>Credit total</span>
            <span className="tabular-nums">{formatINR(totals.grand)}</span>
          </div>
          <div className="bill-sign">
            <p className="bill-kicker">For {billName(c.legalName)}</p>
            <div className="bill-sign-space" />
            {c.signatory && !/^authori[sz]ed signatory$/i.test(c.signatory.trim()) ? (
              <p className="bill-signatory">{c.signatory}</p>
            ) : null}
            <p className="bill-kicker">Authorised Signatory</p>
          </div>
        </div>
      </div>
    </article>
  );
}
