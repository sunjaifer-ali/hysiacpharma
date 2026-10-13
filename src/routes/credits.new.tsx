import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CreditValueEditor } from "@/components/credit-value-editor";

type NewSearch = { invoice?: string };

export const Route = createFileRoute("/credits/new")({
  validateSearch: (search: Record<string, unknown>): NewSearch => ({
    invoice: typeof search.invoice === "string" ? search.invoice : undefined,
  }),
  component: NewCreditPage,
});

function NewCreditPage() {
  const { invoice } = Route.useSearch();
  return (
    <AppShell wide>
      <div className="mb-5">
        <h1 className="font-display text-3xl">New credit note</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Value credit to a customer — GST credit note. Stock is not changed. Use Return bill to take goods back.
        </p>
      </div>
      <CreditValueEditor presetInvoiceId={invoice} />
    </AppShell>
  );
}
