import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
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
import { booksLoad } from "@/lib/staff-accounts";
import { toast } from "sonner";
import { AppLockCard } from "@/components/app-lock";
import { isDesktopApp } from "@/lib/desktop";
import { BACKUP_LATEST_NAME, downloadBackupFile, backupJson, parseBooksBackup } from "@/lib/backup";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const company = useBillingStore((s) => s.company);
  const update = useBillingStore((s) => s.updateCompany);
  const [restoring, setRestoring] = useState(false);

  function set<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    update({ [key]: value });
  }

  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Company details print on every tax invoice. GSTIN, drug licences, address and bank can be edited whenever they change.
        </p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Business identity</CardTitle>
            <CardDescription>Registered particulars for Hysiac Pharmaceuticals Pvt Ltd</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Legal name" className="sm:col-span-2">
              <Input value={company.legalName} onChange={(e) => set("legalName", e.target.value)} />
            </Field>
            <Field label="Trade name">
              <Input value={company.tradeName} onChange={(e) => set("tradeName", e.target.value)} />
            </Field>
            <Field label="GSTIN">
              <Input
                value={company.gstin}
                className="uppercase"
                maxLength={15}
                onChange={(e) => set("gstin", e.target.value.toUpperCase())}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                PAN {panFromGstin(company.gstin) || "—"}
                {company.gstin && !isValidGstin(company.gstin) ? " · GSTIN checksum failed" : ""}
                {" · Edit if the GSTIN changes"}
              </p>
            </Field>
            <Field label="CIN">
              <Input value={company.cin} onChange={(e) => set("cin", e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={company.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="Email">
              <Input value={company.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Address line 1" className="sm:col-span-2">
              <Input value={company.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} />
            </Field>
            <Field label="Address line 2" className="sm:col-span-2">
              <Input value={company.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} />
            </Field>
            <Field label="City">
              <Input value={company.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="PIN">
              <Input value={company.pincode} onChange={(e) => set("pincode", e.target.value)} />
            </Field>
            <Field label="State" className="sm:col-span-2">
              <Select value={company.stateCode} onValueChange={(v) => set("stateCode", v)}>
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
            <CardDescription>
              Kerala wholesale licences from the Oct 2025 retention. Edit the numbers and valid-upto date when you retain again in 2030.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Form 20B (wholesale)">
              <Input
                value={company.drugLicense20 ?? ""}
                className="uppercase font-mono"
                onChange={(e) => set("drugLicense20", e.target.value.toUpperCase())}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Was KL-MLP-151189</p>
            </Field>
            <Field label="Form 21B (wholesale)">
              <Input
                value={company.drugLicense21 ?? ""}
                className="uppercase font-mono"
                onChange={(e) => set("drugLicense21", e.target.value.toUpperCase())}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Was KL-MLP-151190</p>
            </Field>
            <Field label="Valid upto">
              <Input
                type="date"
                value={company.drugLicenseValidUpto ?? ""}
                onChange={(e) => set("drugLicenseValidUpto", e.target.value)}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Apply for retention 3 months before this date.</p>
            </Field>
            <Field label="Prints as">
              <Input value={company.drugLicense} readOnly className="font-mono bg-muted/40" />
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
              <Input value={company.bankName} onChange={(e) => set("bankName", e.target.value)} />
            </Field>
            <Field label="Branch">
              <Input value={company.bankBranch} onChange={(e) => set("bankBranch", e.target.value)} />
            </Field>
            <Field label="Account">
              <Input value={company.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} />
            </Field>
            <Field label="IFSC">
              <Input value={company.bankIfsc} onChange={(e) => set("bankIfsc", e.target.value.toUpperCase())} />
            </Field>
            <Field label="Invoice prefix">
              <Input value={company.invoicePrefix} onChange={(e) => set("invoicePrefix", e.target.value)} />
            </Field>
            <Field label="Next number">
              <Input
                type="number"
                min={1}
                value={company.nextNumber}
                onChange={(e) => set("nextNumber", Number(e.target.value))}
              />
            </Field>
            <Field label="Purchase prefix">
              <Input value={company.purchasePrefix} onChange={(e) => set("purchasePrefix", e.target.value)} />
            </Field>
            <Field label="Next purchase no.">
              <Input
                type="number"
                min={1}
                value={company.nextPurchaseNumber}
                onChange={(e) => set("nextPurchaseNumber", Number(e.target.value))}
              />
            </Field>
            <Field label="Return bill prefix">
              <Input value={company.returnPrefix} onChange={(e) => set("returnPrefix", e.target.value)} />
            </Field>
            <Field label="Next return no.">
              <Input
                type="number"
                min={1}
                value={company.nextReturnNumber}
                onChange={(e) => set("nextReturnNumber", Number(e.target.value))}
              />
            </Field>
            <Field label="Credit note prefix">
              <Input value={company.creditNotePrefix} onChange={(e) => set("creditNotePrefix", e.target.value)} />
            </Field>
            <Field label="Next credit note no.">
              <Input
                type="number"
                min={1}
                value={company.nextCreditNoteNumber}
                onChange={(e) => set("nextCreditNoteNumber", Number(e.target.value))}
              />
            </Field>
            <Field label="Default salesman">
              <Input value={company.salesman} onChange={(e) => set("salesman", e.target.value)} />
            </Field>
            <Field label="Signatory">
              <Input value={company.signatory} onChange={(e) => set("signatory", e.target.value)} />
            </Field>
            <Field label="Terms" className="sm:col-span-2">
              <Textarea value={company.terms} onChange={(e) => set("terms", e.target.value)} rows={3} />
            </Field>
          </CardContent>
        </Card>

        {isDesktopApp ? <AppLockCard /> : null}

        <Card>
          <CardHeader>
            <CardTitle>Backup</CardTitle>
            <CardDescription>
              Neon stores one copy of the books and replaces it after each change. Restore brings that copy back onto this browser.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
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
            {isDesktopApp ? null : (
              <Button
                variant="outline"
                disabled={restoring}
                onClick={() => {
                  if (!window.confirm("Replace the books on this browser with the copy saved in Neon? Anything not saved there will be lost.")) return;
                  setRestoring(true);
                  void booksLoad()
                    .then((remote) => {
                      if (!remote.ok) {
                        toast.error(remote.error);
                        return;
                      }
                      if (!remote.books) {
                        toast.error("Neon has no backup yet");
                        return;
                      }
                      const books = parseBooksBackup(remote.books);
                      const event = new CustomEvent("hysiac-restore-books", {
                        cancelable: true,
                        detail: { books, updatedAt: remote.updatedAt },
                      });
                      window.dispatchEvent(event);
                      if (!event.defaultPrevented) useBillingStore.getState().replaceAll(books);
                      toast.success("Restored from Neon");
                    })
                    .catch(() => toast.error("Could not reach Neon"))
                    .finally(() => setRestoring(false));
                }}
              >
                {restoring ? "Restoring…" : "Restore from Neon"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
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
