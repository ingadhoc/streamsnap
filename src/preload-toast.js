const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('toastAPI', {
  click: (toastId) => ipcRenderer.send('toast-clicked', toastId),
  hover: (toastId, hovering) => ipcRenderer.send('toast-hover', toastId, hovering)
})
