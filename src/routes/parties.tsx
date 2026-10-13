import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Search } from "lucide-react";
import { DeleteVoucherButton } from "@/components/delete-voucher";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PartyFormDialog } from "@/components/party-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { stateName } from "@/lib/gst";
import { channelLabel, priceListForChannel, priceListLabel } from "@/lib/pricing";
import { useBillingStore } from "@/lib/store";

export const Route = createFileRoute("/parties")({ component: PartiesPage });

function PartiesPage() {
  const parties = useBillingStore((s) => s.parties);
  const remove = useBillingStore((s) => s.deleteParty);
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return parties.filter((p) => {
      if (!query) return true;
      return `${p.name} ${p.gstin} ${p.city} ${p.channel}`.toLowerCase().includes(query);
    });
  }, [parties, q]);

  return (
    <AppShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Parties</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stockists bill at PTS. Retailers, hospitals and walk-in bill at PTR.
          </p>
        </div>
        <PartyFormDialog
          trigger={
            <Button>
              <Plus className="size-4" />
              Add party
            </Button>
          }
        />
      </div>

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search name, GSTIN, city" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((p) => (
          <div key={p.id} className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {p.city}, {stateName(p.stateCode)}
                </p>
              </div>
              <Badge variant={p.kind === "unregistered" ? "outline" : "default"}>
                {p.kind === "registered" ? "B2B" : p.kind === "composition" ? "Composition" : "B2C"}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="secondary">
                {channelLabel(p.channel)} · {priceListLabel(priceListForChannel(p.channel))}
              </Badge>
              {p.isCustomer ? <Badge variant="outline">Customer</Badge> : null}
              {p.isSupplier ? <Badge variant="outline">Supplier</Badge> : null}
            </div>
            <p className="mt-3 font-mono text-xs">{p.gstin || "No GSTIN"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{p.addressLine1}</p>
            <div className="mt-3 flex justify-end gap-1">
              <PartyFormDialog
                party={p}
                trigger={
                  <Button variant="ghost" size="icon" className="size-10" aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                }
              />
              <DeleteVoucherButton
                compact
                title="Delete party"
                description="Moves this customer or supplier to the recycle bin. Old bills that already use the name stay as they are."
                onConfirm={() => remove(p.id)}
              />
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
