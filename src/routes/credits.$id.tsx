import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CreditNotePreview } from "@/components/credit-note-preview";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";
import { printPage } from "@/lib/print-page";
import { invoiceTotals } from "@/lib/gst";
import { reasonLabel } from "@/lib/returns";
import { useBillingStore } from "@/lib/store";
import type { BillCopy } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/credits/$id")({ component: CreditDetailPage });

function CreditDetailPage() {
  const { id } = Route.useParams();
  const note = useBillingStore((s) => s.creditNotes.find((n) => n.id === id));
  const setStatus = useBillingStore((s) => s.setCreditNoteStatus);
  const saveCreditNote = useBillingStore((s) => s.saveCreditNote);
  const [copy, setCopy] = useState<BillCopy>("Original");

  if (!note) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Credit note not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/credits">Back to credit notes</Link>
        </Button>
      </AppShell>
    );
  }

  if (note.kind === "sales_return") {
    return <Navigate to="/returns/$id" params={{ id: note.id }} />;
  }

  const totals = invoiceTotals(note);

  return (
    <AppShell>
      <div className="no-print mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/credits" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Credit notes
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl">{note.number}</h1>
            <StatusBadge status={note.status} as="note" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {reasonLabel(note.reason)}
            {note.invoiceNumber ? (
              <>
                {" · against "}
                <Link to="/invoices/$id" params={{ id: note.invoiceId }} className="text-primary hover:underline">
                  {note.invoiceNumber}
                </Link>
              </>
            ) : (
              " · standalone"
            )}
            {" · "}
            {note.party.name} · {formatINR(totals.grand)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            value={copy}
            onChange={(e) => setCopy(e.target.value as BillCopy)}
          >
            <option>Original</option>
            <option>Duplicate</option>
            <option>Triplicate</option>
          </select>
          <Button variant="outline" onClick={() => printPage("portrait")}>
            <Printer className="size-4" />
            Print
          </Button>
          {note.status === "draft" ? (
            <>
              <Button asChild variant="secondary">
                <Link to="/credits/$id/edit" params={{ id: note.id }}>
                  Edit draft
                </Link>
              </Button>
              <Button
                onClick={() => {
                  try {
                    const saved = saveCreditNote(note, "issued");
                    toast.success(`Issued ${saved.number}`);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not issue");
                  }
                }}
              >
                Issue
              </Button>
            </>
          ) : null}
          {note.status === "issued" ? (
            <Button
              variant="outline"
              onClick={() => {
                setStatus(note.id, "cancelled");
                toast.success("Credit note cancelled");
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
      <CreditNotePreview note={note} copy={copy} />
    </AppShell>
  );
}
