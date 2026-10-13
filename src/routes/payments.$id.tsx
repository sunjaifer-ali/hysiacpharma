import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ReceiptSheet } from "@/components/receipt-sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { invoiceTotals, round2 } from "@/lib/gst";
import { printPage } from "@/lib/print-page";
import { creditedAgainst } from "@/lib/returns";
import { useBillingStore } from "@/lib/store";

export const Route = createFileRoute("/payments/$id")({ component: PaymentSlipPage });

function PaymentSlipPage() {
  const { id } = Route.useParams();
  const payment = useBillingStore((s) => s.payments.find((p) => p.id === id));
  const company = useBillingStore((s) => s.company);
  const invoice = useBillingStore((s) => s.invoices.find((i) => i.id === payment?.voucherId));
  const purchase = useBillingStore((s) => s.purchases.find((p) => p.id === payment?.voucherId));
  const notes = useBillingStore((s) => s.creditNotes);
  const receipt = payment?.kind === "receipt";
  const [copy, setCopy] = useState("Customer copy");
  const copies = receipt ? ["Customer copy", "Office copy"] : ["Supplier copy", "Office copy"];
  const shown = copies.includes(copy) ? copy : copies[0]!;

  if (!payment) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Receipt not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/payments">Back to payments</Link>
        </Button>
      </AppShell>
    );
  }

  const billAmount = receipt ? (invoice ? invoiceTotals(invoice).grand : payment.amount) : purchase ? invoiceTotals(purchase).grand : payment.amount;
  const credits = receipt && invoice ? creditedAgainst(notes, invoice.id) : 0;
  const totalSettled = receipt ? invoice?.paidAmount ?? payment.amount : purchase?.paidAmount ?? payment.amount;
  const balance = round2(Math.max(0, billAmount - credits - totalSettled));
  const party = receipt ? invoice?.party : purchase?.supplier;

  return (
    <AppShell>
      <div className="no-print mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/payments" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Payments
          </Link>
          <h1 className="font-display text-3xl">{payment.number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {receipt ? "Give the customer copy. Keep the office copy with the bill." : "Give the supplier copy. Keep the office copy with the purchase bill."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={shown} onValueChange={setCopy}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {copies.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => printPage("portrait")}>
            <Printer className="size-4" />
            Print {shown.toLowerCase()}
          </Button>
        </div>
      </div>
      <ReceiptSheet
        payment={payment}
        copy={shown}
        company={company}
        party={party}
        billDate={receipt ? invoice?.date : purchase?.billDate || purchase?.date}
        billAmount={billAmount}
        totalSettled={totalSettled}
        balance={balance}
      />
    </AppShell>
  );
}
