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
  Package,
  Plus,
  ScrollText,
  Settings,
  Undo2,
  UserRoundPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { canOpen, type WebRole } from "@/lib/web-users";
import { staffSignOut } from "@/lib/staff-accounts";
import { useStaffSession } from "@/lib/staff-session";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { HysiacMark } from "@/components/logo";
import { BackupEngine } from "@/components/backup-engine";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { isDesktopApp } from "@/lib/desktop";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/quotes", label: "Quotations", icon: FileSignature },
  { to: "/returns", label: "Returns", icon: Undo2 },
  { to: "/credits", label: "Credit notes", icon: ScrollText },
  { to: "/purchases", label: "Purchases", icon: ClipboardList },
  { to: "/payments", label: "Payments", icon: Wallet },
  { to: "/products", label: "Products", icon: Package },
  { to: "/parties", label: "Parties", icon: Users },
  { to: "/reports", label: "Reports", icon: BookOpen },
  { to: "/accounts", label: "Accounts", icon: Landmark },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/users", label: "Users", icon: UserRoundPlus },
  { to: "/bin", label: "Recycle bin", icon: ArchiveRestore },
] as const;

function NavLinks({ onNavigate, role }: { onNavigate?: () => void; role: WebRole | "desktop" }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV.filter((item) => {
    if (item.to === "/users" && role === "desktop") return false;
    return role === "desktop" || role === "admin" || canOpen(role, item.to);
  });
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active =
          item.to === "/"
            ? pathname === "/"
            : pathname === item.to || pathname.startsWith(`${item.to}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors min-h-11",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const staff = useStaffSession();
  const webSession = staff.session;
  const role: WebRole | "desktop" = isDesktopApp ? "desktop" : (webSession?.role ?? "billing");
  const [ready, setReady] = useState(isDesktopApp);

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
        <div className="mb-4 flex shrink-0 items-center gap-3 px-1">
          <span className="text-primary">
            <HysiacMark />
          </span>
          <div className="min-w-0">
            <p className="font-display text-base leading-tight text-foreground">Hysiac</p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">GST billing</p>
          </div>
        </div>
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
                  <span className="text-primary">
                    <HysiacMark className="size-8" />
                  </span>
                  Hysiac GST
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
          <div className="flex items-center gap-2">
            <HysiacMark className="size-8" />
            <div>
              <p className="font-display text-base leading-none">Hysiac</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">GST billing</p>
            </div>
          </div>
        </div>
        <Button asChild size="sm">
          <Link to="/invoices/new">
            <Plus className="size-4" />
            New
          </Link>
        </Button>
      </header>

      <div className="app-shell-main overflow-x-clip md:pl-60">
        <div className="no-print sticky top-0 z-20 hidden items-center justify-end gap-2 border-b border-border bg-background/85 px-6 py-3 backdrop-blur-md md:flex">
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
        </div>
        <div className={cn("app-shell-pad mx-auto w-full px-4 pb-24 pt-6 sm:px-6 md:pb-10 md:pt-8", wide ? "max-w-[1400px]" : "max-w-6xl")}>{children}</div>
      </div>

      <nav className="no-print fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-card/95 px-1 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden">
        {NAV.filter((item) => {
          if (role === "billing") return item.to === "/" || item.to === "/invoices" || item.to === "/products" || item.to === "/parties" || item.to === "/returns";
          return item.to === "/" || item.to === "/invoices" || item.to === "/returns" || item.to === "/purchases" || item.to === "/products";
        }).map((item) => {
          const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
          return <MobileTab key={item.to} item={item} pathname={pathname} />;
        })}
      </nav>
      <BackupEngine />
    </div>
  );
}

function WebAccountChip({ session }: { session: { username: string; role: WebRole } | null }) {
  if (!session) return null;
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{session.username}</p>
      <p className="text-[11px] text-muted-foreground">{session.role === "admin" ? "Full access" : "Billing and products"}</p>
      {session.role === "admin" ? (
        <Link to="/users" className="block text-sm font-medium text-primary">
          Change password
        </Link>
      ) : null}
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
