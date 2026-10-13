const KEY = "hysiac-app-lock-v1";

export type LockMode = "off" | "pin" | "device";

export type LockConfig = {
  mode: LockMode;
  pinHash: string;
  passwordHash: string;
};

type AndroidBridge = {
  confirmDevice?: () => void;
  hasDeviceLock?: () => boolean;
};

function bridge(): AndroidBridge | undefined {
  return (window as unknown as { HysiacAndroid?: AndroidBridge }).HysiacAndroid;
}

export function readLock(): LockConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { mode: "off", pinHash: "", passwordHash: "" };
    const parsed = JSON.parse(raw) as Partial<LockConfig>;
    const mode = parsed.mode === "pin" || parsed.mode === "device" ? parsed.mode : "off";
    return {
      mode,
      pinHash: typeof parsed.pinHash === "string" ? parsed.pinHash : "",
      passwordHash: typeof parsed.passwordHash === "string" ? parsed.passwordHash : "",
    };
  } catch {
    return { mode: "off", pinHash: "", passwordHash: "" };
  }
}

export function writeLock(config: LockConfig): void {
  localStorage.setItem(KEY, JSON.stringify(config));
  window.dispatchEvent(new Event("hysiac-lock-change"));
}

export async function hashPin(pin: string): Promise<string> {
  return hashSecret("pin", pin);
}

export async function hashPassword(password: string): Promise<string> {
  return hashSecret("pass", password);
}

async function hashSecret(kind: "pin" | "pass", value: string): Promise<string> {
  const data = new TextEncoder().encode(`hysiac-gst-${kind}:${value}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const RECOVERY_MOBILE = "9995080431";
const RECOVERY_DOB = "30041984";

export function recoveryMatches(mobile: string, dob: string): boolean {
  const phone = mobile.replace(/\D/g, "");
  const day = dob.replace(/\D/g, "");
  return phone === RECOVERY_MOBILE && (day === RECOVERY_DOB || day === "19840430");
}

export function deviceLockAvailable(): boolean {
  return typeof bridge()?.confirmDevice === "function";
}

let deviceWait: ((ok: boolean) => void) | null = null;

export function installLockBridge(onLock: () => void, onDevice: (ok: boolean) => void): void {
  const w = window as unknown as {
    __hysiacLock?: () => void;
    __hysiacDeviceLock?: (ok: boolean) => void;
  };
  w.__hysiacLock = onLock;
  w.__hysiacDeviceLock = (ok: boolean) => {
    deviceWait?.(ok);
    deviceWait = null;
    onDevice(ok);
  };
}

export function requestDeviceUnlock(): Promise<boolean> {
  const confirm = bridge()?.confirmDevice;
  if (!confirm) return Promise.resolve(false);
  return new Promise((resolve) => {
    deviceWait = resolve;
    confirm();
  });
}
