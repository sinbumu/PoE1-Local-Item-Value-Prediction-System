const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("poeValueApp", {
  getAppConfig: () => ipcRenderer.invoke("get-app-config"),
  runEnvironmentCheck: () => ipcRenderer.invoke("run-environment-check"),
  readClipboard: () => ipcRenderer.invoke("read-clipboard"),
  readDemoSample: (sampleId) => ipcRenderer.invoke("read-demo-sample", sampleId),
  analyzeItem: (payload) => ipcRenderer.invoke("analyze-item", payload),
  showFloatingResult: (result) => ipcRenderer.invoke("show-floating-result", result),
  hideFloatingResult: () => ipcRenderer.invoke("hide-floating-result"),
  getFloatingPreferences: () => ipcRenderer.invoke("get-floating-preferences"),
  setFloatingPreferences: (preferences) => ipcRenderer.invoke("set-floating-preferences", preferences),
  resetFloatingPosition: () => ipcRenderer.invoke("reset-floating-position"),
  onFloatingPreferences: (callback) => {
    const listener = (_event, preferences) => callback(preferences);
    ipcRenderer.on("floating-preferences", listener);
    return () => ipcRenderer.removeListener("floating-preferences", listener);
  },
  onFloatingResult: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on("floating-result", listener);
    return () => ipcRenderer.removeListener("floating-result", listener);
  },
});
