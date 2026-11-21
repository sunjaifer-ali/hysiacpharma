import { createFileRoute } from "@tanstack/react-router";
import { FileSpreadsheet, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PeriodFilter, useVoucherPeriod } from "@/components/period-filter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadExcel } from "@/lib/excel";
import { formatDate, formatINR, todayISO } from "@/lib/format";
import { useBillingStore } from "@/lib/store";
import type { PaymentMode } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/employees")({ component: EmployeesPage });

const MODES: { value: PaymentMode; label: string }[] = [
  { value: "bank", label: "Bank" },
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
];

function EmployeesPage() {
  const employees = useBillingStore((s) => s.employees);
  const salaryPays = useBillingStore((s) => s.salaryPays);
  const saveEmployee = useBillingStore((s) => s.saveEmployee);
  const recordSalary = useBillingStore((s) => s.recordSalary);
  const company = useBillingStore((s) => s.company);
  const period = useVoucherPeriod();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [pan, setPan] = useState("");
  const [phone, setPhone] = useState("");
  const [monthly, setMonthly] = useState("");
  const [joined, setJoined] = useState(todayISO());
  const [payId, setPayId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(todayISO());
  const [payMode, setPayMode] = useState<PaymentMode>("bank");
  const [payNote, setPayNote] = useState("");

  const rows = useMemo(() => {
    return employees
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((employee) => {
        const pays = salaryPays.filter((pay) => pay.employeeId === employee.id && period.includes(pay.date));
        const paid = pays.reduce((sum, pay) => sum + pay.amount, 0);
        return { employee, pays, paid };
      });
  }, [employees, salaryPays, period]);

  function addEmployee() {
    try {
      saveEmployee({
        name,
        designation,
        pan,
        phone,
        monthlySalary: Number(monthly) || 0,
        joinedOn: joined,
        active: true,
        note: "",
      });
      setName("");
      setDesignation("");
      setPan("");
      setPhone("");
      setMonthly("");
      setOpen(false);
      toast.success("Employee saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    }
  }

  function paySalary() {
    try {
      recordSalary({ employeeId: payId, date: payDate, amount: Number(payAmount), mode: payMode, note: payNote });
      setPayAmount("");
      setPayNote("");
      toast.success("Salary recorded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    }
  }

  function exportList() {
    downloadExcel(`Salary-${period.from}-to-${period.to}`, [
      {
        name: "Salary",
        rows: [
          [company.legalName],
          [`Employee salary  ${period.label}`],
          [],
          ["Name", "Designation", "PAN", "Phone", "Monthly salary", "Paid in period"],
          ...rows.map((row) => [
            row.employee.name,
            row.employee.designation,
            row.employee.pan,
            row.employee.phone,
            row.employee.monthlySalary,
            row.paid,
          ]),
          ["Total", "", "", "", "", rows.reduce((sum, row) => sum + row.paid, 0)],
        ],
      },
    ]);
    toast.success("Salary list downloaded");
  }

  return (
    <AppShell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">Salary list for the CA and ITR.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportList}><FileSpreadsheet className="size-4" />Excel</Button>
          <Button onClick={() => setOpen((value) => !value)}><Plus className="size-4" />Add employee</Button>
        </div>
      </div>

      {open ? (
        <section className="rounded-2xl border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="mb-1.5 block">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Designation</Label>
              <Input value={designation} onChange={(e) => setDesignation(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">PAN</Label>
              <Input value={pan} onChange={(e) => setPan(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Monthly salary</Label>
              <Input inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Joined</Label>
              <Input type="date" value={joined} onChange={(e) => setJoined(e.target.value)} />
            </div>
          </div>
          <Button className="mt-3" onClick={addEmployee}>Save employee</Button>
        </section>
      ) : null}

      <section className="mt-5 rounded-2xl border border-border p-4">
        <h2 className="font-medium">Record salary</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-5">
          <div>
            <Label className="mb-1.5 block">Employee</Label>
            <Select value={payId} onValueChange={setPayId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">Amount</Label>
            <Input inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block">Date</Label>
            <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block">From</Label>
            <Select value={payMode} onValueChange={(value) => setPayMode(value as PaymentMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MODES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">Note</Label>
            <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <Button className="mt-3" onClick={paySalary}>Save salary</Button>
      </section>

      <PeriodFilter from={period.from} to={period.to} preset={period.preset} onFrom={period.setFrom} onTo={period.setTo} onPreset={period.apply} />

      <div className="mt-4 overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Designation</th>
              <th className="px-4 py-3 font-medium">PAN</th>
              <th className="px-4 py-3 text-right font-medium">Monthly</th>
              <th className="px-4 py-3 text-right font-medium">Paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No employees yet.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.employee.id} className="border-b border-border/70 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{row.employee.name}</p>
                  <p className="text-[11px] text-muted-foreground">{row.employee.phone || "—"} · joined {formatDate(row.employee.joinedOn)}</p>
                </td>
                <td className="px-4 py-3">{row.employee.designation || "—"}</td>
                <td className="px-4 py-3">{row.employee.pan || "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatINR(row.employee.monthlySalary)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatINR(row.paid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
