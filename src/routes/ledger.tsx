import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PartyLedgerPanel } from "@/components/party-ledger-panel";

export const Route = createFileRoute("/ledger")({
  validateSearch: (search: Record<string, unknown>) => ({
    party: typeof search.party === "string" ? search.party : "",
    side: search.side === "supplier" ? ("supplier" as const) : ("customer" as const),
  }),
  component: LedgerPage,
});

function LedgerPage() {
  const search = Route.useSearch();
  return (
    <AppShell>
      <h1 className="font-display text-3xl">Ledger</h1>
      <div className="mt-4">
        <PartyLedgerPanel initialSide={search.side} initialParty={search.party} />
      </div>
    </AppShell>
  );
}
