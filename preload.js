const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openMedia: () => ipcRenderer.invoke('media:open'),
  saveProject: (data) => ipcRenderer.invoke('project:save', data),
  openProject: () => ipcRenderer.invoke('project:open'),
  pickExportPath: (name) => ipcRenderer.invoke('export:pickPath', name),
  exportVideo: (project, output) => ipcRenderer.invoke('export:video', project, output),
  getPaths: () => ipcRenderer.invoke('app:paths'),
  assetPath: (rel) => ipcRenderer.invoke('app:asset', rel),
  onProgress: (cb) => ipcRenderer.on('export:progress', (_, p) => cb(p)),
});
