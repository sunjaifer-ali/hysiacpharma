import { BACKUP_LATEST_NAME } from "./backup";
import {
  androidBackupFolderName,
  androidClearBackupFolder,
  androidHasBackupFolder,
  androidListBackupFiles,
  androidPickBackupFolder,
  androidReadBackupFile,
  androidWriteBackupFile,
  isAndroidApp,
} from "./android-backup";

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      id?: string;
      mode?: "read" | "readwrite";
      startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";
    }) => Promise<FileSystemDirectoryHandle>;
  }
}

const DB_NAME = "hysiac-backup";
const STORE = "kv";
const FOLDER_KEY = "folder";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"));
  });
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbPut(key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function idbDelete(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export function canPickBackupFolder(): boolean {
  return isAndroidApp() || (typeof window !== "undefined" && typeof window.showDirectoryPicker === "function");
}

export async function pickBackupFolder(): Promise<{ name: string }> {
  if (isAndroidApp()) {
    const name = await androidPickBackupFolder();
    if (!name) throw new DOMException("The folder picker was closed", "AbortError");
    return { name };
  }
  if (!canPickBackupFolder()) {
    throw new Error("This browser cannot link a Drive folder. Use Backup now to save a file into Drive.");
  }
  const handle = await window.showDirectoryPicker!({
    id: "hysiac-gst-backup",
    mode: "readwrite",
    startIn: "documents",
  });
  await idbPut(FOLDER_KEY, handle);
  return handle;
}

export async function clearBackupFolder(): Promise<void> {
  if (isAndroidApp()) {
    androidClearBackupFolder();
    return;
  }
  await idbDelete(FOLDER_KEY);
}

export async function loadBackupFolder(): Promise<{ name: string } | null> {
  if (isAndroidApp()) {
    if (!androidHasBackupFolder()) return null;
    return { name: androidBackupFolderName() || "Google Drive" };
  }
  try {
    return (await idbGet<FileSystemDirectoryHandle>(FOLDER_KEY)) ?? null;
  } catch {
    return null;
  }
}

type DirHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor: { mode: "read" | "readwrite" }) => Promise<PermissionState | "prompt">;
  requestPermission?: (descriptor: { mode: "read" | "readwrite" }) => Promise<PermissionState | "prompt">;
  entries?: () => AsyncIterableIterator<[string, FileSystemHandle]>;
};

async function ensureWritable(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const dir = handle as DirHandle;
  const mode = { mode: "readwrite" as const };
  if (typeof dir.queryPermission === "function") {
    const q = await dir.queryPermission(mode);
    if (q === "granted") return true;
    if (q === "denied") return false;
  }
  if (typeof dir.requestPermission === "function") {
    const next = await dir.requestPermission(mode);
    return next === "granted";
  }
  return true;
}

export async function writeFolderBackup(
  json: string,
  names: string[],
): Promise<{ folderName: string } | null> {
  if (isAndroidApp()) {
    if (!androidHasBackupFolder()) return null;
    for (const name of names) {
      const ok = await androidWriteBackupFile(name, json);
      if (!ok) return null;
    }
    return { folderName: androidBackupFolderName() || "Google Drive" };
  }
  const handle = await loadBrowserFolder();
  if (!handle) return null;
  const ok = await ensureWritable(handle);
  if (!ok) return null;
  for (const name of names) {
    const file = await handle.getFileHandle(name, { create: true });
    const writable = await file.createWritable();
    await writable.write(json);
    await writable.close();
  }
  return { folderName: handle.name };
}

export type FolderBackupEntry = { name: string; at: number };

export async function listFolderBackups(): Promise<FolderBackupEntry[]> {
  if (isAndroidApp()) {
    if (!androidHasBackupFolder()) return [];
    const files = await androidListBackupFiles();
    return files.sort((a, b) => {
      if (a.name === BACKUP_LATEST_NAME) return -1;
      if (b.name === BACKUP_LATEST_NAME) return 1;
      return b.at - a.at;
    });
  }
  const handle = await loadBrowserFolder();
  if (!handle) return [];
  const ok = await ensureWritable(handle);
  if (!ok) return [];
  const entries: FolderBackupEntry[] = [];
  const dir = handle as DirHandle;
  if (typeof dir.entries !== "function") return [];
  for await (const [name, entry] of dir.entries()) {
    if (entry.kind !== "file") continue;
    if (!name.toLowerCase().endsWith(".json")) continue;
    if (!name.toLowerCase().startsWith("hysiac-gst")) continue;
    const file = await (entry as FileSystemFileHandle).getFile();
    entries.push({ name, at: file.lastModified });
  }
  return entries.sort((a, b) => {
    if (a.name === BACKUP_LATEST_NAME) return -1;
    if (b.name === BACKUP_LATEST_NAME) return 1;
    return b.at - a.at;
  });
}

export async function readFolderBackup(name: string): Promise<string> {
  if (isAndroidApp()) {
    const text = await androidReadBackupFile(name);
    if (!text) throw new Error("That backup could not be read. Link the Drive folder again.");
    return text;
  }
  const handle = await loadBrowserFolder();
  if (!handle) throw new Error("No backup folder linked");
  const ok = await ensureWritable(handle);
  if (!ok) throw new Error("Allow access to the backup folder");
  const fileHandle = await handle.getFileHandle(name);
  const file = await fileHandle.getFile();
  return file.text();
}

async function loadBrowserFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return (await idbGet<FileSystemDirectoryHandle>(FOLDER_KEY)) ?? null;
  } catch {
    return null;
  }
}
