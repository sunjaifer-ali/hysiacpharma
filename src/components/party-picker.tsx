import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { PartyFormDialog } from "@/components/party-form-dialog";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { channelLabel } from "@/lib/pricing";
import { useBillingStore } from "@/lib/store";
import type { Party, TradeChannel } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PartyPicker({
  value,
  onChange,
  role = "customer",
  channel,
}: {
  value: string;
  onChange: (id: string, party: Party) => void;
  role?: "customer" | "supplier";
  channel?: TradeChannel;
}) {
  const parties = useBillingStore((s) => s.parties).filter((p) =>
    role === "supplier" ? p.isSupplier : p.isCustomer,
  );
  const [open, setOpen] = useState(false);
  const selected = parties.find((p) => p.id === value) ?? useBillingStore.getState().parties.find((p) => p.id === value);

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="h-11 flex-1 justify-between font-normal">
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected ? selected.name : role === "supplier" ? "Search supplier" : "Search customer"}
            </span>
            <ChevronsUpDown className="size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder="Name or GSTIN" />
            <CommandList>
              <CommandEmpty>No party found.</CommandEmpty>
              <CommandGroup>
                {parties.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.name} ${p.gstin} ${p.city} ${p.channel}`}
                    onSelect={() => {
                      onChange(p.id, p);
                      setOpen(false);
                    }}
                  >
                    <div className="min-w-0">
                      <p className="truncate">{p.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {channelLabel(p.channel)}
                        {p.city ? ` · ${p.city}` : ""}
                        {p.gstin ? ` · ${p.gstin}` : " · Unregistered"}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <PartyFormDialog
        intent={role}
        channel={channel}
        onSaved={(p) => onChange(p.id, p)}
        trigger={
          <Button type="button" variant="secondary" className="shrink-0">
            Add
          </Button>
        }
      />
    </div>
  );
}
