import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PurchaseEditor } from "@/components/purchase-editor";
import { Button } from "@/components/ui/button";
import { useBillingStore, useHasHydrated } from "@/lib/store";

export const Route = createFileRoute("/purchases/$id/edit")({ component: EditPurchasePage });

function EditPurchasePage() {
  const { id } = Route.useParams();
  const hydrated = useHasHydrated();
  const purchase = useBillingStore((s) => s.purchases.find((i) => i.id === id));

  if (!hydrated) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Opening the purchase…</p>
      </AppShell>
    );
  }

  if (!purchase) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Purchase not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/purchases">Back</Link>
        </Button>
      </AppShell>
    );
  }

  if (purchase.status === "cancelled") {
    return (
      <AppShell>
        <p className="text-muted-foreground">This purchase is cancelled and cannot be edited.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/purchases/$id" params={{ id: purchase.id }}>
            Back
          </Link>
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="font-display text-3xl">Edit {purchase.number}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Change the supplier bill, then tap Save changes.</p>
      </div>
      <PurchaseEditor key={purchase.id} existing={purchase} />
    </AppShell>
  );
}