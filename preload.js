const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openMedia: () => ipcRenderer.invoke('media:open'),
  saveProject: (data) => ipcRenderer.invoke('project:save', data),
  openProject: () => ipcRenderer.invoke('project:open'),
  pickExportPath: (name) => ipcRenderer.invoke('export:pickPath', name),
  exportVideo: (project, output) => ipcRenderer.invoke('export:video', project, output),
  getPaths: () => ipcRenderer.invoke('app:paths'),
  assetPath: (rel) => ipcRenderer.invoke('app:asset', rel),
  saveFrame: (dataUrl) => ipcRenderer.invoke('frame:save', dataUrl),
  grabFrame: (src, time) => ipcRenderer.invoke('frame:grab', src, time),
  reverseClip: (src, start, duration, hasAudio) => ipcRenderer.invoke('clip:reverse', src, start, duration, hasAudio),
  segmentClip: (opts) => ipcRenderer.invoke('clip:segment', opts),
  onProgress: (cb) => ipcRenderer.on('export:progress', (_, p) => cb(p)),
  onSegmentProgress: (cb) => ipcRenderer.on('segment:progress', (_, p) => cb(p)),
});
