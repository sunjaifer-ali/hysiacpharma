type AndroidBackupBridge = {
  pickBackupFolder: () => void;
  hasBackupFolder: () => boolean;
  backupFolderName: () => string;
  clearBackupFolder: () => void;
  writeBackupFile: (name: string, text: string) => void;
  listBackupFiles: () => void;
  readBackupFile: (name: string) => void;
};

type BackupCallbackWindow = Window & {
  HysiacAndroid?: AndroidBackupBridge;
  __hysiacBackupFolder?: (ok: boolean, name: string) => void;
  __hysiacBackupWrite?: (ok: boolean) => void;
  __hysiacBackupList?: (files: { name: string; at: number }[]) => void;
  __hysiacBackupRead?: (text: string) => void;
};

function bridge(): AndroidBackupBridge | null {
  if (typeof window === "undefined") return null;
  const native = (window as BackupCallbackWindow).HysiacAndroid;
  if (!native || typeof native.pickBackupFolder !== "function") return null;
  return native;
}

export function isAndroidApp(): boolean {
  return bridge() !== null;
}

export function androidHasBackupFolder(): boolean {
  try {
    return bridge()?.hasBackupFolder() ?? false;
  } catch {
    return false;
  }
}

export function androidBackupFolderName(): string {
  try {
    return bridge()?.backupFolderName() ?? "";
  } catch {
    return "";
  }
}

export function androidClearBackupFolder(): void {
  bridge()?.clearBackupFolder();
}

export function androidPickBackupFolder(): Promise<string | null> {
  const native = bridge();
  if (!native) return Promise.resolve(null);
  return new Promise((resolve) => {
    const host = window as BackupCallbackWindow;
    host.__hysiacBackupFolder = (ok, name) => {
      delete host.__hysiacBackupFolder;
      resolve(ok && name ? name : null);
    };
    native.pickBackupFolder();
  });
}

export function androidWriteBackupFile(name: string, text: string): Promise<boolean> {
  const native = bridge();
  if (!native) return Promise.resolve(false);
  return new Promise((resolve) => {
    const host = window as BackupCallbackWindow;
    host.__hysiacBackupWrite = (ok) => {
      delete host.__hysiacBackupWrite;
      resolve(ok);
    };
    native.writeBackupFile(name, text);
  });
}

export function androidListBackupFiles(): Promise<{ name: string; at: number }[]> {
  const native = bridge();
  if (!native) return Promise.resolve([]);
  return new Promise((resolve) => {
    const host = window as BackupCallbackWindow;
    host.__hysiacBackupList = (files) => {
      delete host.__hysiacBackupList;
      resolve(Array.isArray(files) ? files : []);
    };
    native.listBackupFiles();
  });
}

export function androidReadBackupFile(name: string): Promise<string> {
  const native = bridge();
  if (!native) return Promise.resolve("");
  return new Promise((resolve) => {
    const host = window as BackupCallbackWindow;
    host.__hysiacBackupRead = (text) => {
      delete host.__hysiacBackupRead;
      resolve(typeof text === "string" ? text : "");
    };
    native.readBackupFile(name);
  });
}
