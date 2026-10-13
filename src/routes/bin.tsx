import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { DeleteVoucherButton } from "@/components/delete-voucher";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useBillingStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/bin")({ component: BinPage });

const KIND: Record<string, string> = {
  invoice: "Invoice",
  purchase: "Purchase",
  order: "Purchase order",
  quote: "Quotation",
  product: "Product",
  party: "Party",
  payment: "Payment",
  adjustment: "Stock out",
  opening: "Opening due",
};

function BinPage() {
  const bin = useBillingStore((s) => s.bin);
  const restoreBin = useBillingStore((s) => s.restoreBin);
  const purgeBin = useBillingStore((s) => s.purgeBin);
  const emptyBin = useBillingStore((s) => s.emptyBin);

  return (
    <AppShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl">Recycle bin</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Deleted bills stay here until you restore them or delete them forever.
            </p>
          </div>
          {bin.length > 0 ? (
            <DeleteVoucherButton
              title="Empty the recycle bin"
              description="This deletes everything in the bin forever. It cannot be restored."
              confirmLabel="Delete forever"
              onConfirm={() => {
                emptyBin();
                toast.success("Recycle bin emptied");
              }}
            />
          ) : null}
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
          {bin.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">The recycle bin is empty.</p>
          ) : (
            <ul>
              {bin.map((item) => (
                <li key={item.id} className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {KIND[item.kind] ?? item.kind}
                      {item.subtitle ? ` · ${item.subtitle}` : ""} · {formatDate(item.deletedAt.slice(0, 10))}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        restoreBin(item.id);
                        toast.success("Restored");
                      }}
                    >
                      Restore
                    </Button>
                    <DeleteVoucherButton
                      title="Delete forever"
                      description="This cannot be restored."
                      confirmLabel="Delete forever"
                      onConfirm={() => purgeBin(item.id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
    </AppShell>
  );
}
