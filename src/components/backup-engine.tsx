import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { CloudOff } from "lucide-react";
import { useRefetchWhenConnectorReady } from "@/lib/app-data";
import { backupIsDue, runBooksBackup } from "@/lib/backup-run";
import { loadBackupFolder } from "@/lib/backup-folder";
import { useBackupPrefs, useBackupPrefsHydrated } from "@/lib/backup-prefs";
import { isAndroidApp } from "@/lib/android-backup";
import { isDesktopApp } from "@/lib/desktop";
import { useBillingStore, useHasHydrated } from "@/lib/store";
import { Button } from "@/components/ui/button";

const DEBOUNCE_MS = 2_000;
const TICK_MS = 5 * 60 * 1000;

export function BackupEngine() {
  const hydrated = useHasHydrated();
  const prefsHydrated = useBackupPrefsHydrated();
  const autoEnabled = useBackupPrefs((s) => s.autoEnabled);
  const pending = useBackupPrefs((s) => s.pending);
  const dismissedPendingAt = useBackupPrefs((s) => s.dismissedPendingAt);
  const setPrefs = useBackupPrefs((s) => s.setPrefs);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);

  const kick = (mode: "auto" | "manual" = "auto") => {
    if (isDesktopApp && !isAndroidApp()) return;
    if (running.current) return;
    if (mode === "auto" && !backupIsDue()) return;
    running.current = true;
    void runBooksBackup(mode).finally(() => {
      running.current = false;
    });
  };

  useRefetchWhenConnectorReady(Boolean(!isDesktopApp && autoEnabled && pending), () => runBooksBackup("retry"));

  useEffect(() => {
    if (isDesktopApp && !isAndroidApp()) return;
    if (!hydrated) return;
    void loadBackupFolder().then((handle) => {
      setPrefs({ folderLinked: Boolean(handle), folderName: handle?.name ?? null });
    });
  }, [hydrated, setPrefs]);

  useEffect(() => {
    if ((isDesktopApp && !isAndroidApp()) || !hydrated || !prefsHydrated || !autoEnabled) return;

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => kick("auto"), DEBOUNCE_MS);
    };

    const unsub = useBillingStore.subscribe((next, prev) => {
      if (
        next.invoices === prev.invoices &&
        next.purchases === prev.purchases &&
        next.creditNotes === prev.creditNotes &&
        next.purchaseOrders === prev.purchaseOrders &&
        next.quotes === prev.quotes &&
        next.products === prev.products &&
        next.parties === prev.parties &&
        next.company === prev.company &&
        next.payments === prev.payments &&
        next.adjustments === prev.adjustments &&
        next.openingDues === prev.openingDues &&
        next.bin === prev.bin
      ) {
        return;
      }
      schedule();
    });

    kick("auto");
    const tick = setInterval(() => kick("auto"), TICK_MS);

    return () => {
      unsub();
      clearInterval(tick);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [hydrated, prefsHydrated, autoEnabled]);

  if (isDesktopApp && !isAndroidApp()) return null;

  const showBanner = Boolean(prefsHydrated && autoEnabled && pending && !dismissedPendingAt);
  if (!showBanner) return null;

  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-16 z-30 px-3 lg:bottom-4 lg:left-60">
      <div className="pointer-events-auto mx-auto flex max-w-6xl flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-lg">
        <CloudOff className="size-4 shrink-0 text-warning" />
        <p className="min-w-0 flex-1 text-sm text-foreground">
          {isAndroidApp()
            ? "Books are not copied to Google Drive yet. Link the Drive folder in Settings."
            : "Books are not yet copied to Google Drive."}
        </p>
        <Button size="sm" onClick={() => kick("manual")}>
          Backup now
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/settings">Settings</Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setPrefs({ dismissedPendingAt: new Date().toISOString() })}
        >
          Later
        </Button>
      </div>
    </div>
  );
}
