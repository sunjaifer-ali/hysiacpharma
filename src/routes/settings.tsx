import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { INDIAN_STATES, isValidGstin, panFromGstin } from "@/lib/gst";
import { useBillingStore } from "@/lib/store";
import type { CompanyProfile } from "@/lib/types";
import { DeleteVoucherButton } from "@/components/delete-voucher";
import { booksHistory, booksRestore } from "@/lib/staff-accounts";
import { toast } from "sonner";
import { AppLockCard } from "@/components/app-lock";
import { isDesktopApp } from "@/lib/desktop";
import { BACKUP_LATEST_NAME, downloadBackupFile, backupJson, parseBooksBackup } from "@/lib/backup";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const company = useBillingStore((s) => s.company);
  const update = useBillingStore((s) => s.updateCompany);
  const [restoring, setRestoring] = useState(false);
  const [backupChoices, setBackupChoices] = useState<{ id: string; label: string }[]>([]);
  const [backupDay, setBackupDay] = useState("latest");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CompanyProfile | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timer = useRef<number | null>(null);
  const pending = useRef<CompanyProfile | null>(null);
  const form = draft ?? company;

  useEffect(() => {
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  useEffect(() => {
    if (isDesktopApp) return;
    void booksHistory()
      .then((result) => {
        if (!result.ok) return;
        const next: { id: string; label: string }[] = [];
        const latestDay = result.latest ? istDay(result.latest.savedAt) : "";
        if (result.latest) next.push({ id: "latest", label: `Latest · ${formatBackupWhen(result.latest.savedAt)}` });
        for (const day of result.days) {
          if (day.day === latestDay) continue;
          next.push({
            id: day.day,
            label: day.day.endsWith("#earlier") ? `Earlier today · ${formatBackupWhen(day.savedAt)}` : formatBackupWhen(day.savedAt),
          });
        }
        setBackupChoices(next);
        setBackupDay(next[0]?.id ?? "latest");
      })
      .catch(() => setBackupChoices([]));
  }, []);

  function stopWait() {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    pending.current = null;
    setSecondsLeft(0);
  }

  function set<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    setDraft((current) => ({ ...(current ?? company), [key]: value }));
  }

  function beginEdit() {
    stopWait();
    setDraft({ ...company });
    setEditing(true);
  }

  function cancelEdit() {
    stopWait();
    setDraft(null);
    setEditing(false);
  }

  function requestSave() {
    if (!draft || secondsLeft > 0) return;
    pending.current = draft;
    let left = 10;
    setSecondsLeft(left);
    timer.current = window.setInterval(() => {
      left -= 1;
      setSecondsLeft(left);
      if (left > 0) return;
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
      const next = pending.current;
      pending.current = null;
      if (next) update(next);
      setDraft(null);
      setEditing(false);
      toast.success("Company details saved");
    }, 1000);
  }

  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Company details stay closed until you choose Edit details. A save waits 10 seconds so it can be cancelled.
        </p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>{company.legalName || "Company"}</CardTitle>
              <CardDescription>{company.tradeName}</CardDescription>
            </div>
            {editing ? null : (
              <Button type="button" variant="outline" onClick={beginEdit}>
                Edit details
              </Button>
            )}
          </CardHeader>
        </Card>

        {editing ? (
          <>
          <fieldset disabled={secondsLeft > 0} className="grid min-w-0 gap-4 border-0 p-0">
        <Card>
          <CardHeader>
            <CardTitle>Business identity</CardTitle>
            <CardDescription>Registered particulars for Hysiac Pharmaceuticals Pvt Ltd</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Legal name" className="sm:col-span-2">
              <Input value={form.legalName} disabled={secondsLeft > 0} onChange={(e) => set("legalName", e.target.value)} />
            </Field>
            <Field label="Trade name">
              <Input value={form.tradeName} disabled={secondsLeft > 0} onChange={(e) => set("tradeName", e.target.value)} />
            </Field>
            <Field label="GSTIN">
              <Input
                value={form.gstin}
                className="uppercase"
                maxLength={15}
                disabled={secondsLeft > 0}
                onChange={(e) => set("gstin", e.target.value.toUpperCase())}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                PAN {panFromGstin(form.gstin) || "—"}
                {form.gstin && !isValidGstin(form.gstin) ? " · GSTIN checksum failed" : ""}
                {" · Check the checksum before saving"}
              </p>
            </Field>
            <Field label="CIN">
              <Input value={form.cin} onChange={(e) => set("cin", e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="Email">
              <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Address line 1" className="sm:col-span-2">
              <Input value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} />
            </Field>
            <Field label="Address line 2" className="sm:col-span-2">
              <Input value={form.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} />
            </Field>
            <Field label="City">
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="PIN">
              <Input value={form.pincode} onChange={(e) => set("pincode", e.target.value)} />
            </Field>
            <Field label="State" className="sm:col-span-2">
              <Select value={form.stateCode} onValueChange={(v) => set("stateCode", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.code} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Drug licences</CardTitle>
            <CardDescription>Wholesale licence numbers printed on invoices.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Form 20B (wholesale)">
              <Input
                value={form.drugLicense20 ?? ""}
                className="uppercase font-mono"
                onChange={(e) => set("drugLicense20", e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Form 21B (wholesale)">
              <Input
                value={form.drugLicense21 ?? ""}
                className="uppercase font-mono"
                onChange={(e) => set("drugLicense21", e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Valid upto">
              <Input
                type="date"
                value={form.drugLicenseValidUpto ?? ""}
                onChange={(e) => set("drugLicenseValidUpto", e.target.value)}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Apply for retention 3 months before this date.</p>
            </Field>
            <Field label="Prints as">
              <Input value={[form.drugLicense20, form.drugLicense21].filter(Boolean).join(", ")} readOnly className="font-mono bg-muted/40" />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bank & invoicing</CardTitle>
            <CardDescription>Printed on the tax invoice footer</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Bank">
              <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
            </Field>
            <Field label="Branch">
              <Input value={form.bankBranch} onChange={(e) => set("bankBranch", e.target.value)} />
            </Field>
            <Field label="Account">
              <Input value={form.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} />
            </Field>
            <Field label="IFSC">
              <Input value={form.bankIfsc} onChange={(e) => set("bankIfsc", e.target.value.toUpperCase())} />
            </Field>
            <Field label="Invoice prefix">
              <Input value={form.invoicePrefix} onChange={(e) => set("invoicePrefix", e.target.value)} />
            </Field>
            <Field label="Next number">
              <Input
                type="number"
                min={1}
                value={form.nextNumber}
                onChange={(e) => set("nextNumber", Number(e.target.value))}
              />
            </Field>
            <Field label="Purchase prefix">
              <Input value={form.purchasePrefix} onChange={(e) => set("purchasePrefix", e.target.value)} />
            </Field>
            <Field label="Next purchase no.">
              <Input
                type="number"
                min={1}
                value={form.nextPurchaseNumber}
                onChange={(e) => set("nextPurchaseNumber", Number(e.target.value))}
              />
            </Field>
            <Field label="Return bill prefix">
              <Input value={form.returnPrefix} onChange={(e) => set("returnPrefix", e.target.value)} />
            </Field>
            <Field label="Next return no.">
              <Input
                type="number"
                min={1}
                value={form.nextReturnNumber}
                onChange={(e) => set("nextReturnNumber", Number(e.target.value))}
              />
            </Field>
            <Field label="Credit note prefix">
              <Input value={form.creditNotePrefix} onChange={(e) => set("creditNotePrefix", e.target.value)} />
            </Field>
            <Field label="Next credit note no.">
              <Input
                type="number"
                min={1}
                value={form.nextCreditNoteNumber}
                onChange={(e) => set("nextCreditNoteNumber", Number(e.target.value))}
              />
            </Field>
            <Field label="Default salesman">
              <Input value={form.salesman} onChange={(e) => set("salesman", e.target.value)} />
            </Field>
            <Field label="Signatory">
              <Input value={form.signatory} onChange={(e) => set("signatory", e.target.value)} />
            </Field>
            <Field label="Terms" className="sm:col-span-2">
              <Textarea value={form.terms} onChange={(e) => set("terms", e.target.value)} rows={3} />
            </Field>
          </CardContent>
        </Card>
        </fieldset>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={requestSave} disabled={secondsLeft > 0}>
            {secondsLeft > 0 ? `Saving in ${secondsLeft}s` : "Save details"}
          </Button>
          <Button type="button" variant="outline" onClick={secondsLeft > 0 ? stopWait : cancelEdit}>
            {secondsLeft > 0 ? "Cancel save" : "Cancel"}
          </Button>
          {secondsLeft > 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is stored until these 10 seconds finish.</p>
          ) : null}
        </div>
          </>
        ) : null}

        {isDesktopApp ? <AppLockCard /> : null}

        <Card>
          <CardHeader>
            <CardTitle>Backup</CardTitle>
            <CardDescription>
              A backup is saved when you make an entry. Today keeps the latest copy and the one before it. The last 3 days stay. Pick a date to put that copy back.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="w-fit"
              onClick={() => {
                const s = useBillingStore.getState();
                downloadBackupFile(
                  backupJson({
                    company: s.company,
                    products: s.products,
                    parties: s.parties,
                    invoices: s.invoices,
                    purchases: s.purchases,
                    purchaseOrders: s.purchaseOrders,
                    quotes: s.quotes,
                    creditNotes: s.creditNotes,
                    payments: s.payments,
                    adjustments: s.adjustments,
                    openingDues: s.openingDues,
                    bin: s.bin,
                  }),
                  BACKUP_LATEST_NAME,
                );
              }}
            >
              Download backup
            </Button>
            {isDesktopApp ? null : backupChoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No backup date in Neon yet. Save a bill and the date will appear here.</p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={backupDay} onValueChange={setBackupDay}>
                  <SelectTrigger className="w-full sm:w-80">
                    <SelectValue placeholder="Choose a backup date" />
                  </SelectTrigger>
                  <SelectContent>
                    {backupChoices.map((choice) => (
                      <SelectItem key={choice.id} value={choice.id}>
                        {choice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DeleteVoucherButton
                  label={restoring ? "Restoring…" : "Restore this date"}
                  buttonVariant="outline"
                  title="Restore this backup?"
                  description={`This replaces the books on this browser with ${backupChoices.find((choice) => choice.id === backupDay)?.label ?? "the selected backup"}. Bills entered after that copy are removed here, and this older copy becomes the live Neon copy.`}
                  confirmLabel="Restore this date"
                  onConfirm={() => {
                    const label = backupChoices.find((choice) => choice.id === backupDay)?.label ?? "the selected backup";
                    setRestoring(true);
                    void booksRestore({ data: { day: backupDay } })
                      .then((remote) => {
                        if (!remote.ok) {
                          toast.error(remote.error);
                          return;
                        }
                        const books = parseBooksBackup(JSON.parse(remote.json) as unknown);
                        const event = new CustomEvent("hysiac-restore-books", {
                          cancelable: true,
                          detail: { books, updatedAt: remote.updatedAt },
                        });
                        window.dispatchEvent(event);
                        if (!event.defaultPrevented) useBillingStore.getState().replaceAll(books);
                        toast.success(`Restored ${label}`);
                      })
                      .catch(() => toast.error("Could not reach Neon"))
                      .finally(() => setRestoring(false));
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function formatBackupWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function istDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}
