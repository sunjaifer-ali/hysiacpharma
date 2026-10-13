const { app, BrowserWindow, shell, Menu } = require("electron");
const fs = require("fs");
const path = require("path");

app.setName("Hysiac GST");

try {
  app.setAppUserModelId("com.hysiac.gst");
} catch {
  /* older Windows */
}

if (app.isPackaged) {
  const portable = path.join(path.dirname(app.getPath("exe")), "Hysiac-GST-data");
  fs.mkdirSync(portable, { recursive: true });
  app.setPath("userData", portable);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: "Hysiac GST",
    backgroundColor: "#F3F0E8",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "renderer", "desktop.html"));
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("file:")) return;
    event.preventDefault();
    shell.openExternal(url);
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
