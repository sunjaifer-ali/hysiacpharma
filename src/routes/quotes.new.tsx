import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { QuoteEditor } from "@/components/quote-editor";

export const Route = createFileRoute("/quotes/new")({ component: NewQuotePage });

function NewQuotePage() {
  return (
    <AppShell>
      <div className="mb-5">
        <Link to="/quotes" className="text-sm text-muted-foreground hover:text-foreground">
          Quotations
        </Link>
        <h1 className="font-display text-3xl">New quotation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Offer PTR, PTS, or a special rate. Print it for the hospital. Create the tax invoice only after they send the order.
        </p>
      </div>
      <QuoteEditor />
    </AppShell>
  );
}
