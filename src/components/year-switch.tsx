import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { inferYearId, nextYearId, yearLabel } from "@/lib/financial-year";
import { booksUseYear, booksYears } from "@/lib/staff-accounts";
import { useBillingStore } from "@/lib/store";
import { parseBooksBackup } from "@/lib/backup";

export function YearSwitch({ canChange }: { canChange: boolean }) {
  const company = useBillingStore((s) => s.company);
  const year = inferYearId(company);
  const upcoming = nextYearId(year);
  const [years, setYears] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void booksYears().then((result) => {
      if (result.ok) setYears(result.years);
    });
  }, [year]);

  async function openYear(target: string, start: boolean) {
    if (busy) return;
    if (start) {
      const sure = window.confirm(
        `Start ${yearLabel(target)}?\n\nInvoice, purchase, return and receipt numbers begin at 1. Products, parties and stock are copied. Amounts still due stay as opening balances. ${yearLabel(year)} remains saved and can be opened again.`,
      );
      if (!sure) return;
    }
    setBusy(true);
    try {
      const state = useBillingStore.getState();
      const result = await booksUseYear({
        data: {
          year: target,
          start,
          json: JSON.stringify({
            company: state.company,
            products: state.products,
            parties: state.parties,
            invoices: state.invoices,
            purchases: state.purchases,
            purchaseOrders: state.purchaseOrders,
            quotes: state.quotes,
            creditNotes: state.creditNotes,
            payments: state.payments,
            adjustments: state.adjustments,
            openingDues: state.openingDues,
            bin: state.bin,
          }),
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const books = parseBooksBackup(JSON.parse(result.json) as unknown);
      const event = new CustomEvent("hysiac-restore-books", {
        cancelable: true,
        detail: { books, updatedAt: result.updatedAt },
      });
      window.dispatchEvent(event);
      if (!event.defaultPrevented) useBillingStore.getState().replaceAll(books);
      toast.success(start ? `${yearLabel(target)} started at number 1` : `Opened ${yearLabel(target)}`);
    } catch {
      toast.error("Could not change the financial year");
    } finally {
      setBusy(false);
    }
  }

  const others = years.filter((item) => item !== year);

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">{yearLabel(year)}</span>
      {canChange && others.length > 0 ? (
        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          value={year}
          disabled={busy}
          onChange={(event) => {
            if (event.target.value !== year) void openYear(event.target.value, false);
          }}
        >
          <option value={year}>{yearLabel(year)}</option>
          {others.map((item) => (
            <option key={item} value={item}>
              {yearLabel(item)}
            </option>
          ))}
        </select>
      ) : null}
      {canChange && !years.includes(upcoming) ? (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void openYear(upcoming, true)}>
          {busy ? "Please wait…" : `Start ${yearLabel(upcoming)}`}
        </Button>
      ) : null}
    </div>
  );
}
