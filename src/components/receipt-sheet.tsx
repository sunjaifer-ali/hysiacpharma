import { HysiacLogo } from "@/components/logo";
import { formatDateDMY, formatINR } from "@/lib/format";
import { inrInWords, stateName } from "@/lib/gst";
import type { CompanyProfile, LedgerPayment, PartySnapshot } from "@/lib/types";

const MODE: Record<LedgerPayment["mode"], string> = {
  cash: "Cash",
  bank: "Bank transfer",
  upi: "UPI",
  cheque: "Cheque",
};

export function ReceiptSheet({
  payment,
  copy,
  company,
  party,
  billDate,
  billAmount,
  totalSettled,
  balance,
}: {
  payment: LedgerPayment;
  copy: string;
  company: CompanyProfile;
  party?: PartySnapshot;
  billDate?: string;
  billAmount: number;
  totalSettled: number;
  balance: number;
}) {
  const receipt = payment.kind === "receipt";
  const place = [party?.addressLine1, party?.addressLine2, party?.city, party ? stateName(party.stateCode) : "", party?.pincode]
    .filter(Boolean)
    .join(", ");
  return (
    <article className="pay-slip">
      <header className="pay-head">
        <HysiacLogo className="h-16" />
        <p>{company.addressLine1}{company.addressLine2 ? `, ${company.addressLine2}` : ""}</p>
        <p>
          {company.city}, {stateName(company.stateCode)} {company.pincode}
          {company.phone ? ` · ${company.phone}` : ""}
        </p>
        <p>GSTIN : {company.gstin}{company.drugLicense ? ` · DL : ${company.drugLicense}` : ""}</p>
      </header>
      <div className="pay-title-row">
        <h1>{receipt ? "Receipt" : "Payment voucher"}</h1>
        <p>{copy}</p>
      </div>
      <div className="pay-meta">
        <p><span>No.</span> {payment.number || "—"}</p>
        <p><span>Date</span> {formatDateDMY(payment.date)}</p>
      </div>
      <p className="pay-party">
        <span>{receipt ? "Received from" : "Paid to"}</span>
        {payment.partyName}
        {party?.gstin ? ` · GSTIN ${party.gstin}` : ""}
        {place ? <em>{place}</em> : null}
      </p>
      <table>
        <tbody>
          <tr>
            <th>{receipt ? "Invoice" : "Supplier bill"}</th>
            <td>{payment.voucherNumber}{billDate ? ` dated ${formatDateDMY(billDate)}` : ""}</td>
          </tr>
          <tr>
            <th>Bill amount</th>
            <td className="num">{formatINR(billAmount)}</td>
          </tr>
          <tr>
            <th>{receipt ? "Amount received" : "Amount paid"}</th>
            <td className="num pay-strong">{formatINR(payment.amount)}</td>
          </tr>
          <tr>
            <th>Mode</th>
            <td>{MODE[payment.mode]}{payment.reference ? ` · ${payment.reference}` : ""}</td>
          </tr>
          <tr>
            <th>{receipt ? "Total received on this bill" : "Total paid on this bill"}</th>
            <td className="num">{formatINR(totalSettled)}</td>
          </tr>
          <tr>
            <th>Balance due</th>
            <td className="num">{formatINR(balance)}</td>
          </tr>
        </tbody>
      </table>
      <p className="pay-words">{inrInWords(payment.amount)}</p>
      <p className="pay-thanks">{receipt ? "Received with thanks. This is not a tax invoice." : "Payment made as above. This is not a tax invoice."}</p>
      <footer>
        <p>For {company.legalName}</p>
        <div />
        <p>{company.signatory || "Authorised Signatory"}</p>
      </footer>
    </article>
  );
}
