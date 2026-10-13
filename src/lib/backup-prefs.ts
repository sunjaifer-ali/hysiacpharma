import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BackupTarget } from "./backup";

export type BackupFrequency = "on_change" | "hourly" | "daily";

export type DriveAvailability = "unknown" | "yes" | "no";

type BackupPrefsState = {
  autoEnabled: boolean;
  frequency: BackupFrequency;
  lastOkAt: string | null;
  lastError: string | null;
  lastTarget: BackupTarget | null;
  lastFileName: string | null;
  lastFingerprint: string | null;
  folderLinked: boolean;
  folderName: string | null;
  driveFolderId: string | null;
  driveFolderName: string | null;
  driveAvailable: DriveAvailability;
  pending: boolean;
  dismissedPendingAt: string | null;
  setPrefs: (patch: Partial<Omit<BackupPrefsState, "setPrefs">>) => void;
};

export const useBackupPrefs = create<BackupPrefsState>()(
  persist(
    (set) => ({
      autoEnabled: true,
      frequency: "on_change",
      lastOkAt: null,
      lastError: null,
      lastTarget: null,
      lastFileName: null,
      lastFingerprint: null,
      folderLinked: false,
      folderName: null,
      driveFolderId: null,
      driveFolderName: null,
      driveAvailable: "unknown",
      pending: false,
      dismissedPendingAt: null,
      setPrefs: (patch) => set(patch),
    }),
    { name: "hysiac-backup-prefs" },
  ),
);

export function useBackupPrefsHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useBackupPrefs.persist.hasHydrated());
  useEffect(() => {
    const unsub = useBackupPrefs.persist.onFinishHydration(() => setHydrated(true));
    if (useBackupPrefs.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}
