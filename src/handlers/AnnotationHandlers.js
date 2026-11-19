const { ipcMain } = require('electron')

class AnnotationHandlers {
  constructor(app) {
    this.app = app
    this.setupHandlers()
  }

  setupHandlers() {
    ipcMain.handle('annotation:toggle', async () => {
      try {
        const overlay = this.app.windowManager.getWindow('annotationOverlay')
        if (overlay && !overlay.isDestroyed()) {
          this.app.windowManager.closeAnnotationWindows()
          return { success: true, open: false }
        }

        const targetDisplay = this.app.recordingManager.getTargetDisplay()
        await this.app.windowManager.createAnnotationOverlayWindow(targetDisplay)
        await this.app.windowManager.createAnnotationToolbarWindow(targetDisplay)
        return { success: true, open: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('annotation:close', () => {
      this.app.windowManager.closeAnnotationWindows()
      this.sendToWindow('floating', 'annotation:closed')
      return { success: true }
    })

    ipcMain.handle('annotation:set-tool', (event, tool) => {
      try {
        this.app.windowManager.setAnnotationInteractive(tool !== 'cursor')
        this.sendToWindow('annotationOverlay', 'annotation:tool-changed', tool)
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('annotation:set-color', (event, color) => {
      this.sendToWindow('annotationOverlay', 'annotation:color-changed', color)
      return { success: true }
    })

    ipcMain.handle('annotation:undo', () => {
      this.sendToWindow('annotationOverlay', 'annotation:undo')
      return { success: true }
    })

    ipcMain.handle('annotation:clear', () => {
      this.sendToWindow('annotationOverlay', 'annotation:clear')
      return { success: true }
    })
  }

  sendToWindow(type, channel, payload) {
    const win = this.app.windowManager.getWindow(type)
    if (win && !win.isDestroyed()) {
      try {
        win.webContents.send(channel, payload)
      } catch (e) {}
    }
  }
}

module.exports = AnnotationHandlers
