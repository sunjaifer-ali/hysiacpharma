import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HysiacLogo } from "@/components/logo";
import { DeveloperNote } from "@/components/developer-note";
import {
  deviceLockAvailable,
  hashPassword,
  hashPin,
  installLockBridge,
  readLock,
  recoveryMatches,
  requestDeviceUnlock,
  writeLock,
  type LockConfig,
} from "@/lib/app-lock";
import { toast } from "sonner";

const empty: LockConfig = { mode: "off", pinHash: "", passwordHash: "" };

export function AppLockGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [config, setConfig] = useState<LockConfig>(empty);
  const [phase, setPhase] = useState<"check" | "locked" | "open">("check");
  const [deviceNote, setDeviceNote] = useState("");

  useEffect(() => {
    const apply = () => {
      const next = readLock();
      setConfig(next);
      setPhase(next.mode === "off" ? "open" : "locked");
    };
    const returnHome = () => {
      if (readLock().mode !== "off") setPhase("locked");
      void router.navigate({ to: "/" });
    };
    apply();
    installLockBridge(
      returnHome,
      (ok) => {
        if (ok) setPhase("open");
        else setDeviceNote("Tablet lock was not accepted. Use PIN or password.");
      },
    );
    const onChange = () => apply();
    const onHide = () => {
      if (document.visibilityState === "hidden" && readLock().mode !== "off") setPhase("locked");
    };
    window.addEventListener("hysiac-lock-change", onChange);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("hysiac-lock-change", onChange);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [router]);

  useEffect(() => {
    if (phase === "locked" && config.mode === "device") {
      void requestDeviceUnlock().then((ok) => {
        if (ok) setPhase("open");
      });
    }
  }, [phase, config.mode]);

  if (phase === "check") {
    return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Hysiac Management App</div>;
  }
  if (phase === "open") return <>{children}</>;

  return (
    <LockScreen
      config={config}
      deviceNote={deviceNote}
      onUnlock={() => setPhase("open")}
      onDevice={() => {
        setDeviceNote("");
        void requestDeviceUnlock().then((ok) => {
          if (ok) setPhase("open");
          else setDeviceNote("Tablet lock was not accepted. Use PIN or password.");
        });
      }}
    />
  );
}

function LockScreen({
  config,
  deviceNote,
  onUnlock,
  onDevice,
}: {
  config: LockConfig;
  deviceNote: string;
  onUnlock: () => void;
  onDevice: () => void;
}) {
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<"pin" | "password" | "device">(config.pinHash ? "pin" : "device");
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);
  const [verified, setVerified] = useState(false);
  const [mobile, setMobile] = useState("");
  const [dob, setDob] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [nextAgain, setNextAgain] = useState("");

  async function submit(next: string) {
    if (!config.pinHash) return;
    const hash = await hashPin(next);
    if (hash === config.pinHash) {
      onUnlock();
      return;
    }
    setError("Wrong PIN");
    setPin("");
  }

  function press(key: string) {
    setError("");
    if (key === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    const next = (pin + key).slice(0, 4);
    setPin(next);
    if (next.length === 4) void submit(next);
  }

  function checkRecovery() {
    if (!recoveryMatches(mobile, dob)) {
      setError("Mobile number or date of birth does not match");
      return;
    }
    setError("");
    setVerified(true);
  }

  async function resetPin() {
    if (!/^\d{4}$/.test(nextPin)) {
      setError("New PIN must be 4 digits");
      return;
    }
    if (nextPin !== nextAgain) {
      setError("PIN does not match");
      return;
    }
    writeLock({ mode: "pin", pinHash: await hashPin(nextPin), passwordHash: config.passwordHash });
    onUnlock();
  }

  async function submitPassword() {
    if (!config.passwordHash) {
      setError("No password is set yet. Use PIN, or set a password in Settings.");
      return;
    }
    const hash = await hashPassword(password);
    if (hash === config.passwordHash) {
      onUnlock();
      return;
    }
    setError("Wrong password");
    setPassword("");
  }

  const methods = [
    config.pinHash ? { id: "pin" as const, label: "PIN" } : null,
    { id: "password" as const, label: "Password" },
    deviceLockAvailable() || config.mode === "device" ? { id: "device" as const, label: "Tablet" } : null,
  ].filter((item): item is { id: "pin" | "password" | "device"; label: string } => Boolean(item));

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-8">
      <div className="w-full max-w-xs text-center">
        <HysiacLogo className="h-28" />
        <p className="mt-3 text-sm text-muted-foreground">
          {forgot ? (verified ? "Set a new 4-digit PIN" : "Confirm mobile number and date of birth") : "Open the books"}
        </p>
        {forgot ? (
          <div className="mt-6 grid gap-3 text-left">
            {verified ? (
              <>
                <label className="grid gap-1 text-sm">
                  New PIN
                  <Input
                    inputMode="numeric"
                    maxLength={4}
                    type="password"
                    value={nextPin}
                    onChange={(e) => setNextPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Confirm PIN
                  <Input
                    inputMode="numeric"
                    maxLength={4}
                    type="password"
                    value={nextAgain}
                    onChange={(e) => setNextAgain(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </label>
                <Button onClick={() => void resetPin()}>Reset PIN</Button>
              </>
            ) : (
              <>
                <label className="grid gap-1 text-sm">
                  Mobile number
                  <Input
                    inputMode="tel"
                    autoComplete="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Date of birth
                  <Input placeholder="DD/MM/YYYY" value={dob} onChange={(e) => setDob(e.target.value)} />
                </label>
                <Button onClick={checkRecovery}>Continue</Button>
              </>
            )}
            {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
            <button
              type="button"
              className="text-sm text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => {
                setForgot(false);
                setVerified(false);
                setError("");
                setMobile("");
                setDob("");
                setNextPin("");
                setNextAgain("");
              }}
            >
              Back to PIN
            </button>
          </div>
        ) : (
          <>
            {methods.length > 1 ? (
              <div className={`mt-5 grid gap-1 rounded-xl bg-secondary p-1 ${methods.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                {methods.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`rounded-lg py-2 text-sm font-medium ${method === item.id ? "bg-card text-foreground shadow-[var(--shadow-border)]" : "text-muted-foreground"}`}
                    onClick={() => {
                      setMethod(item.id);
                      setError("");
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
            {method === "password" ? (
              <div className="mt-5 grid gap-3 text-left">
                <label className="grid gap-1 text-sm">
                  Password
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void submitPassword();
                    }}
                  />
                </label>
                {error || deviceNote ? <p className="text-center text-sm text-destructive">{error || deviceNote}</p> : null}
                <Button type="button" onClick={() => void submitPassword()}>
                  Open
                </Button>
              </div>
            ) : method === "device" ? (
              <div className="mt-5 grid gap-3">
                <p className="text-sm text-muted-foreground">Use this tablet’s fingerprint, face unlock, or screen PIN.</p>
                {error || deviceNote ? <p className="text-sm text-destructive">{error || deviceNote}</p> : null}
                <Button type="button" onClick={onDevice}>
                  Unlock with tablet
                </Button>
              </div>
            ) : (
              <>
                <div className="mt-6 flex justify-center gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`size-3 rounded-full border border-primary ${i < pin.length ? "bg-primary" : "bg-transparent"}`}
                    />
                  ))}
                </div>
                {error || deviceNote ? <p className="mt-3 text-sm text-destructive">{error || deviceNote}</p> : <p className="mt-3 h-5" />}
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key) =>
                    key === "" ? (
                      <span key="blank" />
                    ) : (
                      <button
                        key={key}
                        type="button"
                        className="h-14 rounded-2xl bg-card text-lg font-medium shadow-[var(--shadow-border)]"
                        onClick={() => press(key)}
                      >
                        {key === "del" ? "⌫" : key}
                      </button>
                    ),
                  )}
                </div>
                <button
                  type="button"
                  className="mt-4 text-sm text-primary underline-offset-2 hover:underline"
                  onClick={() => {
                    setForgot(true);
                    setError("");
                  }}
                >
                  Forgot PIN
                </button>
              </>
            )}
          </>
        )}
        <DeveloperNote className="mt-8" />
      </div>
    </div>
  );
}

export function AppLockCard() {
  const [config, setConfig] = useState<LockConfig>(empty);
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");

  useEffect(() => {
    setConfig(readLock());
  }, []);

  async function savePin() {
    if (!/^\d{4}$/.test(pin)) {
      toast.error("PIN must be 4 digits");
      return;
    }
    if (pin !== again) {
      toast.error("PIN does not match");
      return;
    }
    if (config.pinHash && (await hashPin(current)) !== config.pinHash) {
      toast.error("Current PIN is wrong");
      return;
    }
    const next = { mode: "pin" as const, pinHash: await hashPin(pin), passwordHash: config.passwordHash };
    writeLock(next);
    setConfig(next);
    setPin("");
    setAgain("");
    setCurrent("");
    toast.success("App PIN saved");
  }

  async function turnOff() {
    if (config.pinHash && (await hashPin(current)) !== config.pinHash) {
      toast.error("Enter the current PIN to turn the lock off");
      return;
    }
    const next = { mode: "off" as const, pinHash: "", passwordHash: "" };
    writeLock(next);
    setConfig(next);
    setCurrent("");
    toast.success("Lock turned off");
  }

  async function savePassword() {
    if (password.trim().length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    if (password !== passwordAgain) {
      toast.error("Password does not match");
      return;
    }
    if (config.pinHash && (await hashPin(current)) !== config.pinHash) {
      toast.error("Enter the current PIN");
      return;
    }
    const next = { ...readLock(), passwordHash: await hashPassword(password) };
    writeLock(next);
    setConfig(next);
    setPassword("");
    setPasswordAgain("");
    setCurrent("");
    toast.success("Password saved");
  }

  const status =
    config.mode === "pin" ? "App PIN is on." : config.mode === "device" ? "Device PIN is on." : "Lock is off.";

  return (
    <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
      <h2 className="font-display text-xl">App lock</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {status} Use a 4-digit PIN, a password, or this tablet’s own lock to open the books.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {config.pinHash ? (
          <label className="grid gap-1 text-sm">
            Current PIN
            <Input inputMode="numeric" maxLength={4} type="password" value={current} onChange={(e) => setCurrent(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          </label>
        ) : null}
        <label className="grid gap-1 text-sm">
          New PIN
          <Input inputMode="numeric" maxLength={4} type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </label>
        <label className="grid gap-1 text-sm">
          Confirm PIN
          <Input inputMode="numeric" maxLength={4} type="password" value={again} onChange={(e) => setAgain(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => void savePin()}>Save app PIN</Button>
        {config.mode !== "off" ? (
          <Button variant="outline" onClick={() => void turnOff()}>
            Turn lock off
          </Button>
        ) : null}
      </div>
      <p className="mt-5 text-sm font-medium">Password</p>
      <p className="mt-1 text-sm text-muted-foreground">Optional. Shown next to the PIN on the lock screen.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          New password
          <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Confirm password
          <Input type="password" autoComplete="new-password" value={passwordAgain} onChange={(e) => setPasswordAgain(e.target.value)} />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void savePassword()}>
          {config.passwordHash ? "Change password" : "Save password"}
        </Button>
      </div>
    </div>
  );
}

export function SensitiveGate({
  title,
  setup = false,
  children,
}: {
  title: string;
  setup?: boolean;
  children: ReactNode;
}) {
  const [hasPin, setHasPin] = useState(() => Boolean(readLock().pinHash));
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);
  const [verified, setVerified] = useState(false);
  const [mobile, setMobile] = useState("");
  const [dob, setDob] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [nextAgain, setNextAgain] = useState("");

  useEffect(() => {
    const sync = () => setHasPin(Boolean(readLock().pinHash));
    window.addEventListener("hysiac-lock-change", sync);
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        setOpen(false);
        setPin("");
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("hysiac-lock-change", sync);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  async function submit(next: string) {
    const hash = await hashPin(next);
    if (hash === readLock().pinHash) {
      setOpen(true);
      setError("");
      setPin("");
      return;
    }
    setError("Wrong PIN");
    setPin("");
  }

  function press(key: string) {
    setError("");
    if (key === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    const next = (pin + key).slice(0, 4);
    setPin(next);
    if (next.length === 4) void submit(next);
  }

  async function resetPin() {
    if (!recoveryMatches(mobile, dob)) {
      setError("Mobile number or date of birth does not match");
      return;
    }
    if (!verified) {
      setVerified(true);
      setError("");
      return;
    }
    if (!/^\d{4}$/.test(nextPin) || nextPin !== nextAgain) {
      setError("Enter the same 4-digit PIN twice");
      return;
    }
    writeLock({ mode: "pin", pinHash: await hashPin(nextPin), passwordHash: readLock().passwordHash });
    setOpen(true);
  }

  if (!hasPin) {
    if (setup) return <>{children}</>;
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-card p-6 text-center shadow-[var(--shadow-border)]">
        <h1 className="font-display text-2xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Set the app PIN in Settings before opening this page.</p>
        <Button asChild className="mt-4">
          <Link to="/settings">Open Settings</Link>
        </Button>
      </div>
    );
  }

  if (open) return <>{children}</>;

  return (
    <div className="mx-auto w-full max-w-xs py-6 text-center">
      <h1 className="font-display text-2xl">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{forgot ? "Confirm mobile number and date of birth" : "Enter the app PIN"}</p>
      {forgot ? (
        <div className="mt-6 grid gap-3 text-left">
          {verified ? (
            <>
              <label className="grid gap-1 text-sm">
                New PIN
                <Input inputMode="numeric" maxLength={4} type="password" value={nextPin} onChange={(e) => setNextPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
              </label>
              <label className="grid gap-1 text-sm">
                Confirm PIN
                <Input inputMode="numeric" maxLength={4} type="password" value={nextAgain} onChange={(e) => setNextAgain(e.target.value.replace(/\D/g, "").slice(0, 4))} />
              </label>
            </>
          ) : (
            <>
              <label className="grid gap-1 text-sm">
                Mobile number
                <Input inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} />
              </label>
              <label className="grid gap-1 text-sm">
                Date of birth
                <Input placeholder="DD/MM/YYYY" value={dob} onChange={(e) => setDob(e.target.value)} />
              </label>
            </>
          )}
          {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
          <Button onClick={() => void resetPin()}>{verified ? "Reset PIN" : "Continue"}</Button>
          <button type="button" className="text-sm text-muted-foreground" onClick={() => { setForgot(false); setVerified(false); setError(""); }}>
            Back
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6 flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`size-3 rounded-full border border-primary ${i < pin.length ? "bg-primary" : "bg-transparent"}`} />
            ))}
          </div>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : <p className="mt-3 h-5" />}
          <div className="mt-2 grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key) =>
              key === "" ? (
                <span key="blank" />
              ) : (
                <button key={key} type="button" className="h-14 rounded-2xl bg-card text-lg font-medium shadow-[var(--shadow-border)]" onClick={() => press(key)}>
                  {key === "del" ? "⌫" : key}
                </button>
              ),
            )}
          </div>
          <button type="button" className="mt-4 text-sm text-primary" onClick={() => { setForgot(true); setError(""); }}>
            Forgot PIN
          </button>
        </>
      )}
    </div>
  );
}
