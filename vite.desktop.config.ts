import path from "node:path";
import { rmSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.resolve(__dirname);
const stubDir = path.resolve(root, "src/lib/desktop-stubs");
const stub = (name: string) => path.resolve(stubDir, name);

const STUB_FILES: Record<string, string> = {
  "src/lib/ensure-admin.ts": "ensure-admin.ts",
  "src/lib/drive-backup.ts": "drive-backup.ts",
  "src/lib/auth/verify.server.ts": "verify.server.ts",
  "src/lib/auth/server.ts": "auth-server.ts",
  "src/lib/db.ts": "db.ts",
  "src/lib/app-data/readiness.ts": "readiness.ts",
  "src/lib/app-data/client.server.ts": "client.server.ts",
};

function desktopStubs(): Plugin {
  const byAbs = new Map<string, string>();
  for (const [rel, name] of Object.entries(STUB_FILES)) {
    byAbs.set(path.resolve(root, rel), stub(name));
  }

  function match(id: string, importer?: string): string | null {
    if (id === "@tanstack/react-start" || id.startsWith("@tanstack/react-start/")) {
      return stub("react-start.ts");
    }
    let abs = id;
    if (id.startsWith("@/")) {
      abs = path.resolve(root, "src", id.slice(2));
    } else if (importer && (id.startsWith(".") || id.startsWith("/"))) {
      abs = path.resolve(path.dirname(importer), id);
    } else if (path.isAbsolute(id)) {
      abs = id;
    } else {
      return null;
    }
    abs = abs.split("?")[0] ?? abs;
    const candidates = [abs, abs + ".ts", abs + ".tsx", abs.replace(/\.js$/, ".ts")];
    for (const c of candidates) {
      const hit = byAbs.get(c);
      if (hit) return hit;
    }
    return null;
  }

  return {
    name: "hysiac-desktop-stubs",
    enforce: "pre",
    resolveId(id, importer) {
      return match(id, importer);
    },
  };
}

export default defineConfig({
  plugins: [
    desktopStubs(),
    tailwindcss(),
    viteReact(),
    {
      name: "omit-web-downloads",
      closeBundle() {
        rmSync(path.resolve(root, "desktop/renderer/downloads"), { recursive: true, force: true });
      },
    },
  ],
  base: "./",
  publicDir: "public",
  define: {
    "import.meta.env.VITE_DESKTOP": JSON.stringify("true"),
    "import.meta.env.VITE_AUTH_ENABLED": JSON.stringify("false"),
  },
  resolve: {
    alias: [{ find: "@", replacement: path.resolve(root, "src") }],
  },
  build: {
    outDir: "desktop/renderer",
    emptyOutDir: true,
    sourcemap: false,
    target: "chrome136",
    rollupOptions: {
      input: path.resolve(root, "desktop.html"),
    },
  },
});
