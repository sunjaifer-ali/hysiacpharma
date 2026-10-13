import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateDMY } from "@/lib/format";
import { currentMonthRange, currentQuarterRange, financialYearRange, lastMonthRange } from "@/lib/gst";
import { inRange } from "@/lib/registers";

type Preset = "last" | "month" | "quarter" | "year" | "custom";

const PRESETS: { key: Exclude<Preset, "custom">; label: string }[] = [
  { key: "last", label: "Last month" },
  { key: "month", label: "This month" },
  { key: "quarter", label: "This quarter" },
  { key: "year", label: "This year" },
];

function rangeFor(key: Exclude<Preset, "custom">) {
  if (key === "last") return lastMonthRange();
  if (key === "month") return currentMonthRange();
  if (key === "quarter") return currentQuarterRange();
  return financialYearRange();
}

export function useVoucherPeriod() {
  const start = currentMonthRange();
  const [from, setFrom] = useState(start.from);
  const [to, setTo] = useState(start.to);
  const [preset, setPreset] = useState<Preset>("month");

  function apply(key: Exclude<Preset, "custom">) {
    const next = rangeFor(key);
    setFrom(next.from);
    setTo(next.to);
    setPreset(key);
  }

  return {
    from,
    to,
    preset,
    apply,
    setFrom: (value: string) => {
      setFrom(value);
      setPreset("custom");
    },
    setTo: (value: string) => {
      setTo(value);
      setPreset("custom");
    },
    includes: (iso: string) => inRange(iso, { from, to }),
    label: `${formatDateDMY(from)} – ${formatDateDMY(to)}`,
  };
}

export function PeriodFilter({
  from,
  to,
  preset,
  onFrom,
  onTo,
  onPreset,
}: {
  from: string;
  to: string;
  preset: Preset;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onPreset: (key: Exclude<Preset, "custom">) => void;
}) {
  return (
    <div className="mt-5 grid gap-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((item) => (
          <Button
            key={item.key}
            type="button"
            size="sm"
            variant={preset === item.key ? "default" : "outline"}
            onClick={() => onPreset(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <div className="space-y-1.5">
          <Label htmlFor="period-from">From</Label>
          <Input id="period-from" type="date" value={from} onChange={(e) => onFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="period-to">To</Label>
          <Input id="period-to" type="date" value={to} onChange={(e) => onTo(e.target.value)} />
        </div>
      </div>
    </div>
  );
}
