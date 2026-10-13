import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CreditNoteEditor } from "@/components/credit-note-editor";
import { Button } from "@/components/ui/button";
import { useBillingStore } from "@/lib/store";

export const Route = createFileRoute("/returns/$id/edit")({ component: EditReturnPage });

function EditReturnPage() {
  const { id } = Route.useParams();
  const note = useBillingStore((s) => s.creditNotes.find((n) => n.id === id));

  if (!note) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Return bill not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/returns">Back</Link>
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="font-display text-3xl">Edit {note.number}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Issuing assigns the next return bill number if this is still a draft.</p>
      </div>
      <CreditNoteEditor existing={note} />
    </AppShell>
  );
}
