import { useEffect } from "react";
import { booksFingerprint, type BooksSnapshot } from "@/lib/backup";
import { isDesktopApp } from "@/lib/desktop";
import { booksLoad, booksSave } from "@/lib/staff-accounts";
import { useBillingStore } from "@/lib/store";
import { useHasHydrated } from "@/lib/store";

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
    books.invoices.length +
      books.products.length +
      books.parties.length +
      books.purchases.length +
      books.quotes.length +
      books.creditNotes.length >
    0
  );
}

/** Keeps invoices, products and parties in Neon so every signed-in device sees the same books. */
export function BooksSync() {
  const hydrated = useHasHydrated();

  useEffect(() => {
    if (!hydrated || isDesktopApp) return;
    let stop = false;
    let dirty = false;
    let applying = false;
    let lastFp = "";
    let lastUpdated: string | null = null;
    let timer = 0;

    const apply = (books: BooksSnapshot, updatedAt: string | null) => {
      applying = true;
      useBillingStore.getState().replaceAll(books);
      lastFp = booksFingerprint(snapshot());
      lastUpdated = updatedAt;
      dirty = false;
      applying = false;
    };

    const save = async () => {
      if (stop || applying) return;
      const books = snapshot();
      const fp = booksFingerprint(books);
      if (fp === lastFp) {
        dirty = false;
        return;
      }
      const result = await booksSave({ data: { json: JSON.stringify(books) } });
      if (stop || !result.ok) return;
      // Do not mark the store clean if it changed while this save was in flight.
      // A newer invoice may have been created after this snapshot was taken.
      lastFp = fp;
      lastUpdated = result.updatedAt;
      const currentFp = booksFingerprint(snapshot());
      dirty = currentFp !== fp;
      if (dirty) {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => { void save(); }, 100);
      }
    };

    const pull = async () => {
      if (stop || dirty || applying) return;
      const remote = await booksLoad();
      if (stop || !remote.ok || !remote.books) return;
      if (remote.updatedAt === lastUpdated) return;
      apply(remote.books as BooksSnapshot, remote.updatedAt);
    };

    const unsub = useBillingStore.subscribe(() => {
      if (applying) return;
      dirty = true;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void save();
      }, 800);
    });

    // Capture local state before requesting Neon. If the user creates or edits an
    // invoice while the initial request is in flight, never replace that newer
    // local state with the older server snapshot.
    const initialLocalFp = booksFingerprint(snapshot());
    void (async () => {
      const remote = await booksLoad();
      if (stop || !remote.ok) return;
      const currentFp = booksFingerprint(snapshot());
      if (dirty || currentFp !== initialLocalFp) {
        // Local state changed while loading. Keep it and push the newer snapshot.
        dirty = true;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => { void save(); }, 100);
        return;
      }
      if (remote.books) apply(remote.books as BooksSnapshot, remote.updatedAt);
      else if (hasWork(snapshot())) await save();
      else lastFp = booksFingerprint(snapshot());
    })();

    const poll = window.setInterval(() => {
      void pull();
    }, 12000);
    const onFocus = () => {
      void pull();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      stop = true;
      unsub();
      window.clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, [hydrated]);

  return null;
}
