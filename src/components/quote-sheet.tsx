import { HysiacLogo } from "@/components/logo";
import { formatDateDMY, formatINR } from "@/lib/format";
import { inrInWords, invoiceTotals, stateName } from "@/lib/gst";
import { priceListLabel } from "@/lib/pricing";
import type { Quote } from "@/lib/types";

export function QuoteSheet({ quote }: { quote: Quote }) {
  const c = quote.company;
  const p = quote.party;
  const totals = invoiceTotals({ lines: quote.lines, roundOff: 0 });
  const intra = totals.igst <= 0;
  const address = [p.addressLine1, p.addressLine2, p.city, stateName(p.stateCode), p.pincode].filter(Boolean).join(", ");

  return (
    <article className="quote-sheet">
      <header className="quote-head">
        <HysiacLogo className="quote-logo" />
        <div>
          <p className="quote-firm">{c.legalName}</p>
          <p>
            {c.addressLine1}
            {c.addressLine2 ? `, ${c.addressLine2}` : ""}, {c.city}, {stateName(c.stateCode)} {c.pincode}
          </p>
          <p>
            GSTIN {c.gstin}
            {c.drugLicense ? ` · D.L. ${c.drugLicense}` : ""}
            {c.phone ? ` · ${c.phone}` : ""}
            {c.email ? ` · ${c.email}` : ""}
          </p>
        </div>
      </header>

      <div className="quote-banner">
        <h1>Quotation</h1>
        <p>Not a tax invoice</p>
      </div>

      <div className="quote-meta">
        <div>
          <p className="quote-kicker">Prepared for</p>
          <p className="quote-name">{p.name}</p>
          {quote.attention ? <p>Kind attention: {quote.attention}</p> : null}
          {address ? <p>{address}</p> : null}
          <p>{p.gstin ? `GSTIN ${p.gstin}` : "GSTIN not provided"}{p.phone ? ` · ${p.phone}` : ""}</p>
        </div>
        <dl>
          <div><dt>Quotation no.</dt><dd>{quote.number}</dd></div>
          <div><dt>Date</dt><dd>{formatDateDMY(quote.date)}</dd></div>
          <div><dt>Valid until</dt><dd>{formatDateDMY(quote.validUntil)}</dd></div>
          {quote.reference ? <div><dt>Your reference</dt><dd>{quote.reference}</dd></div> : null}
          <div><dt>Price basis</dt><dd>{priceListLabel(quote.priceList)}</dd></div>
        </dl>
      </div>

      <p className="quote-intro">
        We thank you for your enquiry and submit our quotation for the supply of the following products. Rates marked as offered are special to this quotation.
      </p>

      <table>
        <thead>
          <tr>
            <th>Sl</th>
            <th>Product</th>
            <th>Pack</th>
            <th className="num">Qty</th>
            <th className="num">Free</th>
            <th className="num">MRP</th>
            <th className="num">Offered rate</th>
            <th className="num">Disc %</th>
            <th className="num">GST</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {quote.lines.map((line, i) => {
            const special = Math.abs(line.rate - line.listRate) > 0.009;
            const amount = line.taxable + line.cgst + line.sgst + line.igst;
            return (
              <tr key={line.id}>
                <td>{i + 1}</td>
                <td>
                  <strong>{line.name}</strong>
                  <span>
                    {line.manufacturer}
                    {line.hsn ? ` · HSN ${line.hsn}` : ""}
                    {line.offer ? ` · ${line.offer}` : ""}
                    {special ? ` · List ${formatINR(line.listRate)}` : ""}
                  </span>
                </td>
                <td>{line.pack}</td>
                <td className="num">{line.qty}</td>
                <td className="num">{line.freeQty || "—"}</td>
                <td className="num">{line.mrp.toFixed(2)}</td>
                <td className="num">{line.rate.toFixed(2)}</td>
                <td className="num">{line.discountPct ? line.discountPct : "—"}</td>
                <td className="num">{line.gstRate}%</td>
                <td className="num">{amount.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="quote-foot">
        <div>
          {quote.offerNote ? (
            <p className="quote-offer">
              <span>Special price / offer</span>
              {quote.offerNote}
            </p>
          ) : null}
          <p className="quote-words">{inrInWords(totals.grand)}</p>
          <ol>
            <li>This quotation is valid until {formatDateDMY(quote.validUntil)} and is not a tax invoice.</li>
            <li>Supply will follow your purchase order. Batch and expiry will be shown on the tax invoice.</li>
            <li>GST is charged as shown{intra ? " (CGST and SGST)" : " (IGST)"} and is included in the amount column.</li>
            <li>Prices are for this enquiry only and may be revised after the validity date.</li>
            {quote.notes ? <li>{quote.notes}</li> : null}
          </ol>
        </div>
        <div className="quote-tot">
          <p><span>Taxable</span><b>{formatINR(totals.taxable)}</b></p>
          {intra ? (
            <>
              <p><span>CGST</span><b>{formatINR(totals.cgst)}</b></p>
              <p><span>SGST</span><b>{formatINR(totals.sgst)}</b></p>
            </>
          ) : (
            <p><span>IGST</span><b>{formatINR(totals.igst)}</b></p>
          )}
          <p className="quote-grand"><span>Total</span><b>{formatINR(totals.grand)}</b></p>
          <div className="quote-sign">
            <p>For {c.legalName}</p>
            <div />
            <p>{c.signatory || "Authorised Signatory"}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
