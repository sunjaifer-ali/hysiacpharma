import { useEffect, useState } from "react";
import { Cloud, FolderOpen, Link2Off, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { redirectToLoginIfRequired } from "@/lib/app-data";
import { parseBackupText } from "@/lib/backup";
import { isAndroidApp } from "@/lib/android-backup";
import { isDesktopApp } from "@/lib/desktop";
import {
  canPickBackupFolder,
  clearBackupFolder,
  listFolderBackups,
  pickBackupFolder,
  readFolderBackup,
  type FolderBackupEntry,
} from "@/lib/backup-folder";
import { useBackupPrefs, type BackupFrequency } from "@/lib/backup-prefs";
import { fetchDriveBackupList, restoreFromDriveFile, runBooksBackup } from "@/lib/backup-run";
import { useBillingStore } from "@/lib/store";

function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Never";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
  }).format(d);
}

function targetLabel(target: string | null): string {
  if (target === "google-drive") return "Google Drive";
  if (target === "folder") return "linked Drive folder";
  if (target === "share") return "shared to Drive";
  if (target === "download") return "downloaded file";
  return "";
}

export function BackupCard() {
  const prefs = useBackupPrefs();
  const replaceAll = useBillingStore((s) => s.replaceAll);
  const [busy, setBusy] = useState(false);
  const [folderFiles, setFolderFiles] = useState<FolderBackupEntry[]>([]);
  const [driveFiles, setDriveFiles] = useState<{ id: string; name: string }[]>([]);
  const [pick, setPick] = useState("");
  const folderOk = canPickBackupFolder();
  const android = isAndroidApp();
  const windowsOnly = isDesktopApp && !android;

  useEffect(() => {
    if (!prefs.folderLinked) {
      setFolderFiles([]);
      return;
    }
    void listFolderBackups()
      .then(setFolderFiles)
      .catch(() => setFolderFiles([]));
  }, [prefs.folderLinked, prefs.lastOkAt]);

  async function backupNow() {
    setBusy(true);
    try {
      const res = await runBooksBackup("manual");
      if (res.ok) {
        toast.success(
          res.target === "google-drive"
            ? "Copied to Google Drive"
            : res.target === "folder"
              ? "Saved in your Google Drive folder"
              : res.target === "share"
                ? "Choose Google Drive in the share list"
                : "Backup file downloaded — move it into Google Drive",
        );
      } else if (res.loginRequired) {
        toast.message("Continue with Grok to reach Google Drive");
      } else {
        toast.error(res.error ?? "Backup did not finish");
      }
    } finally {
      setBusy(false);
    }
  }

  async function linkFolder() {
    setBusy(true);
    try {
      const handle = await pickBackupFolder();
      prefs.setPrefs({ folderLinked: true, folderName: handle.name, pending: false, dismissedPendingAt: null });
      toast.success(`Linked “${handle.name}”. New bills will be copied here.`);
      await runBooksBackup("manual");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Could not link that folder");
    } finally {
      setBusy(false);
    }
  }

  async function unlinkFolder() {
    await clearBackupFolder();
    prefs.setPrefs({ folderLinked: false, folderName: null });
    setFolderFiles([]);
    toast.success("Backup folder unlinked");
  }

  async function loadDriveList() {
    setBusy(true);
    try {
      const res = await fetchDriveBackupList();
      if (res.loginRequired) {
        redirectToLoginIfRequired({
          ok: false,
          data: null,
          loginRequired: true,
          loginUrl: res.loginUrl,
          errorMessage: res.error,
        });
        return;
      }
      if (!res.ok) {
        toast.error(res.error ?? "Could not list Drive backups");
        return;
      }
      prefs.setPrefs({
        driveAvailable: "yes",
        driveFolderId: res.folderId ?? prefs.driveFolderId,
        driveFolderName: res.folderName ?? prefs.driveFolderName,
      });
      setDriveFiles(res.files ?? []);
      if (!res.files?.length) toast.message("No Hysiac backup files in Drive yet");
    } finally {
      setBusy(false);
    }
  }

  async function restorePicked() {
    if (!pick) {
      toast.error("Choose a backup file first");
      return;
    }
    setBusy(true);
    try {
      if (pick.startsWith("drive:")) {
        await restoreFromDriveFile(pick.slice(6));
      } else {
        const text = await readFolderBackup(pick);
        replaceAll(parseBackupText(text));
      }
      toast.success("Books restored from backup");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not restore that backup");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{windowsOnly ? "Backup on this PC" : "Google Drive backup"}</CardTitle>
        <CardDescription>
          {windowsOnly
            ? "Invoices and stock stay on this computer. Use Export JSON below to copy the books to a USB drive or another PC."
            : android
              ? "Link a Google Drive folder once. After every invoice, purchase, return or purchase order, the books are copied there. Backup now copies immediately."
              : "Auto-copy the books into the Drive folder you already use. After each bill the latest JSON is overwritten, plus one dated file per day."}
        </CardDescription>
      </CardHeader>
      {windowsOnly ? null : (
      <CardContent className="grid gap-4">
        <label className="flex min-h-11 items-start gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-3">
          <Checkbox
            checked={prefs.autoEnabled}
            onCheckedChange={(v) => prefs.setPrefs({ autoEnabled: v === true, pending: false })}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium">Auto backup</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Runs after invoices, purchases, returns, purchase orders and credit notes, while the app is open.
            </span>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block">When</Label>
            <Select
              value={prefs.frequency}
              onValueChange={(v) => prefs.setPrefs({ frequency: v as BackupFrequency })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="on_change">After every posted bill</SelectItem>
                <SelectItem value="hourly">Hourly while the app is open</SelectItem>
                <SelectItem value="daily">Once a day</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-xl border border-border px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Last backup</p>
            <p className="mt-1 text-sm font-medium">{formatWhen(prefs.lastOkAt)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {prefs.lastOkAt
                ? `${prefs.lastFileName ?? "hysiac-gst-latest.json"}${prefs.lastTarget ? ` · ${targetLabel(prefs.lastTarget)}` : ""}`
                : "Not copied yet"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card px-3 py-3">
          <p className="text-sm font-medium">Linked Drive folder</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {android
              ? "Tap Link folder. In the list, open the side menu and choose Google Drive. Create or open a folder named Hysiac GST Backups, then tap Allow. The Pad must already be signed in to Drive."
              : "On a computer with Google Drive for desktop, pick that Drive folder (or a folder inside it). The app writes JSON there and Drive syncs it. On a phone, tap Backup now and choose Drive in the share list."}
          </p>
          <p className="mt-2 text-sm">
            {prefs.folderLinked ? (
              <span>
                Linked: <span className="font-medium">{prefs.folderName || "folder"}</span>
              </span>
            ) : folderOk ? (
              "No folder linked yet"
            ) : (
              "This phone cannot pin a Drive folder. Use Backup now."
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {folderOk ? (
              <Button variant="outline" onClick={() => void linkFolder()} disabled={busy}>
                <FolderOpen className="size-4" />
                {prefs.folderLinked ? "Change folder" : "Link Google Drive folder"}
              </Button>
            ) : null}
            {prefs.folderLinked ? (
              <Button variant="ghost" onClick={() => void unlinkFolder()} disabled={busy}>
                <Link2Off className="size-4" />
                Unlink
              </Button>
            ) : null}
          </div>
        </div>

        {prefs.lastError && !prefs.lastOkAt && !prefs.pending ? (
          <p className="text-sm text-destructive">{prefs.lastError}</p>
        ) : prefs.pending && !prefs.lastOkAt ? (
          <p className="text-sm text-muted-foreground">
            Waiting to reach Google Drive from this window. Link the Drive folder below for automatic copies, or tap
            Backup now to save a file you can put in Drive.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void backupNow()} disabled={busy}>
            <Upload className="size-4" />
            Backup now
          </Button>
          {android ? (
            <Button
              variant="outline"
              disabled={busy || !prefs.folderLinked}
              onClick={() => {
                void listFolderBackups()
                  .then(setFolderFiles)
                  .catch(() => setFolderFiles([]));
              }}
            >
              <Cloud className="size-4" />
              Show saved copies
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void loadDriveList()} disabled={busy}>
              <Cloud className="size-4" />
              List Drive copies
            </Button>
          )}
        </div>

        {(folderFiles.length > 0 || driveFiles.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a backup to restore" />
              </SelectTrigger>
              <SelectContent>
                {folderFiles.map((f) => (
                  <SelectItem key={`f-${f.name}`} value={f.name}>
                    Folder · {f.name}
                  </SelectItem>
                ))}
                {driveFiles.map((f) => (
                  <SelectItem key={`d-${f.id}`} value={`drive:${f.id}`}>
                    Drive · {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void restorePicked()} disabled={busy || !pick}>
              <RotateCcw className="size-4" />
              Restore
            </Button>
          </div>
        )}
      </CardContent>
      )}
    </Card>
  );
}

