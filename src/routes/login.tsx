import { createFileRoute, Navigate, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { HysiacLogo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ensureAdmin } from "@/lib/ensure-admin";
import { loginEmail } from "@/lib/login-id";
import { isDesktopApp } from "@/lib/desktop";
import { staffSignIn } from "@/lib/staff-accounts";
import { useStaffSession } from "@/lib/staff-session";
import { toast } from "sonner";
import { DeveloperNote } from "@/components/developer-note";

export const Route = createFileRoute("/login")({
  loader: async () => {
    if (!isDesktopApp) return { ok: true as const };
    try {
      return await ensureAdmin();
    } catch {
      return { ok: true as const };
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  const web = useStaffSession();
  if (!isDesktopApp) {
    if (!web.ready) return <LockSplash />;
    if (web.session) return <Navigate to="/" />;
    return <LoginForm />;
  }
  if (isPending) return <LockSplash />;
  if (user) return <Navigate to="/" />;
  return <LoginForm />;
}

function LockSplash() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-3">
        <HysiacLogo className="h-24" />
        <div className="h-3 w-40 animate-pulse rounded-full bg-secondary" />
      </div>
    </main>
  );
}

function LoginForm() {
  const router = useRouter();
  const [user, setUser] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user.trim() || !password) {
      toast.error("Enter a user name and password");
      return;
    }
    setBusy(true);
    try {
      if (!isDesktopApp) {
        const result = await staffSignIn({ data: { username: user, password } });
        if (!result.ok) throw new Error(result.error);
        toast.success("Signed in");
        window.location.assign("/");
        return;
      }
      const email = loginEmail(user);
      if (!email || !authEnabled) throw new Error("Sign-in is disabled");
      await ensureAdmin();
      const { error } = await authClient.signIn.email({ email, password });
      if (error) throw new Error(error.message || "Wrong user name or password");
      await router.invalidate();
      toast.success("Signed in");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <HysiacLogo className="h-24" />
          <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Hysiac GST Billing</p>
        </div>

        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-lift)] sm:p-8">
          <div className="text-center">
            <h1 className="font-display text-3xl">Sign in</h1>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Sign in with your Hysiac account to open billing and business records.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-user">User name</Label>
            <Input
              id="login-user"
              autoComplete="username"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="h-11"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-pass">Password</Label>
            <Input
              id="login-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
              required
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {busy ? "Please wait…" : "Sign in"}
          </Button>
        </form>
        <DeveloperNote className="mt-6" />
      </div>
    </main>
  );
}
