const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getProjects:      ()        => ipcRenderer.invoke('get-projects'),
  saveProject:      (p)       => ipcRenderer.invoke('save-project', p),
  deleteProject:    (id)      => ipcRenderer.invoke('delete-project', id),
  startProject:     (p)       => ipcRenderer.invoke('start-project', p),
  stopProject:      (id)      => ipcRenderer.invoke('stop-project', id),
  getProcessStatus: (id)      => ipcRenderer.invoke('get-process-status', id),
  browseFolder:     ()        => ipcRenderer.invoke('browse-folder'),
  browseFile:       (filters) => ipcRenderer.invoke('browse-file', filters),
  onProcessLog:    (cb) => ipcRenderer.on('process-log',    (_, d) => cb(d)),
  onProcessStatus: (cb) => ipcRenderer.on('process-status', (_, d) => cb(d)),
  removeAllListeners: (ch) => ipcRenderer.removeAllListeners(ch),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close:    () => ipcRenderer.send('window-close'),
});
