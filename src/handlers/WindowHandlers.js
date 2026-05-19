const { ipcMain, screen, app: electronApp } = require('electron')

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

    ipcMain.handle('start-floating-drag', () => {
      this.app.windowManager.startFloatingDrag()
      return { success: true }
    })

    ipcMain.on('stop-floating-drag', () => {
      this.app.windowManager.stopFloatingDrag()
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

    ipcMain.handle('open-video-editor', async () => {
      try {
        const videoPath = this.app.recordingManager.getRecordedVideoPath()
        const duration = this.app.recordingManager.getRecordedVideoDuration()

        const win = await this.app.windowManager.createVideoEditorWindow({
          tempVideoPath: videoPath || null,
          duration: duration || null
        })

        if (!win) {
          return { success: false, error: 'Window not created' }
        }

        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('close-video-editor', () => {
      this.app.windowManager.closeWindow('videoEditor')
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

    ipcMain.handle('set-main-window-height', (_event, height) => {
      try {
        const win = this.app.windowManager.getWindow('main')
        if (win && !win.isDestroyed()) {
          const [w] = win.getSize()
          win.setSize(w, Math.max(660, Math.min(1200, height)))
        }
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

    ipcMain.handle('set-launch-on-startup', (event, enabled) => {
      try {
        if (process.platform === 'linux') {
          const os = require('os')
          const fs = require('fs')
          const path = require('path')
          const autostartDir = path.join(os.homedir(), '.config', 'autostart')
          const desktopFile = path.join(autostartDir, 'streamsnap.desktop')
          if (enabled) {
            fs.mkdirSync(autostartDir, { recursive: true })
            fs.writeFileSync(desktopFile, [
              '[Desktop Entry]',
              'Type=Application',
              'Name=StreamSnap',
              'Exec=/opt/StreamSnap/streamsnap --no-sandbox --hidden',
              'Hidden=false',
              'NoDisplay=false',
              'X-GNOME-Autostart-enabled=true',
              'Comment=Start StreamSnap on login'
            ].join('\n') + '\n')
          } else {
            if (fs.existsSync(desktopFile)) fs.unlinkSync(desktopFile)
          }
        } else if (process.platform === 'darwin') {
          electronApp.setLoginItemSettings({
            openAtLogin: enabled,
            openAsHidden: true,
            args: ['--hidden']
          })
        } else {
          electronApp.setLoginItemSettings({
            openAtLogin: enabled
          })
        }
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('get-launch-on-startup', () => {
      try {
        if (process.platform === 'linux') {
          const os = require('os')
          const fs = require('fs')
          const path = require('path')
          const desktopFile = path.join(os.homedir(), '.config', 'autostart', 'streamsnap.desktop')
          return { enabled: fs.existsSync(desktopFile) }
        }
        return { enabled: electronApp.getLoginItemSettings().openAtLogin }
      } catch (e) {
        return { enabled: false }
      }
    })

    ipcMain.on('drive-accounts-changed', () => {
      const mainWindow = this.app.windowManager.getWindow('main')
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('drive-accounts-changed')
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
