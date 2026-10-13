import {
  BACKUP_LATEST_NAME,
  backupJson,
  booksFingerprint,
  datedBackupName,
  downloadBackupFile,
  parseBackupText,
  shareBackupFile,
  stampBackupName,
  type BackupTarget,
  type BooksSnapshot,
} from "./backup";
import { writeFolderBackup } from "./backup-folder";
import { isAndroidApp } from "./android-backup";
import { useBackupPrefs } from "./backup-prefs";
import { listDriveBackups, readDriveBackup, uploadDriveBackup } from "./drive-backup";
import { redirectToLoginIfRequired } from "@/lib/app-data";
import { useBillingStore } from "./store";

export type BackupRunMode = "auto" | "manual" | "retry";

export type BackupRunResult = {
  ok: boolean;
  target?: BackupTarget;
  fileName?: string;
  error?: string;
  pending?: boolean;
  loginRequired?: boolean;
};

function currentBooks(): BooksSnapshot {
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

function markSuccess(target: BackupTarget, fileName: string, fingerprint: string) {
  useBackupPrefs.getState().setPrefs({
    lastOkAt: new Date().toISOString(),
    lastError: null,
    lastTarget: target,
    lastFileName: fileName,
    lastFingerprint: fingerprint,
    pending: false,
    dismissedPendingAt: null,
    driveAvailable: target === "google-drive" ? "yes" : useBackupPrefs.getState().driveAvailable,
  });
}

function markFail(error: string, pending: boolean, extra?: { driveAvailable?: "no" }) {
  useBackupPrefs.getState().setPrefs({
    lastError: error,
    pending,
    ...(extra?.driveAvailable ? { driveAvailable: extra.driveAvailable } : {}),
  });
}

async function tryDrive(json: string, fileName: string): Promise<BackupRunResult> {
  const prefs = useBackupPrefs.getState();
  if (prefs.driveAvailable === "no") {
    return { ok: false, error: "Google Drive is not connected in this window." };
  }
  try {
    const res = await uploadDriveBackup({
      data: { json, fileName, folderId: prefs.driveFolderId },
    });
    if (res.ok) {
      useBackupPrefs.getState().setPrefs({
        driveFolderId: res.folderId ?? prefs.driveFolderId,
        driveFolderName: res.folderName ?? prefs.driveFolderName,
        driveAvailable: "yes",
      });
      return { ok: true, target: "google-drive", fileName: res.fileName || fileName };
    }
    if (res.loginRequired) {
      redirectToLoginIfRequired({
        ok: false,
        data: null,
        loginRequired: true,
        loginUrl: res.loginUrl,
        errorMessage: res.error,
      });
      return { ok: false, loginRequired: true, error: res.error, pending: false };
    }
    if (res.pending) {
      return { ok: false, pending: true, error: res.error };
    }
    const kind = res.errorKind;
    if (kind === "not_connected" || kind === "scope_denied" || kind === "error") {
      useBackupPrefs.getState().setPrefs({ driveAvailable: "no" });
    }
    return { ok: false, error: res.error ?? "Google Drive backup failed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google Drive backup failed";
    return { ok: false, error: message };
  }
}

export async function runBooksBackup(mode: BackupRunMode): Promise<BackupRunResult> {
  const books = currentBooks();
  const fingerprint = booksFingerprint(books);
  const prefs = useBackupPrefs.getState();
  if (mode === "auto" && prefs.lastFingerprint === fingerprint && prefs.lastOkAt) {
    return { ok: true, target: prefs.lastTarget ?? undefined, fileName: prefs.lastFileName ?? undefined };
  }
  if (mode === "auto" && prefs.pending) {
    return { ok: false, pending: true, error: prefs.lastError ?? undefined };
  }

  const json = backupJson(books);
  const latest = BACKUP_LATEST_NAME;
  const daily = datedBackupName();

  const folder = await writeFolderBackup(json, [latest, daily]);
  if (folder) {
    useBackupPrefs.getState().setPrefs({ folderLinked: true, folderName: folder.folderName });
    markSuccess("folder", latest, fingerprint);
    if (!isAndroidApp() && useBackupPrefs.getState().driveAvailable !== "no") {
      void tryDrive(json, latest);
    }
    return { ok: true, target: "folder", fileName: latest };
  }

  const allowDrive = mode !== "auto" || prefs.driveAvailable !== "no";
  const drive = allowDrive
    ? await tryDrive(json, latest)
    : { ok: false as const, error: "Google Drive is not connected in this window." };
  if (drive.ok) {
    markSuccess("google-drive", drive.fileName ?? latest, fingerprint);
    return drive;
  }

  if (mode === "manual") {
    const shared = await shareBackupFile(json, stampBackupName());
    if (shared) {
      markSuccess("share", latest, fingerprint);
      return { ok: true, target: "share", fileName: latest };
    }
    downloadBackupFile(json, stampBackupName());
    markSuccess("download", latest, fingerprint);
    return { ok: true, target: "download", fileName: latest };
  }

  if (drive.pending) {
    markFail("Waiting for Google Drive. Link the Drive folder this computer already syncs, or tap Backup now.", true);
    return drive;
  }
  if (drive.loginRequired) {
    markFail("Continue with Grok to reach Google Drive, or link a Drive folder below.", true);
    return drive;
  }

  markFail(drive.error ?? "Link a Google Drive folder in Settings to auto-backup.", true);
  return { ok: false, error: drive.error, pending: true };
}

export function backupIsDue(): boolean {
  const prefs = useBackupPrefs.getState();
  if (!prefs.autoEnabled) return false;
  if (!prefs.lastOkAt) return true;
  const last = new Date(prefs.lastOkAt).getTime();
  if (Number.isNaN(last)) return true;
  const age = Date.now() - last;
  if (prefs.frequency === "on_change") return true;
  if (prefs.frequency === "hourly") return age >= 60 * 60 * 1000;
  return age >= 20 * 60 * 60 * 1000;
}

export async function restoreFromDriveFile(fileId: string): Promise<void> {
  const res = await readDriveBackup({ data: { fileId } });
  if (!res.ok || !res.json) throw new Error(res.error ?? "Could not read that Drive backup");
  const books = parseBackupText(res.json);
  useBillingStore.getState().replaceAll(books);
}

export async function fetchDriveBackupList() {
  const folderId = useBackupPrefs.getState().driveFolderId;
  return listDriveBackups({ data: { folderId } });
}
