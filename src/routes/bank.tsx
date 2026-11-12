import { createFileRoute } from "@tanstack/react-router";
import { FileSpreadsheet, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DeleteVoucherButton } from "@/components/delete-voucher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadExcel } from "@/lib/excel";
import { inferYearId, yearRange } from "@/lib/financial-year";
import { formatDate, formatDateDMY, formatINR, todayISO } from "@/lib/format";
import { round2 } from "@/lib/gst";
import { printPage } from "@/lib/print-page";
import { useBillingStore } from "@/lib/store";
import type { BankDeposit, ExpenseCategory, PaymentMode } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/bank")({ component: BankPage });

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "salary", label: "Salary" },
  { value: "ca", label: "CA / office fees" },
  { value: "gst", label: "GST filing fees" },
  { value: "gstpay", label: "GST payment" },
  { value: "purchase", label: "Purchase" },
  { value: "rent", label: "Rent" },
  { value: "electricity", label: "Electricity" },
  { value: "phone", label: "Telephone" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
];

const MODES: { value: PaymentMode; label: string }[] = [
  { value: "bank", label: "Bank" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "cash", label: "Cash" },
];

function isBank(mode: PaymentMode): boolean {
  return mode === "bank" || mode === "upi" || mode === "cheque";
}

function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(key: string): { from: string; to: string; label: string } {
  const [year, month] = key.split("-").map(Number);
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  return { from, to, label };
}

function shiftMonth(key: string, by: number): string {
  const [year, month] = key.split("-").map(Number);
  const next = new Date(year, month - 1 + by, 1);
  return monthKey(next);
}

function categoryLabel(value: ExpenseCategory): string {
  return CATEGORIES.find((item) => item.value === value)?.label ?? value;
}

function BankPage() {
  const company = useBillingStore((s) => s.company);
  const updateCompany = useBillingStore((s) => s.updateCompany);
  const payments = useBillingStore((s) => s.payments);
  const expenses = useBillingStore((s) => s.expenses);
  const deposits = useBillingStore((s) => s.deposits);
  const saveExpense = useBillingStore((s) => s.saveExpense);
  const deleteExpense = useBillingStore((s) => s.deleteExpense);
  const saveDeposit = useBillingStore((s) => s.saveDeposit);
  const deleteDeposit = useBillingStore((s) => s.deleteDeposit);
  const deletePayment = useBillingStore((s) => s.deletePayment);
  const updatePayment = useBillingStore((s) => s.updatePayment);
  const [opening, setOpening] = useState(String(company.bankOpening ?? 15400));
  const [correcting, setCorrecting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [category, setCategory] = useState<ExpenseCategory>("salary");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<PaymentMode>("bank");
  const [note, setNote] = useState("");
  const [month, setMonth] = useState(monthKey());
  const [inAmount, setInAmount] = useState("");
  const [inDate, setInDate] = useState(todayISO());
  const [inSource, setInSource] = useState<BankDeposit["source"]>("own");
  const [inNote, setInNote] = useState("");
  const fy = yearRange(inferYearId(company));
  const [reportFrom, setReportFrom] = useState(fy.from);
  const [reportTo, setReportTo] = useState(fy.to);
  const [editing, setEditing] = useState<{ id: string; kind: "expense" | "deposit" | "payment"; amount: string; date: string; note: string; mode: PaymentMode; category: ExpenseCategory; source: BankDeposit["source"] } | null>(null);

  const start = company.bankOpeningDate || "2026-11-12";
  const startBalance = Number(company.bankOpening ?? 15400) || 0;
  const range = monthRange(month);

  const book = useMemo(() => {
    const lines: { id: string; date: string; particular: string; note: string; in: number; out: number; kind: "payment" | "expense" | "deposit" }[] = [];
    for (const payment of payments) {
      if (!isBank(payment.mode) || payment.date < start) continue;
      const received = payment.kind === "receipt";
      lines.push({
        id: payment.id,
        date: payment.date,
        particular: `${received ? "Received" : "Paid"} ${payment.partyName}${payment.voucherNumber ? ` · ${payment.voucherNumber}` : ""}`,
        note: payment.reference || "",
        in: received ? payment.amount : 0,
        out: received ? 0 : payment.amount,
        kind: "payment",
      });
    }
    for (const expense of expenses) {
      if (!isBank(expense.mode) || expense.date < start) continue;
      lines.push({
        id: expense.id,
        date: expense.date,
        particular: categoryLabel(expense.category),
        note: expense.note,
        in: 0,
        out: expense.amount,
        kind: "expense",
      });
    }
    for (const deposit of deposits) {
      if (deposit.date < start) continue;
      const source = deposit.source === "cash" ? "Cash put in" : deposit.source === "own" ? "Money added" : "Other money in";
      lines.push({
        id: deposit.id,
        date: deposit.date,
        particular: source,
        note: deposit.note,
        in: deposit.amount,
        out: 0,
        kind: "deposit",
      });
    }
    lines.sort((a, b) => a.date.localeCompare(b.date) || a.particular.localeCompare(b.particular));
    let balance = startBalance;
    const withBalance = lines.map((line) => {
      balance = round2(balance + line.in - line.out);
      return { ...line, balance };
    });
    const before = withBalance.filter((line) => line.date < range.from);
    const brought = before.length ? before[before.length - 1]!.balance : startBalance;
    const rows = withBalance.filter((line) => line.date >= range.from && line.date <= range.to);
    return { rows, brought, balance: withBalance.length ? withBalance[withBalance.length - 1]!.balance : startBalance, all: withBalance };
  }, [payments, expenses, deposits, start, startBalance, range.from, range.to]);

  const balance = book.balance;
  const cashIn = (company.cashOpening || 0) + payments.filter((p) => p.mode === "cash" && p.kind === "receipt" && p.date >= start).reduce((s, p) => s + p.amount, 0);
  const cashOut =
    payments.filter((p) => p.mode === "cash" && p.kind === "payment" && p.date >= start).reduce((s, p) => s + p.amount, 0) +
    expenses.filter((e) => e.mode === "cash" && e.date >= start).reduce((s, e) => s + e.amount, 0) +
    deposits.filter((d) => d.source === "cash" && d.date >= start).reduce((s, d) => s + d.amount, 0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  function saveOpening() {
    const value = Number(opening);
    if (!Number.isFinite(value)) {
      toast.error("Enter the bank balance");
      return;
    }
    updateCompany({ bankOpening: round2(value), bankOpeningDate: start });
    setCorrecting(false);
    setSecondsLeft(0);
    toast.success("Opening bank balance saved");
  }

  function addMoney() {
    const value = Number(inAmount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter the amount");
      return;
    }
    try {
      saveDeposit({ date: inDate, amount: value, source: inSource, note: inNote });
      setInAmount("");
      setInNote("");
      toast.success("Money added to the bank");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    }
  }
  function addExpense() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter the amount");
      return;
    }
    try {
      saveExpense({ date, category, amount: value, mode, note });
      setAmount("");
      setNote("");
      toast.success("Expense saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    }
  }

  function beginEdit(id: string, kind: "expense" | "deposit" | "payment") {
    if (kind === "expense") {
      const item = expenses.find((row) => row.id === id);
      if (!item) return;
      setEditing({ id, kind, amount: String(item.amount), date: item.date, note: item.note, mode: item.mode, category: item.category, source: "own" });
    } else if (kind === "deposit") {
      const item = deposits.find((row) => row.id === id);
      if (!item) return;
      setEditing({ id, kind, amount: String(item.amount), date: item.date, note: item.note, mode: "bank", category: "other", source: item.source });
    } else {
      const item = payments.find((row) => row.id === id);
      if (!item) return;
      setEditing({ id, kind, amount: String(item.amount), date: item.date, note: item.reference, mode: item.mode, category: "other", source: "own" });
    }
  }

  function saveEdit() {
    if (!editing) return;
    const value = Number(editing.amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter the amount");
      return;
    }
    try {
      if (editing.kind === "expense") saveExpense({ id: editing.id, date: editing.date, category: editing.category, amount: value, mode: editing.mode, note: editing.note });
      else if (editing.kind === "deposit") saveDeposit({ id: editing.id, date: editing.date, amount: value, source: editing.source, note: editing.note });
      else updatePayment(editing.id, { date: editing.date, mode: editing.mode, reference: editing.note, amount: value });
      setEditing(null);
      toast.success("Entry updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update");
    }
  }

  function reportRows() {
    const before = book.all.filter((line) => line.date < reportFrom);
    const brought = before.length ? before[before.length - 1]!.balance : startBalance;
    const rows = book.all.filter((line) => line.date >= reportFrom && line.date <= reportTo);
    return { brought, rows };
  }

  function exportReport() {
    const report = reportRows();
    downloadExcel(`Bank-${reportFrom}-to-${reportTo}`, [
      {
        name: "Bank",
        rows: [
          [company.legalName],
          [`Bank book  ${formatDateDMY(reportFrom)} to ${formatDateDMY(reportTo)}`],
          [],
          ["Date", "Particular", "Note", "In", "Out", "Balance"],
          [formatDateDMY(reportFrom), "Brought forward", "", "", "", report.brought],
          ...report.rows.map((row) => [formatDateDMY(row.date), row.particular, row.note, row.in || "", row.out || "", row.balance]),
        ],
      },
    ]);
    toast.success("Bank report downloaded");
  }

  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="font-display text-3xl">Bank</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
          <p className="text-[11px] uppercase tracking-wider">Bank balance</p>
          <p className="mt-1 font-display text-3xl tabular-nums">{formatINR(balance)}</p>
          <p className="mt-1 text-xs opacity-80">Opening {formatINR(startBalance)} · {formatDate(start)}</p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Cash in hand</p>
          <p className="mt-1 text-2xl font-medium tabular-nums">{formatINR(round2(cashIn - cashOut))}</p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          {correcting ? (
            <>
              <Label className="mb-1.5 block">Correct opening</Label>
              <div className="flex gap-2">
                <Input inputMode="decimal" value={opening} disabled={secondsLeft > 0} onChange={(e) => setOpening(e.target.value)} />
                <Button variant="outline" disabled={secondsLeft > 0} onClick={saveOpening}>{secondsLeft > 0 ? `${secondsLeft}s` : "Save"}</Button>
              </div>
              <button type="button" className="mt-2 text-xs text-muted-foreground" onClick={() => { setCorrecting(false); setSecondsLeft(0); }}>Cancel</button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => { setCorrecting(true); setSecondsLeft(10); }}>Correct opening</Button>
          )}
        </div>
      </div>

      <section className="mt-5 rounded-2xl border border-border p-4">
        <h2 className="font-medium">Add money to bank</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div>
            <Label className="mb-1.5 block">Amount</Label>
            <Input inputMode="decimal" value={inAmount} onChange={(e) => setInAmount(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block">Date</Label>
            <Input type="date" value={inDate} onChange={(e) => setInDate(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block">From</Label>
            <Select value={inSource} onValueChange={(value) => setInSource(value as BankDeposit["source"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="own">Own money</SelectItem>
                <SelectItem value="cash">Cash from the shop</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">Note</Label>
            <Input value={inNote} onChange={(e) => setInNote(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <Button className="mt-3" onClick={addMoney}>Add to bank</Button>
      </section>

      <section className="mt-5 rounded-2xl border border-border p-4">
        <h2 className="font-medium">Add spending</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-5">
          <div>
            <Label className="mb-1.5 block">What</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as ExpenseCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">Amount</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block">From</Label>
            <Select value={mode} onValueChange={(value) => setMode(value as PaymentMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <Button className="mt-3" onClick={addExpense}>Save expense</Button>
      </section>

      <div className="no-print mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-medium">{range.label}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setMonth((current) => shiftMonth(current, -1))}>Previous</Button>
          <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" />
          <Button type="button" variant="outline" onClick={() => setMonth((current) => shiftMonth(current, 1))}>Next</Button>
          <Button type="button" variant="ghost" onClick={() => setMonth(monthKey())}>This month</Button>
        </div>
      </div>

      <section className="no-print mt-4 rounded-2xl border border-border p-4">
        <h2 className="font-medium">Bank report</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <Label className="mb-1.5 block">From</Label>
            <Input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block">To</Label>
            <Input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} />
          </div>
          <Button type="button" variant="outline" onClick={() => { setReportFrom(fy.from); setReportTo(fy.to); }}>This FY</Button>
          <Button type="button" variant="outline" onClick={exportReport}><FileSpreadsheet className="size-4" />Excel</Button>
          <Button type="button" variant="outline" onClick={() => printPage("landscape")}><Printer className="size-4" />PDF</Button>
        </div>
      </section>

      {editing ? (
        <section className="no-print mt-4 rounded-2xl border border-border p-4">
          <h2 className="font-medium">Edit entry</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <div>
              <Label className="mb-1.5 block">Amount</Label>
              <Input inputMode="decimal" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1.5 block">Date</Label>
              <Input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
            </div>
            {editing.kind === "expense" ? (
              <div>
                <Label className="mb-1.5 block">What</Label>
                <Select value={editing.category} onValueChange={(value) => setEditing({ ...editing, category: value as ExpenseCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : null}
            {editing.kind !== "deposit" ? (
              <div>
                <Label className="mb-1.5 block">From</Label>
                <Select value={editing.mode} onValueChange={(value) => setEditing({ ...editing, mode: value as PaymentMode })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MODES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label className="mb-1.5 block">From</Label>
                <Select value={editing.source} onValueChange={(value) => setEditing({ ...editing, source: value as BankDeposit["source"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="own">Own money</SelectItem>
                    <SelectItem value="cash">Cash from the shop</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block">Note</Label>
              <Input value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={saveEdit}>Save</Button>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </section>
      ) : null}

      <div className="no-print mt-3 overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Particular</th>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 text-right font-medium">In</th>
                <th className="px-4 py-3 text-right font-medium">Out</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/70">
                <td className="px-4 py-3">{formatDate(range.from)}</td>
                <td className="px-4 py-3">Brought forward</td>
                <td />
                <td />
                <td />
                <td className="px-4 py-3 text-right tabular-nums">{formatINR(book.brought)}</td>
                <td />
              </tr>
              {book.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No bank entries in {range.label}.</td>
                </tr>
              ) : book.rows.map((row) => (
                <tr key={row.id} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3">{formatDate(row.date)}</td>
                  <td className="px-4 py-3">{row.particular}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.note || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.in ? formatINR(row.in) : ""}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.out ? formatINR(row.out) : ""}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatINR(row.balance)}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => beginEdit(row.id, row.kind)}>Edit</Button>
                      <DeleteVoucherButton
                        compact
                        title="Delete this bank entry?"
                        description="The bank balance is updated. The button stays locked for 10 seconds."
                        onConfirm={() => {
                          if (row.kind === "deposit") deleteDeposit(row.id);
                          else if (row.kind === "expense") deleteExpense(row.id);
                          else deletePayment(row.id);
                          toast.success("Entry removed");
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <article className="print-sheet hidden print:block">
        <h2 className="font-display text-xl">{company.legalName}</h2>
        <p className="text-sm">Bank book · {formatDateDMY(reportFrom)} to {formatDateDMY(reportTo)}</p>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr>
              <th>Date</th>
              <th>Particular</th>
              <th>Note</th>
              <th className="text-right">In</th>
              <th className="text-right">Out</th>
              <th className="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{formatDate(reportFrom)}</td>
              <td>Brought forward</td>
              <td />
              <td />
              <td />
              <td className="text-right">{formatINR(reportRows().brought)}</td>
            </tr>
            {reportRows().rows.map((row) => (
              <tr key={row.id}>
                <td>{formatDate(row.date)}</td>
                <td>{row.particular}</td>
                <td>{row.note || "—"}</td>
                <td className="text-right">{row.in ? formatINR(row.in) : ""}</td>
                <td className="text-right">{row.out ? formatINR(row.out) : ""}</td>
                <td className="text-right">{formatINR(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </AppShell>
  );
}
