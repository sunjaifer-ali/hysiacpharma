import { formatDateDMY } from "@/lib/format";
import { stateName } from "@/lib/gst";
import type { PurchaseOrder } from "@/lib/types";

export function PurchaseOrderSheet({ order }: { order: PurchaseOrder }) {
  const company = order.company;
  const supplier = order.supplier;
  const qty = order.lines.reduce((sum, line) => sum + line.qty, 0);

  return (
    <article className="print-sheet po-sheet mx-auto max-w-[210mm] bg-white p-6 text-[12px] text-foreground shadow-[var(--shadow-border)] print:shadow-none">
      <header className="border-b-2 border-primary pb-3 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-primary">Purchase order</p>
        <h2 className="font-display text-xl uppercase">{company.legalName}</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {company.addressLine1}
          {company.addressLine2 ? `, ${company.addressLine2}` : ""}, {company.city}, {stateName(company.stateCode)}{" "}
          {company.pincode}
        </p>
        <p className="text-[11px] text-muted-foreground">
          GSTIN {company.gstin}
          {company.drugLicense ? ` · D.L. ${company.drugLicense}` : ""} · Ph {company.phone}
        </p>
      </header>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">To</p>
          <p className="font-medium">{supplier.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {[supplier.addressLine1, supplier.addressLine2, supplier.city, supplier.pincode].filter(Boolean).join(", ")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {supplier.gstin ? `GSTIN ${supplier.gstin}` : "Unregistered"}
            {supplier.phone ? ` · ${supplier.phone}` : ""}
          </p>
        </div>
        <div className="text-right text-[11px]">
          <p>
            <span className="text-muted-foreground">Order no </span>
            <span className="font-medium">{order.number}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Date </span>
            {formatDateDMY(order.date)}
          </p>
          {order.neededBy ? (
            <p>
              <span className="text-muted-foreground">Required by </span>
              {formatDateDMY(order.neededBy)}
            </p>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-[11px]">Please supply the following. This is a request, not a tax invoice.</p>

      <table className="mt-2 w-full border-collapse text-left">
        <thead>
          <tr className="border-y border-primary text-[10px] uppercase tracking-wider">
            <th className="py-1.5 pr-2 font-medium">SL</th>
            <th className="py-1.5 pr-2 font-medium">Product</th>
            <th className="py-1.5 pr-2 font-medium">Pack</th>
            <th className="py-1.5 pr-2 font-medium">Mfr</th>
            <th className="py-1.5 pr-2 text-right font-medium">Qty</th>
            <th className="py-1.5 font-medium">Unit</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line, index) => (
            <tr key={line.id} className="border-b border-border">
              <td className="py-1.5 pr-2">{index + 1}</td>
              <td className="py-1.5 pr-2">
                <div>{line.name}</div>
                {line.note ? <div className="text-[10px] text-muted-foreground">{line.note}</div> : null}
              </td>
              <td className="py-1.5 pr-2">{line.pack || "—"}</td>
              <td className="py-1.5 pr-2">{line.manufacturer || "—"}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{line.qty}</td>
              <td className="py-1.5">{line.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-2 text-right text-[11px]">
        {order.lines.length} items · {qty} units
      </p>
      {order.notes ? <p className="mt-2 text-[11px]">Note: {order.notes}</p> : null}

      <div className="mt-10 flex justify-end">
        <div className="text-center text-[11px]">
          <p>For {company.legalName}</p>
          <p className="mt-8 border-t border-foreground pt-1">{company.signatory || "Authorised signatory"}</p>
        </div>
      </div>
    </article>
  );
}
