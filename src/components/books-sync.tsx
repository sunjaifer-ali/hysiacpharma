import { useEffect } from "react";
import { booksFingerprint, type BooksSnapshot } from "@/lib/backup";
import { isDesktopApp } from "@/lib/desktop";
import { booksLoad, booksSave } from "@/lib/staff-accounts";
import { useBillingStore, useHasHydrated } from "@/lib/store";

function snapshot(): BooksSnapshot {
  const s = useBillingStore.getState();
  return {
    company: s.company,
    products: s.products,
    parties: s.parties,
    invoices: s.invoices,
    purchases: s.purchases,
    purchaseOrders: s.purchaseOrders,
    quotes: s.quotes,
    creditNotes: s.creditNotes,
    payments: s.payments,
    adjustments: s.adjustments,
    openingDues: s.openingDues,
    bin: s.bin,
  };
}

function hasWork(books: BooksSnapshot): boolean {
  return (
    books.invoices.length + books.products.length + books.parties.length +
    books.purchases.length + books.purchaseOrders.length + books.quotes.length +
    books.creditNotes.length + books.payments.length + books.adjustments.length +
    books.openingDues.length + books.bin.length > 0
  );
}

/** Persist the latest books snapshot to Neon without allowing stale saves to win. */
export function BooksSync() {
  const hydrated = useHasHydrated();

  useEffect(() => {
    if (!hydrated || isDesktopApp) return;
    let stop = false;
    let dirty = false;
    let applying = false;
    let initialized = false;
    let lastFp = "";
    let lastUpdated: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let saveChain: Promise<void> = Promise.resolve();
    let changeVersion = 0;
    let retryCount = 0;

    const report = (message: string, error?: unknown) => {
      // Intentionally visible in browser devtools; never silently discard failed persistence.
      console.error(`[Hysiac books sync] ${message}`, error ?? "");
    };

    const apply = (books: BooksSnapshot, updatedAt: string | null) => {
      applying = true;
      try {
        useBillingStore.getState().replaceAll(books);
        lastFp = booksFingerprint(snapshot());
        lastUpdated = updatedAt;
        dirty = false;
      } finally {
        applying = false;
      }
    };

    let queueSave: (delay?: number) => void;

    const saveLatest = () => {
      saveChain = saveChain.then(async () => {
        if (stop || applying || !dirty) return;
        const versionAtStart = changeVersion;
        const books = snapshot();
        const fp = booksFingerprint(books);
        if (fp === lastFp) {
          if (versionAtStart === changeVersion) dirty = false;
          return;
        }
        try {
          const result = await booksSave({ data: { json: JSON.stringify(books) } });
          if (stop) return;
          if (!result.ok) {
            report(`Save rejected by server: ${result.error}`);
            // Keep dirty=true and retry with bounded backoff; never claim the save succeeded.
            dirty = true;
            retryCount += 1;
            queueSave(Math.min(1000 * 2 ** Math.min(retryCount, 5), 30000));
            return;
          }
          retryCount = 0;
          lastFp = fp;
          lastUpdated = result.updatedAt;
          // A change made while this request was in flight must remain dirty and be saved next.
          dirty = versionAtStart !== changeVersion || booksFingerprint(snapshot()) !== fp;
          if (dirty) queueSave(0);
        } catch (error) {
          report("Save request failed", error);
          dirty = true;
          retryCount += 1;
          queueSave(Math.min(1000 * 2 ** Math.min(retryCount, 5), 30000));
        }
      }).catch((error) => report("Unexpected save queue error", error));
    };

    queueSave = (delay = 800) => {
      if (stop) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => saveLatest(), delay);
    };

    const pull = async () => {
      if (stop || !initialized || dirty || applying) return;
      try {
        const remote = await booksLoad();
        if (stop || !remote.ok || !remote.books) {
          if (!stop && !remote.ok) report(`Load rejected by server: ${remote.error}`);
          return;
        }
        // Never replace local state if any local change occurred during the request.
        if (dirty) return;
        if (remote.updatedAt !== lastUpdated) apply(remote.books as BooksSnapshot, remote.updatedAt);
      } catch (error) {
        report("Load request failed", error);
      }
    };

    const unsub = useBillingStore.subscribe(() => {
      if (applying) return;
      changeVersion += 1;
      dirty = true;
      queueSave(800);
    });

    void (async () => {
      const versionBeforeLoad = changeVersion;
      try {
        const remote = await booksLoad();
        if (stop) return;
        if (!remote.ok) {
          report(`Initial load rejected by server: ${remote.error}`);
          initialized = true;
          // Preserve current state and attempt to persist it instead of silently losing changes.
          if (hasWork(snapshot())) { dirty = true; queueSave(0); }
          return;
        }
        initialized = true;
        if (changeVersion !== versionBeforeLoad || dirty) {
          // The user changed local data while the initial request was pending; save it, don't overwrite it.
          if (hasWork(snapshot())) { dirty = true; queueSave(0); }
          return;
        }
        if (remote.books) {
          apply(remote.books as BooksSnapshot, remote.updatedAt);
        } else if (hasWork(snapshot())) {
          dirty = true;
          queueSave(0);
        } else {
          lastFp = booksFingerprint(snapshot());
        }
      } catch (error) {
        report("Initial load failed", error);
        initialized = true;
      }
    })();

    const poll = setInterval(() => void pull(), 12000);
    const onFocus = () => {
      if (dirty) queueSave(0);
      else void pull();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && dirty) queueSave(0);
    };
    const onPageHide = () => {
      if (dirty) queueSave(0);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      stop = true;
      unsub();
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [hydrated]);

  return null;
}
