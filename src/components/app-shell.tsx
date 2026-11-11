import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArchiveRestore,
  BookOpen,
  ClipboardList,
  FileText,
  FileSignature,
  Landmark,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Package,
  Plus,
  ScrollText,
  Settings,
  Undo2,
  UserRoundPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { canOpen, type WebRole } from "@/lib/web-users";
import { staffSignOut, staffSetPassword } from "@/lib/staff-accounts";
import { useStaffSession } from "@/lib/staff-session";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { YearSwitch } from "@/components/year-switch";
import { HysiacMark } from "@/components/logo";
import { BackupEngine } from "@/components/backup-engine";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { isDesktopApp } from "@/lib/desktop";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, group: "Selling" },
  { to: "/invoices", label: "Invoices", icon: FileText, group: "Selling" },
  { to: "/quotes", label: "Quotations", icon: FileSignature, group: "Selling" },
  { to: "/returns", label: "Returns", icon: Undo2, group: "Selling" },
  { to: "/credits", label: "Credit notes", icon: ScrollText, group: "Selling" },
  { to: "/purchases", label: "Purchases", icon: ClipboardList, group: "Buying" },
  { to: "/payments", label: "Payments", icon: Wallet, group: "Buying" },
  { to: "/products", label: "Products", icon: Package, group: "Stock" },
  { to: "/parties", label: "Parties", icon: Users, group: "Stock" },
  { to: "/reports", label: "Reports", icon: BookOpen, group: "Office" },
  { to: "/accounts", label: "Accounts", icon: Landmark, group: "Office" },
  { to: "/settings", label: "Settings", icon: Settings, group: "Office" },
  { to: "/users", label: "Users", icon: UserRoundPlus, group: "Office" },
  { to: "/bin", label: "Recycle bin", icon: ArchiveRestore, group: "Office" },
] as const;

const GROUPS = ["Selling", "Buying", "Stock", "Office"] as const;

function visibleNav(role: WebRole | "desktop") {
  return NAV.filter((item) => {
    if (item.to === "/users" && role === "desktop") return false;
    return role === "desktop" || role === "admin" || canOpen(role, item.to);
  });
}

function NavLinks({ onNavigate, role }: { onNavigate?: () => void; role: WebRole | "desktop" }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = visibleNav(role);
  return (
    <nav className="flex flex-col gap-1">
      {GROUPS.map((group) => {
        const rows = items.filter((item) => item.group === group);
        if (rows.length === 0) return null;
        return (
          <div key={group} className="mb-2">
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{group}</p>
            {rows.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(`${item.to}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors min-h-11",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

const IDLE_MS = 30 * 60 * 1000;

function useIdleSignOut(enabled: boolean) {
  const last = useRef(Date.now());
  useEffect(() => {
    if (!enabled) return;
    last.current = Date.now();
    let left = false;
    const mark = () => {
      last.current = Date.now();
    };
    const leave = () => {
      if (left) return;
      left = true;
      void staffSignOut().finally(() => {
        window.location.assign("/login");
      });
    };
    const tick = () => {
      if (Date.now() - last.current >= IDLE_MS) leave();
    };
    const events = ["pointerdown", "keydown", "touchstart", "input"] as const;
    for (const event of events) window.addEventListener(event, mark, { passive: true });
    window.addEventListener("scroll", mark, { passive: true, capture: true });
    document.addEventListener("visibilitychange", tick);
    const timer = window.setInterval(tick, 15_000);
    return () => {
      left = true;
      for (const event of events) window.removeEventListener(event, mark);
      window.removeEventListener("scroll", mark, { capture: true });
      document.removeEventListener("visibilitychange", tick);
      window.clearInterval(timer);
    };
  }, [enabled]);
}

export function AppShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const staff = useStaffSession();
  const webSession = staff.session;
  const role: WebRole | "desktop" = isDesktopApp ? "desktop" : (webSession?.role ?? "billing");
  const [ready, setReady] = useState(isDesktopApp);
  useIdleSignOut(!isDesktopApp && Boolean(webSession));

  useEffect(() => {
    if (isDesktopApp || staff.ready) setReady(true);
  }, [staff.ready]);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <span className="text-primary">
          <HysiacMark className="size-12" />
        </span>
      </div>
    );
  }
  if (!isDesktopApp && !webSession) return <Navigate to="/login" />;
  if (!isDesktopApp && webSession?.mustChange) return <MustChangePassword id={webSession.id} />;
  if (!isDesktopApp && webSession && !canOpen(webSession.role, pathname)) return <Navigate to="/invoices" />;

  if (isDesktopApp && isPending) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-primary">
            <HysiacMark className="size-12" />
          </span>
          <div className="h-3 w-40 animate-pulse rounded-full bg-secondary" />
        </div>
      </div>
    );
  }
  if (isDesktopApp && !user) return <RedirectToSignIn />;

  return (
    <div className="app-shell min-h-dvh">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card/80 px-4 py-5 backdrop-blur-sm md:flex">
        <Link to="/" className="mb-4 flex shrink-0 items-center gap-3 rounded-xl px-1 py-1 hover:bg-accent">
          <span className="text-primary">
            <HysiacMark />
          </span>
          <div className="min-w-0">
            <p className="font-display text-base leading-tight text-foreground">Hysiac</p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Management</p>
          </div>
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          <NavLinks role={role} />
        </div>
        <div className="mt-2 shrink-0 border-t border-border px-1 pt-3">
          {isDesktopApp ? <p className="text-sm font-medium">This device</p> : <WebAccountChip session={webSession} />}
        </div>
      </aside>

      <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <SheetClose asChild>
                    <Link to="/" className="flex items-center gap-2">
                      <span className="text-primary">
                        <HysiacMark className="size-8" />
                      </span>
                      Hysiac Management
                    </Link>
                  </SheetClose>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
                <NavLinks role={role} />
              </div>
              <div className="mt-4 border-t border-border pt-4">
                {isDesktopApp ? <p className="text-sm font-medium">This device</p> : <WebAccountChip session={webSession} />}
              </div>
            </SheetContent>
          </Sheet>
          <Link to="/" className="flex items-center gap-2">
            <HysiacMark className="size-8" />
            <div>
              <p className="font-display text-base leading-none">Hysiac</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Management</p>
            </div>
          </Link>
          <YearSwitch canChange={role === "admin" || role === "desktop"} />
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link to="/invoices/new">
              <Plus className="size-4" />
              New
            </Link>
          </Button>
          <SignOutButton />
        </div>
      </header>

      <div className="app-shell-main overflow-x-clip md:pl-60">
        <div className="no-print sticky top-0 z-20 hidden items-center justify-between gap-2 border-b border-border bg-background/85 px-6 py-3 backdrop-blur-md md:flex">
          <YearSwitch canChange={role === "admin" || role === "desktop"} />
          <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link to="/invoices/new">
              <Plus className="size-4" />
              New invoice
            </Link>
          </Button>
          {role !== "billing" ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/purchases/new">New purchase</Link>
            </Button>
          ) : null}
          <SignOutButton />
          </div>
        </div>
        <div className={cn("app-shell-pad mx-auto w-full px-4 pb-24 pt-6 sm:px-6 md:pb-10 md:pt-8", wide ? "max-w-[1400px]" : "max-w-6xl")}>{children}</div>
      </div>

      <PhoneBar role={role} />
      {isDesktopApp ? <BackupEngine /> : null}
    </div>
  );
}

function MustChangePassword({ id }: { id: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4">
      <form
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void staffSetPassword({ data: { id, password, currentPassword } })
            .then((result) => {
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("Password changed");
              window.location.assign("/");
            })
            .finally(() => setBusy(false));
        }}
      >
        <div className="text-center">
          <h1 className="font-display text-3xl">Change password</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
            The current password is not safe to keep. Choose a new one of at least 8 characters before the books open.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="must-current">Current password</Label>
          <Input id="must-current" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="must-next">New password</Label>
          <Input id="must-next" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : "Save password"}
        </Button>
      </form>
    </main>
  );
}

function SignOutButton() {
  if (isDesktopApp) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => {
        void staffSignOut().finally(() => window.location.assign("/login"));
      }}
    >
      Sign out
    </Button>
  );
}

function WebAccountChip({ session }: { session: { id: string; username: string; role: WebRole } | null }) {
  if (!session) return null;
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{session.username}</p>
      <p className="text-[11px] text-muted-foreground">{session.role === "admin" ? "Full access" : "Billing and products"}</p>
      <OwnPassword id={session.id} />
      <button
        type="button"
        className="text-sm underline-offset-4 opacity-70 hover:underline"
        onClick={() => {
          void staffSignOut().finally(() => window.location.assign("/login"));
        }}
      >
        Sign out
      </button>
    </div>
  );
}

function OwnPassword({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="block text-sm font-medium text-primary">
          Change password
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            void staffSetPassword({ data: { id, password, currentPassword } })
              .then((result) => {
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Password changed");
                setCurrentPassword("");
                setPassword("");
                setOpen(false);
              })
              .finally(() => setBusy(false));
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="own-current">Current password</Label>
            <Input id="own-current" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="own-next">New password</Label>
            <Input id="own-next" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : "Save password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PhoneBar({ role }: { role: WebRole | "desktop" }) {
  const [more, setMore] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pinned = role === "billing" ? ["/", "/invoices", "/products", "/parties"] : ["/", "/invoices", "/purchases", "/products"];
  const primary = pinned
    .map((to) => NAV.find((item) => item.to === to))
    .filter((item): item is (typeof NAV)[number] => !!item && visibleNav(role).some((row) => row.to === item.to));
  const moreActive = !primary.some((item) => (item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(`${item.to}/`)));
  return (
    <Sheet open={more} onOpenChange={setMore}>
      <nav className="no-print fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-card/95 px-1 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden">
        {primary.map((item) => (
          <MobileTab key={item.to} item={item} pathname={pathname} />
        ))}
        <button
          type="button"
          className={cn("flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium", more || moreActive ? "text-primary" : "text-muted-foreground")}
          onClick={() => setMore(true)}
        >
          <MoreHorizontal className="size-4" />
          More
        </button>
      </nav>
      <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>More</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <NavLinks role={role} onNavigate={() => setMore(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MobileTab({
  item,
  pathname,
}: {
  item: (typeof NAV)[number];
  pathname: string;
}) {
  const routerPath = useRouterState({ select: (s) => s.location.pathname });
  const path = routerPath || pathname;
  const active = item.to === "/" ? path === "/" : path === item.to || path.startsWith(`${item.to}/`);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="size-4" />
      {item.label.replace("GST reports", "Reports")}
    </Link>
  );
}
