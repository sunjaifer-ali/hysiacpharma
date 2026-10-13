#!/usr/bin/env node
import { cpSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import packager from "@electron/packager";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const electronVersion = require("electron/package.json").version;

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root, stdio: "inherit" });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`)),
    );
  });
}

function pngToIco(pngPath, icoPath) {
  const png = readFileSync(pngPath);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = 180;
  entry[1] = 180;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  writeFileSync(icoPath, Buffer.concat([header, entry, png]));
}

mkdirSync(join(root, "desktop"), { recursive: true });
cpSync(join(root, "public/__grok/icon-180.png"), join(root, "desktop/icon.png"));
pngToIco(join(root, "desktop/icon.png"), join(root, "desktop/icon.ico"));

await run("npx", ["vite", "build", "--config", "vite.desktop.config.ts"]);

const out = await packager({
  dir: join(root, "desktop"),
  name: "Hysiac GST",
  platform: "win32",
  arch: "x64",
  out: join(root, "release"),
  overwrite: true,
  asar: true,
  appVersion: "1.0.0",
  appCopyright: "Hysiac Pharmaceuticals Pvt Ltd",
  electronVersion,
  prune: false,
  icon: join(root, "desktop/icon.ico"),
  ignore: [/node_modules/, /\.map$/],
  win32metadata: {
    CompanyName: "Hysiac Pharmaceuticals Pvt Ltd",
    FileDescription: "Hysiac GST billing",
    ProductName: "Hysiac GST",
    InternalName: "HysiacGST",
    OriginalFilename: "Hysiac GST.exe",
  },
});

const appDir = out[0];
const portableDir = join(root, "release", "Hysiac GST");
rmSync(portableDir, { recursive: true, force: true });
renameSync(appDir, portableDir);

writeFileSync(
  join(portableDir, "HOW-TO-OPEN.txt"),
  `Hysiac GST

Double-click "Hysiac GST.exe" to open.

First launch: if Windows SmartScreen appears, click More info → Run anyway.

Keep this whole folder together — the .exe needs the files beside it.
Your books are stored in "Hysiac-GST-data" next to the .exe (created on first run).
Copy that data folder along with the app if you move it to a USB drive or another PC.

Settings → Export JSON also saves a backup file.
`,
);

const zipPath = join(root, "artifacts", "Hysiac-GST-Windows.zip");
mkdirSync(join(root, "artifacts"), { recursive: true });
rmSync(zipPath, { force: true });
await run("python3", [
  "-c",
  "import shutil, sys; shutil.make_archive(sys.argv[1], 'zip', sys.argv[2], sys.argv[3])",
  zipPath.replace(/\.zip$/, ""),
  join(root, "release"),
  "Hysiac GST",
]);

console.log("[desktop] packed", portableDir);
console.log("[desktop] zip", zipPath);
