import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDIAN_STATES, isValidGstin, stateFromGstin } from "@/lib/gst";
import { useBillingStore } from "@/lib/store";
import type { Party, PartyKind, TradeChannel } from "@/lib/types";
import { toast } from "sonner";

const empty = (intent: "customer" | "supplier" = "customer", channel?: TradeChannel): Party => ({
  id: crypto.randomUUID(),
  name: "",
  kind: "registered",
  channel: channel ?? (intent === "supplier" ? "stockist" : "retailer"),
  isCustomer: intent !== "supplier",
  isSupplier: intent === "supplier",
  gstin: "",
  drugLicense: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  stateCode: "32",
  pincode: "",
  phone: "",
  email: "",
});


export function PartyFormDialog({
  party,
  trigger,
  onSaved,
  intent = "customer",
  channel,
}: {
  party?: Party;
  trigger: ReactNode;
  onSaved?: (p: Party) => void;
  intent?: "customer" | "supplier";
  channel?: TradeChannel;
}) {
  const upsert = useBillingStore((s) => s.upsertParty);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Party>(party ?? empty(intent, channel));

  function set<K extends keyof Party>(key: K, value: Party[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    if (!form.name.trim()) {
      toast.error("Party name is required.");
      return;
    }
    if (form.kind === "registered" && !isValidGstin(form.gstin)) {
      toast.error("Enter a valid 15-character GSTIN.");
      return;
    }
    upsert(form);
    onSaved?.(form);
    toast.success(party ? "Party updated" : "Party added");
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setForm(party ?? empty(intent));
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{party ? "Edit party" : "New party"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>GST type</Label>
              <Select value={form.kind} onValueChange={(v) => set("kind", v as PartyKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="registered">Registered (B2B)</SelectItem>
                  <SelectItem value="unregistered">Unregistered (B2C)</SelectItem>
                  <SelectItem value="composition">Composition</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Trade channel</Label>
              <Select value={form.channel} onValueChange={(v) => set("channel", v as TradeChannel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stockist">Stockist — billed at PTS</SelectItem>
                  <SelectItem value="retailer">Retailer — billed at PTR</SelectItem>
                  <SelectItem value="hospital">Hospital — billed at PTR</SelectItem>
                  <SelectItem value="walkin">Walk-in — billed at PTR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.isCustomer} onCheckedChange={(v) => set("isCustomer", Boolean(v))} />
              Customer
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.isSupplier} onCheckedChange={(v) => set("isSupplier", Boolean(v))} />
              Supplier
            </label>
          </div>
          <div className="space-y-1.5">
            <Label>GSTIN</Label>
            <Input
              value={form.gstin}
              className="uppercase"
              maxLength={15}
              onChange={(e) => {
                const gstin = e.target.value.toUpperCase();
                const code = stateFromGstin(gstin);
                setForm((f) => ({
                  ...f,
                  gstin,
                  stateCode: code.length === 2 ? code : f.stateCode,
                }));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Drug licence</Label>
            <Input value={form.drugLicense} onChange={(e) => set("drugLicense", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>PIN</Label>
              <Input value={form.pincode} onChange={(e) => set("pincode", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>State</Label>
            <Select value={form.stateCode} onValueChange={(v) => set("stateCode", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>Save party</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
