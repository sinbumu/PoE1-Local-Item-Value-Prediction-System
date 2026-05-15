const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("poeValueApp", {
  getAppConfig: () => ipcRenderer.invoke("get-app-config"),
  runEnvironmentCheck: () => ipcRenderer.invoke("run-environment-check"),
  readClipboard: () => ipcRenderer.invoke("read-clipboard"),
  readDemoSample: (sampleId) => ipcRenderer.invoke("read-demo-sample", sampleId),
  analyzeItem: (payload) => ipcRenderer.invoke("analyze-item", payload),
});
