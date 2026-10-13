import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isDesktopApp } from "@/lib/desktop";

export function InstallAppsCard() {
  if (isDesktopApp) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Install on this device</CardTitle>
        <CardDescription>
          Same Hysiac GST books app. Each device keeps its own copy — use Export JSON to move invoices between PC, Android and iPhone.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href="/downloads/Hysiac-GST-Windows.zip" download>
              Windows .exe
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/downloads/Hysiac-GST.apk" download="Hysiac-GST.apk" type="application/vnd.android.package-archive">
              Android .apk
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/?install=1&platform=ios">iPhone app</a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Windows: unzip and open Hysiac-GST.exe. Android: the file must stay named Hysiac-GST.apk — open it to install, do not unzip. iPhone: Apple does not allow a downloaded app file — the button opens Add to Home Screen in Safari.
        </p>
      </CardContent>
    </Card>
  );
}

export function InstallAppsLinks() {
  return (
    <div className="mt-5 grid gap-2 text-center text-sm">
      <p className="text-muted-foreground">Install the same app</p>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <a
          href="/downloads/Hysiac-GST-Windows.zip"
          download
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Windows
        </a>
        <span className="text-border">·</span>
        <a
          href="/downloads/Hysiac-GST.apk"
          download="Hysiac-GST.apk"
          type="application/vnd.android.package-archive"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Android
        </a>
        <span className="text-border">·</span>
        <a href="/?install=1&platform=ios" className="font-medium text-primary underline-offset-4 hover:underline">
          iPhone
        </a>
      </div>
    </div>
  );
}
