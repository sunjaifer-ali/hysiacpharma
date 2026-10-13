import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CreditNoteEditor } from "@/components/credit-note-editor";

type NewSearch = { invoice?: string };

export const Route = createFileRoute("/returns/new")({
  validateSearch: (search: Record<string, unknown>): NewSearch => ({
    invoice: typeof search.invoice === "string" ? search.invoice : undefined,
  }),
  component: NewReturnPage,
});

function NewReturnPage() {
  const { invoice } = Route.useSearch();
  return (
    <AppShell wide>
      <div className="mb-5">
        <h1 className="font-display text-3xl">New return bill</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Return only up to billed quantity. Goods go back to stock except expired or damaged returns. For a value
          credit without goods, issue a Credit note.
        </p>
      </div>
      <CreditNoteEditor presetInvoiceId={invoice} />
    </AppShell>
  );
}
