import { FileSpreadsheet, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadExcel } from "@/lib/excel";
import { inferYearId, yearRange } from "@/lib/financial-year";
import { formatDateDMY, formatINR } from "@/lib/format";
import { partyLedger, type LedgerSide } from "@/lib/party-ledger";
import { printPage } from "@/lib/print-page";
import { useBillingStore } from "@/lib/store";

export function PartyLedgerPanel({ initialSide = "customer", initialParty = "" }: { initialSide?: LedgerSide; initialParty?: string }) {
  const company = useBillingStore((s) => s.company);
  const parties = useBillingStore((s) => s.parties);
  const invoices = useBillingStore((s) => s.invoices);
  const purchases = useBillingStore((s) => s.purchases);
  const creditNotes = useBillingStore((s) => s.creditNotes);
  const payments = useBillingStore((s) => s.payments);
  const openingDues = useBillingStore((s) => s.openingDues);
  const range = yearRange(inferYearId(company));
  const today = new Date().toISOString().slice(0, 10);
  const [side, setSide] = useState<LedgerSide>(initialSide);
  const [partyId, setPartyId] = useState(initialParty);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(today < range.to ? today : range.to);

  const choices = parties
    .filter((party) => (side === "customer" ? party.isCustomer : party.isSupplier))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const party = choices.find((item) => item.id === partyId) ?? null;
  const selected = party?.id ?? "";

  const ledger = useMemo(() => {
    if (!selected) return null;
    return partyLedger({ side, partyId: selected, from, to, invoices, purchases, creditNotes, payments, openingDues });
  }, [side, selected, from, to, invoices, purchases, creditNotes, payments, openingDues]);

  const dueLabel = side === "customer" ? "Due from customer" : "Due to supplier";

  function exportExcel() {
    if (!ledger || !party) return;
    downloadExcel(`${party.name}-ledger`, [
      {
        name: "Ledger",
        rows: [
          [company.legalName],
          [`${side === "customer" ? "Customer" : "Supplier"} ledger — ${party.name}`],
          [`${formatDateDMY(from)} to ${formatDateDMY(to)}`],
          [],
          ["Date", "Number", "Particular", "Debit", "Credit", "Balance"],
          ["", "", "Opening balance", "", "", ledger.opening],
          ...ledger.lines.map((line) => [formatDateDMY(line.date), line.number, line.particular, line.debit || "", line.credit || "", line.balance]),
          ["", "", "Closing balance", ledger.debit, ledger.credit, ledger.closing],
        ],
      },
    ]);
  }

  return (
    <div>
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted-foreground">Choose a party and the dates. The balance is what is still due.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!ledger} onClick={exportExcel}>
            <FileSpreadsheet className="size-4" />
            Excel
          </Button>
          <Button variant="outline" disabled={!ledger} onClick={() => printPage("portrait")}>
            <Printer className="size-4" />
            PDF
          </Button>
        </div>
      </div>

      <div className="no-print mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Side</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={side === "customer" ? "default" : "outline"} onClick={() => { setSide("customer"); setPartyId(""); }}>
              Customer
            </Button>
            <Button type="button" variant={side === "supplier" ? "default" : "outline"} onClick={() => { setSide("supplier"); setPartyId(""); }}>
              Supplier
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ledger-party">{side === "customer" ? "Customer" : "Supplier"}</Label>
          <select
            id="ledger-party"
            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={selected}
            onChange={(event) => setPartyId(event.target.value)}
          >
            <option value="">Select</option>
            {choices.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ledger-from">From</Label>
          <Input id="ledger-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ledger-to">To</Label>
          <Input id="ledger-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
      </div>

      {party && ledger ? (
        <section className="mt-6">
          <div className="mb-3">
            <h2 className="font-display text-2xl">{party.name}</h2>
            <p className="text-sm text-muted-foreground">
              {party.city} · {formatDateDMY(from)} to {formatDateDMY(to)}
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-secondary/60 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Number</th>
                  <th className="px-3 py-2 font-medium">Particular</th>
                  <th className="px-3 py-2 text-right font-medium">Debit</th>
                  <th className="px-3 py-2 text-right font-medium">Credit</th>
                  <th className="px-3 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-3 py-2" colSpan={3}>Opening balance</td>
                  <td />
                  <td />
                  <td className="px-3 py-2 text-right tabular-nums">{formatINR(ledger.opening)}</td>
                </tr>
                {ledger.lines.length === 0 ? (
                  <tr className="border-t border-border">
                    <td className="px-3 py-6 text-muted-foreground" colSpan={6}>No entries in these dates.</td>
                  </tr>
                ) : (
                  ledger.lines.map((line, index) => (
                    <tr key={`${line.date}-${line.number}-${index}`} className="border-t border-border">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateDMY(line.date)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{line.number}</td>
                      <td className="px-3 py-2">{line.particular}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.debit ? formatINR(line.debit) : ""}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.credit ? formatINR(line.credit) : ""}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatINR(line.balance)}</td>
                    </tr>
                  ))
                )}
                <tr className="border-t border-border font-medium">
                  <td className="px-3 py-2" colSpan={3}>{dueLabel}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatINR(ledger.debit)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatINR(ledger.credit)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatINR(ledger.closing)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">Select a {side === "customer" ? "customer" : "supplier"} to see the ledger.</p>
      )}
    </div>
  );
}
