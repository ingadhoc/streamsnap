const { app, session } = require('electron')
const environment = require('./src/config/environment')

// Enable PipeWire screen-capture support on Linux/Wayland before the app is ready.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer')
}

const WindowManager = require('./src/services/WindowManager')
const RecordingManager = require('./src/services/RecordingManager')
const DriveService = require('./src/services/DriveService')
const YouTubeService = require('./src/services/YouTubeService')
const StorageService = require('./src/services/StorageService')
const RecoveryManager = require('./src/utils/recovery-manager')

const RecordingHandlers = require('./src/handlers/RecordingHandlers')
const WindowHandlers = require('./src/handlers/WindowHandlers')
const DriveHandlers = require('./src/handlers/DriveHandlers')
const YouTubeHandlers = require('./src/handlers/YouTubeHandlers')
const StorageHandlers = require('./src/handlers/StorageHandlers')

class StreamSnapApp {
  constructor() {
    this.windowManager = new WindowManager()
    this.recordingManager = new RecordingManager()
    this.driveService = new DriveService()
    this.youtubeService = new YouTubeService()
    this.storageService = new StorageService()
    this.isInitialized = false

    this.setupAppEventListeners()
    this.setupHandlers()
    this.setupRecordingEvents()
  }

  setupAppEventListeners() {
    app.whenReady().then(() => this.handleAppReady())
    app.on('window-all-closed', () => this.handleAllWindowsClosed())
    app.on('activate', () => this.handleAppActivate())

    app.on('web-contents-created', (event, contents) => {
      contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault()
      })
    })
  }

  setupHandlers() {
    new RecordingHandlers(this)
    new WindowHandlers(this)
    new DriveHandlers(this)
    new YouTubeHandlers(this)
    new StorageHandlers(this)
  }

  setupRecordingEvents() {
    this.recordingManager.emitShortcutEvent = action => {
      const mainWindow = this.windowManager.getWindow('main')
      const floatingWindow = this.windowManager.getWindow('floating')

      if (this.recordingManager.isRecording) {
        if (mainWindow) {
          mainWindow.webContents.send(`shortcut-${action}`)
        }
        if (floatingWindow) {
          floatingWindow.webContents.send(`shortcut-${action}`)
        }
      }
    }
  }

  async getSettings() {
    try {
      const mainWindow = this.windowManager.getWindow('main')
      if (mainWindow) {
        const settings = await mainWindow.webContents.executeJavaScript(
          `window.screenRecorder?.settingsManager?.settings || {}`
        )
        return settings
      }
    } catch (error) {}
    return {}
  }

  broadcastToWindows(event, data = null) {
    try {
    } catch (e) {}
    Object.values(this.windowManager.windows).forEach(window => {
      if (window && !window.isDestroyed()) {
        try {
          window.webContents.send(event, data)
        } catch (e) {}
      }
    })
  }

  async handleAppReady() {
    try {
      RecoveryManager.cleanupOldVideos().catch(() => {})

      // On Linux, getDisplayMedia() requires a handler in Electron 32+;
      // without it the renderer receives NotSupportedError.
      // Using useSystemPicker delegates the entire screen/window/tab picker to
      // the OS (XDG portal on Wayland, native picker on X11) in a single dialog,
      // avoiding the double-portal loop that the previous getSources() approach caused.
      if (process.platform === 'linux') {
        session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
          callback({ useSystemPicker: true })
        }, { useSystemPicker: true })
      }

      await this.windowManager.createMainWindow()
      this.isInitialized = true

      try {
        let isAuth = false
        try {
          if (this.driveService && typeof this.driveService.ensureValidAccessToken === 'function') {
            isAuth = await this.driveService.ensureValidAccessToken()
          } else {
            isAuth = !!this.driveService.isAuthenticated && this.driveService.isAuthenticated()
          }
        } catch (e) {
          isAuth = !!(this.driveService && this.driveService.isAuthenticated && this.driveService.isAuthenticated())
        }

        this.broadcastToWindows('drive-auth-updated', {
          authenticated: !!isAuth,
          accessToken: isAuth ? this.driveService.accessToken || null : null
        })
      } catch (e) {}
    } catch (error) {
      app.quit()
    }
  }

  handleAllWindowsClosed() {
    if (process.platform !== 'darwin') {
      this.cleanup()
      app.quit()
    }
  }

  async handleAppActivate() {
    if (!this.windowManager.hasOpenWindows()) {
      await this.windowManager.createMainWindow()
    }
  }

  cleanup() {
    try {
      const { globalShortcut } = require('electron')
      globalShortcut.unregisterAll()
      this.recordingManager.cleanup()
      this.windowManager.closeAllWindows()
      this.driveService.signOut()
    } catch (error) {}
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      environment: environment.isProduction ? 'production' : 'development',
      recording: this.recordingManager.getRecordingState(),
      windows: {
        main: !!this.windowManager.getWindow('main'),
        floating: !!this.windowManager.getWindow('floating'),
        save: !!this.windowManager.getWindow('save'),
        sourceSelector: !!this.windowManager.getWindow('sourceSelector')
      },
      drive: {
        authenticated: this.driveService.isAuthenticated()
      }
    }
  }
}

const streamSnapApp = new StreamSnapApp()

module.exports = StreamSnapApp

process.on('uncaughtException', error => {
  if (environment.isProduction) {
    streamSnapApp.cleanup()
    app.quit()
  }
})

process.on('unhandledRejection', (reason, promise) => {
  if (environment.isProduction) {
    streamSnapApp.cleanup()
    app.quit()
  }
})
