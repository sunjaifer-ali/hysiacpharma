const IMPORT_GUARD_KEY = "hysiac:books-imported-at";
const IMPORT_GUARD_MS = 15_000;

/** Prevent a stale initial Neon read from replacing a just-restored backup. */
export function markBooksImport(): void {
  try {
    localStorage.setItem(IMPORT_GUARD_KEY, String(Date.now()));
  } catch {
    // The store subscription still attempts to sync the restored books.
  }
}

export function isBooksImportRecent(): boolean {
  try {
    const importedAt = Number(localStorage.getItem(IMPORT_GUARD_KEY) ?? 0);
    return importedAt > 0 && Date.now() - importedAt < IMPORT_GUARD_MS;
  } catch {
    return false;
  }
}
