export const dbSource = "pglite" as const;

export function getSql(): never {
  throw new Error("Database is not used in the Windows app.");
}

export function ensureDbReady(): Promise<void> {
  return Promise.resolve();
}
