const { ipcMain, screen } = require('electron')

class WindowHandlers {
  constructor(app) {
    this.app = app
    this.setupHandlers()
  }

  setupHandlers() {
    ipcMain.handle('open-source-selector', async () => {
      try {
        const now = Date.now()
        try {
          if (this.app._lastSourceSelectorOpenAt && now - this.app._lastSourceSelectorOpenAt < 400) {
            return { success: true, debounced: true }
          }
        } catch (e) {}
        this.app._lastSourceSelectorOpenAt = now

        const win = await this.app.windowManager.createSourceSelectorWindow()
        if (!win) {
          return { success: false, error: 'Window not created' }
        }
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('close-source-selector', () => {
      this.app.windowManager.closeWindow('sourceSelector')
      return { success: true }
    })

    ipcMain.handle('source-selected', (event, source) => {
      try {
        this.app.recordingManager.setSelectedSource(source)
        this.app.windowManager.closeWindow('sourceSelector')

        const mainWindow = this.app.windowManager.getWindow('main')
        if (mainWindow) {
          mainWindow.webContents.executeJavaScript(`
            if (window.recorderAPI && window.recorderAPI.startWithSource) {
              window.recorderAPI.startWithSource(${JSON.stringify(source)})
            }
          `)

          setTimeout(() => {
            this.app.windowManager.minimizeMainWindow()
          }, 1000)
        }

        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('show-countdown', async (event, options = {}) => {
      try {
        const duration = options?.duration || 5
        const targetDisplay = this.getTargetDisplay()

        const countdownWindow = await this.app.windowManager.createCountdownWindow({ display: targetDisplay })

        if (countdownWindow) {
          countdownWindow.show()

          setTimeout(() => {
            if (countdownWindow && !countdownWindow.isDestroyed()) {
              countdownWindow.webContents.send('start-countdown', duration)
            }
          }, 300)
        }

        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('close-countdown', () => {
      this.app.windowManager.closeWindow('countdown')
      return { success: true }
    })

    ipcMain.handle('countdown-complete', () => {
      this.app.windowManager.closeWindow('countdown')
      return { success: true }
    })

    ipcMain.handle('close-floating', () => {
      this.app.windowManager.closeWindow('floating')
      return { success: true }
    })

    ipcMain.handle('move-floating-window', (event, deltaX, deltaY) => {
      this.app.windowManager.moveFloatingWindow(deltaX, deltaY)
      return { success: true }
    })

    ipcMain.handle('resize-floating-window', (event, width, height) => {
      this.app.windowManager.resizeFloatingWindow(width, height)
      return { success: true }
    })

    ipcMain.handle('minimize-main', () => {
      this.app.windowManager.minimizeMainWindow()
      return { success: true }
    })

    ipcMain.handle('close-save-window', () => {
      this.app.recordingManager.clearRecordedVideoData()
      this.app.windowManager.closeWindow('save')
      return { success: true }
    })

    ipcMain.handle('show-main-window', () => {
      try {
        this.app.windowManager.showMainWindow()
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('open-youtube-accounts', async () => {
      try {
        const win = await this.app.windowManager.createYouTubeAccountsWindow()
        if (!win) {
          return { success: false, error: 'Window not created' }
        }
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
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
        targetDisplay = displays[sel.display_index]
      }
    } catch (e) {}
    return targetDisplay
  }
}

module.exports = WindowHandlers
