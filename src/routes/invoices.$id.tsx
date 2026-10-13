import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Copy, Printer, Undo2 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DeleteVoucherButton } from "@/components/delete-voucher";
import { InvoicePreview } from "@/components/invoice-preview";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { SettleDialog } from "@/components/settle-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR } from "@/lib/format";
import { printPage } from "@/lib/print-page";
import { invoiceTotals } from "@/lib/gst";
import { creditedAgainst, invoiceNetDue } from "@/lib/returns";
import { useBillingStore } from "@/lib/store";
import type { BillCopy } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/invoices/$id")({ component: InvoiceDetailPage });

function InvoiceDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const invoice = useBillingStore((s) => s.invoices.find((i) => i.id === id));
  const notes = useBillingStore((s) => s.creditNotes);
  const setStatus = useBillingStore((s) => s.setInvoiceStatus);
  const recordPayment = useBillingStore((s) => s.recordPayment);
  const deleteInvoice = useBillingStore((s) => s.deleteInvoice);
  const [payOpen, setPayOpen] = useState(false);
  const [copy, setCopy] = useState<BillCopy>("Original");

  if (!invoice) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Invoice not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/invoices">Back to invoices</Link>
        </Button>
      </AppShell>
    );
  }

  const credited = creditedAgainst(notes, invoice.id);
  const due = invoiceNetDue(invoice, notes);
  const linked = notes.filter((n) => n.invoiceId === invoice.id);

  return (
    <AppShell wide>
      <div className="no-print mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/invoices" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Invoices
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl">{invoice.number}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {invoice.party.name}
            {credited > 0 ? ` · Credited ${formatINR(credited)}` : ""}
            {due > 0 && invoice.status !== "cancelled" && invoice.status !== "draft" ? ` · Due ${formatINR(due)}` : ""}
            {invoice.paidAmount > 0 ? ` · Received ${formatINR(invoice.paidAmount)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={copy} onValueChange={(v) => setCopy(v as BillCopy)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Original">Original</SelectItem>
              <SelectItem value="Duplicate">Duplicate</SelectItem>
              <SelectItem value="Triplicate">Triplicate</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => printPage("landscape")}>
            <Printer className="size-4" />
            Print
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void navigate({ to: "/invoices/new", search: { duplicate: invoice.id } });
            }}
          >
            <Copy className="size-4" />
            Duplicate
          </Button>
          {invoice.status !== "draft" && invoice.status !== "cancelled" ? (
            <>
              <Button asChild>
                <Link to="/returns/new" search={{ invoice: invoice.id }}>
                  <Undo2 className="size-4" />
                  Return bill
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/credits/new" search={{ invoice: invoice.id }}>
                  Credit note
                </Link>
              </Button>
            </>
          ) : null}
          {invoice.status === "draft" ? (
            <Button asChild variant="secondary">
              <Link to="/invoices/$id/edit" params={{ id: invoice.id }}>
                Edit draft
              </Link>
            </Button>
          ) : null}
          {due > 0 && invoice.status !== "draft" && invoice.status !== "cancelled" ? (
            <Button variant="secondary" onClick={() => setPayOpen(true)}>
              Receive
            </Button>
          ) : null}
          {invoice.status === "issued" || invoice.status === "partial" || invoice.status === "paid" ? (
            <Button
              variant="outline"
              onClick={() => {
                setStatus(invoice.id, "cancelled");
                toast.success("Invoice cancelled");
              }}
            >
              Cancel
            </Button>
          ) : null}
          <DeleteVoucherButton
            title={`Delete ${invoice.number}?`}
            description="Moves this tax invoice to the recycle bin, with any return or receipt on it. Stock comes back until you restore it."
            onConfirm={() => {
              deleteInvoice(invoice.id);
              toast.success("Moved to the recycle bin");
              void navigate({ to: "/invoices" });
            }}
          />
        </div>
      </div>
      <InvoicePreview invoice={invoice} copy={copy} />
      {linked.length > 0 ? (
        <div className="no-print mt-6 rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-lg">Returns & credit notes</h2>
          <ul className="mt-3 space-y-2">
            {linked.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 text-sm">
                <Link to="/returns/$id" params={{ id: n.id }} className="text-primary hover:underline">
                  {n.number}
                </Link>
                <span className="text-muted-foreground">{n.status}</span>
                <span className="tabular-nums">{formatINR(invoiceTotals(n).grand)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <SettleDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        title="Receive from customer"
        due={due}
        onSave={(input) => {
          const saved = recordPayment(invoice.id, input.amount, input);
          if (!saved) {
            toast.error("Nothing was received. Check the amount still due.");
            return;
          }
          toast.success("Receipt saved");
          void navigate({ to: "/payments/$id", params: { id: saved.id } });
        }}
      />
    </AppShell>
  );
}
