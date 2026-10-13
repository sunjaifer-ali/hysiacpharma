import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { QuoteEditor } from "@/components/quote-editor";
import { Button } from "@/components/ui/button";
import { useBillingStore } from "@/lib/store";

export const Route = createFileRoute("/quotes/$id/edit")({ component: EditQuotePage });

function EditQuotePage() {
  const { id } = Route.useParams();
  const quote = useBillingStore((s) => s.quotes.find((item) => item.id === id));
  if (!quote || quote.status === "ordered") {
    return (
      <AppShell>
        <p className="text-muted-foreground">{quote ? "This quotation already became an order." : "Quotation not found."}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/quotes">Back</Link>
        </Button>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <div className="mb-5">
        <Link to="/quotes/$id" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground">
          {quote.number}
        </Link>
        <h1 className="font-display text-3xl">Revise quotation</h1>
      </div>
      <QuoteEditor existing={quote} />
    </AppShell>
  );
}
