const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("poeValueApp", {
  readClipboard: () => ipcRenderer.invoke("read-clipboard"),
  analyzeItem: (payload) => ipcRenderer.invoke("analyze-item", payload),
});
