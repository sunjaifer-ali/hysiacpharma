import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { InvoiceEditor } from "@/components/invoice-editor";
import { Button } from "@/components/ui/button";
import { useBillingStore } from "@/lib/store";

export const Route = createFileRoute("/invoices/$id/edit")({ component: EditInvoicePage });

function EditInvoicePage() {
  const { id } = Route.useParams();
  const invoice = useBillingStore((s) => s.invoices.find((i) => i.id === id));

  if (!invoice) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Invoice not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/invoices">Back</Link>
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell wide>
      <div className="mb-5">
        <h1 className="font-display text-3xl">Edit {invoice.number}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Changes apply to this invoice only. Issuing assigns the next number if it is still a draft.</p>
      </div>
      <InvoiceEditor existing={invoice} />
    </AppShell>
  );
}
