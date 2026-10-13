const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("hysiacDesktop", true);
