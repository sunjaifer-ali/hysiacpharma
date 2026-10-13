import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DeleteVoucherButton } from "@/components/delete-voucher";
import { QuoteSheet } from "@/components/quote-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { printPage } from "@/lib/print-page";
import { useBillingStore } from "@/lib/store";
import type { QuoteStatus } from "@/lib/types";

export const Route = createFileRoute("/quotes/$id")({ component: QuotePage });

const LABEL: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  ordered: "Ordered",
};

function QuotePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const quote = useBillingStore((s) => s.quotes.find((item) => item.id === id));
  const deleteQuote = useBillingStore((s) => s.deleteQuote);

  if (!quote) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Quotation not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/quotes">Back to quotations</Link>
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="no-print mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/quotes" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Quotations
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl">{quote.number}</h1>
            <Badge variant={quote.status === "ordered" ? "paid" : quote.status === "sent" ? "issued" : "draft"}>{LABEL[quote.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{quote.party.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => printPage("portrait")}>
            <Printer className="size-4" />
            Print A4
          </Button>
          {quote.status !== "ordered" ? (
            <Button asChild variant="outline">
              <Link to="/quotes/$id/edit" params={{ id: quote.id }}>
                Edit
              </Link>
            </Button>
          ) : null}
          {quote.invoiceId ? (
            <Button asChild>
              <Link to="/invoices/$id" params={{ id: quote.invoiceId }}>
                Open invoice
              </Link>
            </Button>
          ) : quote.status === "sent" ? (
            <Button asChild>
              <Link to="/invoices/new" search={{ quote: quote.id }}>
                Create invoice
              </Link>
            </Button>
          ) : null}
          {quote.status !== "ordered" ? (
            <DeleteVoucherButton
              title="Delete quotation"
              description="Moves this quotation to the recycle bin. Stock and invoices are not changed."
              onConfirm={() => {
                deleteQuote(quote.id);
                void navigate({ to: "/quotes" });
              }}
            />
          ) : null}
        </div>
      </div>
      <QuoteSheet quote={quote} />
    </AppShell>
  );
}
