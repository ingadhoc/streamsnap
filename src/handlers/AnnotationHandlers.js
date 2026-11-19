const { ipcMain, screen } = require('electron')

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

        const targetDisplay = this.getTargetDisplay()
        await this.app.windowManager.createAnnotationOverlayWindow(targetDisplay)
        await this.app.windowManager.createAnnotationToolbarWindow(targetDisplay)
        return { success: true, open: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('annotation:close', () => {
      this.app.windowManager.closeAnnotationWindows()
      const floating = this.app.windowManager.getWindow('floating')
      if (floating && !floating.isDestroyed()) {
        floating.webContents.send('annotation:closed')
      }
      return { success: true }
    })

    ipcMain.handle('annotation:set-tool', (event, tool) => {
      try {
        this.app.windowManager.setAnnotationInteractive(tool !== 'cursor')
        const overlay = this.app.windowManager.getWindow('annotationOverlay')
        if (overlay && !overlay.isDestroyed()) {
          overlay.webContents.send('annotation:tool-changed', tool)
        }
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('annotation:set-color', (event, color) => {
      const overlay = this.app.windowManager.getWindow('annotationOverlay')
      if (overlay && !overlay.isDestroyed()) {
        overlay.webContents.send('annotation:color-changed', color)
      }
      return { success: true }
    })

    ipcMain.handle('annotation:undo', () => {
      const overlay = this.app.windowManager.getWindow('annotationOverlay')
      if (overlay && !overlay.isDestroyed()) {
        overlay.webContents.send('annotation:undo')
      }
      return { success: true }
    })

    ipcMain.handle('annotation:clear', () => {
      const overlay = this.app.windowManager.getWindow('annotationOverlay')
      if (overlay && !overlay.isDestroyed()) {
        overlay.webContents.send('annotation:clear')
      }
      return { success: true }
    })
  }

  getTargetDisplay() {
    let targetDisplay = screen.getPrimaryDisplay()
    try {
      const sel = this.app.recordingManager.selectedSource
      const displays = screen.getAllDisplays()

      if (sel && sel.display_id != null) {
        const matchById = displays.find(display => String(display.id) === String(sel.display_id))
        if (matchById) return matchById
      }

      if (sel && sel.display_index != null && displays[sel.display_index]) {
        return displays[sel.display_index]
      }

      // Window sources never carry display_id/display_index (see RecordingHandlers.getTargetDisplay
      // for details) — fall back to the display nearest the cursor instead of always the primary one.
      if (sel && typeof sel.id === 'string' && !sel.id.startsWith('screen:')) {
        return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
      }
    } catch (e) {}
    return targetDisplay
  }
}

module.exports = AnnotationHandlers
