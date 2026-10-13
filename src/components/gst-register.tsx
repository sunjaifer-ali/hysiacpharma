import { formatDateDMY, formatINR } from "@/lib/format";
import type { RegisterLine } from "@/lib/registers";

function money(n: number): string {
  return formatINR(n, { withSymbol: false });
}

export function GstRegister({
  kind,
  lines,
}: {
  kind: "sales" | "purchase";
  lines: RegisterLine[];
}) {
  if (!lines.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Nothing in this period.</p>;
  }

  return (
    <div className="register-grid">
      {lines.map((line, i) => (
        <article key={`${line.voucherNumber}-${line.hsn}-${i}`} className="register-row">
          <header className="register-row-meta">
            <div>
              <p className="font-medium tabular-nums">{line.voucherNumber}</p>
              {kind === "purchase" && line.invoiceNumber ? (
                <p className="text-[10px] text-muted-foreground">Supp. bill {line.invoiceNumber}</p>
              ) : null}
            </div>
            <div>
              <p>{formatDateDMY(line.date)}</p>
              <p className="text-[10px] text-muted-foreground">{line.voucherType}</p>
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{line.partyName}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {line.city}, {line.state}
              </p>
            </div>
            <p className="font-mono text-[10px] sm:text-right">{line.gstin}</p>
          </header>
          <div className="register-row-item">
            <div className="min-w-0">
              <p className="font-medium leading-snug">{line.productName}</p>
              <p className="text-[10px] text-muted-foreground">
                HSN {line.hsn} · GST {line.gstRate}%
                {line.freeQty ? ` · +${line.freeQty} free` : ""}
              </p>
            </div>
            <dl className="register-row-amt">
              <Cell k="Qty" v={String(line.qty)} />
              <Cell k="Rate" v={money(line.rate)} />
              <Cell k="Taxable" v={money(line.taxable)} />
              {line.igst > 0 ? (
                <Cell k="IGST" v={money(line.igst)} />
              ) : (
                <>
                  <Cell k="CGST" v={money(line.cgst)} />
                  <Cell k="SGST" v={money(line.sgst)} />
                </>
              )}
              <Cell k="Total" v={money(line.total)} strong />
            </dl>
          </div>
        </article>
      ))}
    </div>
  );
}

function Cell({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="text-right">
      <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className={`tabular-nums ${strong ? "font-medium" : ""}`}>{v}</dd>
    </div>
  );
}

export function CompactTable({
  heads,
  rows,
  numericFrom,
  empty,
}: {
  heads: string[];
  rows: (string | number)[][];
  numericFrom: number;
  empty: string;
}) {
  return (
    <table className="w-full text-left text-[11px]">
      <thead>
        <tr className="border-b border-forest/30 bg-accent text-[10px] uppercase tracking-wider text-forest">
          {heads.map((h) => (
            <th key={h} className="px-1.5 py-2 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={heads.length} className="px-2 py-8 text-center text-muted-foreground">
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((r, i) => (
            <tr key={i} className="border-b border-border/70 last:border-0 align-top">
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`px-1.5 py-1.5 ${j >= numericFrom ? "text-right tabular-nums whitespace-nowrap" : "break-words"}`}
                >
                  {typeof c === "number" ? (Number.isInteger(c) ? c : c.toFixed(2)) : c || "—"}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
