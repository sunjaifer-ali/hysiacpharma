import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Toaster } from "sonner";
import { AppLockGate } from "@/components/app-lock";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { isDesktopApp } from "@/lib/desktop";
import appCss from "../styles.css?url";

const APP_NAME = "Hysiac GST";

const fetchSessionUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const u = await getSessionUser();
  return u ? { id: u.id, email: u.email } : null;
});

export const Route = createRootRoute({
  beforeLoad: async () => {
    if (isDesktopApp) return { sessionUser: { id: "desktop-user", email: "admin@hysiac.local" } };
    try {
      return { sessionUser: await fetchSessionUser() };
    } catch {
      return { sessionUser: null };
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#1B5C4A" },
      {
        name: "description",
        content: "GST billing for Hysiac Pharmaceuticals Pvt Ltd — tax invoices, HSN, CGST/SGST/IGST and GSTR reports.",
      },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Outfit:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  if (isDesktopApp) {
    return (
      <>
        <AuthProvider>
          <AppLockGate>
            <Outlet />
          </AppLockGate>
          <Toaster position="bottom-right" richColors closeButton />
        </AuthProvider>
      </>
    );
  }
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
          <Toaster position="bottom-right" richColors closeButton />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
