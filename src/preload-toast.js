const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('toastAPI', {
  click: (toastId) => ipcRenderer.send('toast-clicked', toastId)
})
