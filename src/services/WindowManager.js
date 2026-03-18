const { BrowserWindow, screen } = require('electron')
const path = require('path')
const environment = require('../config/environment')
const { WINDOW_CONFIG } = require('../config/constants')

class WindowManager {
  constructor() {
    this.windows = {
      main: null,
      floating: null,
      countdown: null,
      save: null,
      sourceSelector: null,
      webcam: null,
      driveAccounts: null,
      youtubeAccounts: null
    }

    this.preloadPath = path.join(__dirname, '../preload.js')
    this.driveUploadResult = null
  }

  async createCountdownWindow(options = {}) {
    try {
      if (this.windows.countdown && !this.windows.countdown.isDestroyed()) {
        this.windows.countdown.close()
        this.windows.countdown = null
      }

      const targetDisplay = options?.display || screen.getPrimaryDisplay()
      const workArea = targetDisplay.workArea || targetDisplay.bounds || {}
      const originX = typeof workArea.x === 'number' ? workArea.x : 0
      const originY = typeof workArea.y === 'number' ? workArea.y : 0
      const screenW = workArea.width || targetDisplay.size?.width || targetDisplay.bounds?.width || screen.getPrimaryDisplay().workAreaSize.width
      const screenH = workArea.height || targetDisplay.size?.height || targetDisplay.bounds?.height || screen.getPrimaryDisplay().workAreaSize.height

      const winWidth = WINDOW_CONFIG.countdown.width
      const winHeight = WINDOW_CONFIG.countdown.height

      const winX = originX + Math.floor((screenW - winWidth) / 2)
      const winY = originY + Math.floor((screenH - winHeight) / 2)

      this.windows.countdown = new BrowserWindow({
        width: winWidth,
        height: winHeight,
        x: winX,
        y: winY,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        transparent: true,
        backgroundColor: '#00000000',
        hasShadow: false,
        focusable: false,
        acceptFirstMouse: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: this.preloadPath,
          enableRemoteModule: false,
          sandbox: false,
          backgroundThrottling: false
        },
        show: false
      })

      await this.windows.countdown.loadFile('src/windows/countdown.html')

      try {
        this.windows.countdown.setAlwaysOnTop(true, 'screen-saver')
      } catch (e) {}
      try {
        this.windows.countdown.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      } catch (e) {}
      try {
        this.windows.countdown.setHasShadow(false)
      } catch (e) {}
      try {
        this.windows.countdown.setIgnoreMouseEvents(true)
      } catch (e) {}

      this.windows.countdown.on('closed', () => {
        this.windows.countdown = null
      })

      return this.windows.countdown
    } catch (error) {
      throw error
    }
  }

  async createMainWindow() {
    try {
      this.windows.main = new BrowserWindow({
        ...WINDOW_CONFIG.main,
        title: environment.app.name,
        icon: this.getAppIcon(),
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: this.preloadPath,
          enableRemoteModule: false,
          sandbox: false
        },
        show: false
      })

      await this.windows.main.loadFile('src/windows/main.html')

      this.windows.main.webContents.once('dom-ready', () => {
        this.windows.main.show()
      })

      this.windows.main.once('ready-to-show', () => {
        if (!this.windows.main.isVisible()) {
          this.windows.main.show()
        }
      })

      this.windows.main.show()

      this.windows.main.on('closed', () => {
        this.windows.main = null
      })

      return this.windows.main
    } catch (error) {
      throw error
    }
  }

  async createFloatingWindow(settings = {}, options = {}) {
    try {
      const targetDisplay = options?.display || screen.getPrimaryDisplay()
      const workArea = targetDisplay.workArea || targetDisplay.bounds || {}
      const originX = typeof workArea.x === 'number' ? workArea.x : 0
      const originY = typeof workArea.y === 'number' ? workArea.y : 0
      const screenW = workArea.width || targetDisplay.size?.width || targetDisplay.bounds?.width || screen.getPrimaryDisplay().workAreaSize.width
      const screenH = workArea.height || targetDisplay.size?.height || targetDisplay.bounds?.height || screen.getPrimaryDisplay().workAreaSize.height

      const hasWebcam = !!(settings && (settings.recordWebcam || settings.defaultRecordWebcam))
      let winWidth = 240
      let winHeight = 56

      if (hasWebcam) {
        winWidth = 250
      }

      const leftMargin =
        Number(settings?.floatingLeftMargin || options?.leftMargin) || WINDOW_CONFIG.floating.margins.left
      const bottomMargin =
        Number(settings?.floatingBottomMargin || options?.bottomMargin) || WINDOW_CONFIG.floating.margins.bottom

      const winX = originX + leftMargin
      const winY = originY + Math.max(10, screenH - (winHeight + bottomMargin))

      this.windows.floating = new BrowserWindow({
        width: winWidth,
        height: winHeight,
        x: winX,
        y: winY,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        transparent: true,
        backgroundColor: '#00000000',
        hasShadow: false,
        focusable: true,
        acceptFirstMouse: true,
        opacity: 1.0,
        vibrancy: 'dark', // macOS only, helps with transparency
        visualEffectState: 'active', // macOS only
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: this.preloadPath,
          enableRemoteModule: false,
          sandbox: false,
          backgroundThrottling: false, // Evita throttling en backgrounds
          offscreen: false // Asegura rendering directo
        },
        show: false
      })

      await this.windows.floating.loadFile('src/windows/floating-controls.html')

      try {
        this.windows.floating.setAlwaysOnTop(true, 'screen-saver')
      } catch (e) {}
      try {
        this.windows.floating.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      } catch (e) {}
      try {
        this.windows.floating.setHasShadow(false)
      } catch (e) {}

      try {
        this.windows.floating.setBackgroundColor('#00000000')

        if (process.platform === 'darwin') {
          try {
            this.windows.floating.setVibrancy('dark')
          } catch (e) {}

          try {
            this.windows.floating.setVisualEffectState('active')
          } catch (e) {}
        }

        this.windows.floating.setIgnoreMouseEvents(false)
      } catch (e) {}

      try {
        this.windows.floating.setContentProtection(true)
      } catch (e) {}

      try {
        this.windows.floating.setMovable(true)
      } catch (e) {}

      this.windows.floating.on('closed', () => {
        this.windows.floating = null
      })

      return this.windows.floating
    } catch (error) {
      throw error
    }
  }

  async createSaveWindow(options = {}) {
    try {
      if (!this.windows.main) {
        throw new Error('Main window must exist before creating save window')
      }

      const mainBounds = this.windows.main.getBounds()
      const saveWidth = WINDOW_CONFIG.save.width
      const saveHeight = WINDOW_CONFIG.save.height

      const x = mainBounds.x + Math.floor((mainBounds.width - saveWidth) / 2)
      const y = mainBounds.y + Math.floor((mainBounds.height - saveHeight) / 2)

      this.windows.save = new BrowserWindow({
        ...WINDOW_CONFIG.save,
        x: x,
        y: y,
        alwaysOnTop: true,
        title: 'Save Recording',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: this.preloadPath,
          enableRemoteModule: false,
          sandbox: false,
          additionalArguments: [`--save-options-b64=${Buffer.from(JSON.stringify(options)).toString('base64')}`]
        },
        show: false
      })

      await this.windows.save.loadFile('src/windows/save-video.html')

      if (this.windows.main && typeof this.windows.main.isMinimized === 'function' && this.windows.main.isMinimized()) {
        try {
          this.windows.main.restore()
        } catch (err) {}
      }

      this.windows.save.webContents.once('dom-ready', () => {
        this.windows.save.webContents.executeJavaScript(`
          window.saveOptions = ${JSON.stringify(options)};
        `)

        try {
          this.windows.save.webContents.send('init-save-options', options)
        } catch (e) {}
      })

      this.windows.save.once('ready-to-show', () => {
        this.windows.save.show()
      })

      setTimeout(() => {
        if (this.windows.save && !this.windows.save.isDestroyed() && !this.windows.save.isVisible()) {
          try {
            this.windows.save.show()
          } catch (e) {}
        }
      }, 250)

      this.windows.save.on('closed', () => {
        this.windows.save = null
      })

      return this.windows.save
    } catch (error) {
      throw error
    }
  }

  async createSourceSelectorWindow() {
    if (this._sourceSelectorCreating) {
      return this._sourceSelectorCreating
    }

    this._sourceSelectorCreating = (async () => {
      try {
        if (this.windows.sourceSelector && !this.windows.sourceSelector.isDestroyed()) {
          try {
            this.windows.sourceSelector.restore() // In case it's minimized
            this.windows.sourceSelector.show()
            this.windows.sourceSelector.focus()
            this.windows.sourceSelector.moveTop() // Bring to front

            setTimeout(() => {
              try {
                if (this.windows.sourceSelector && !this.windows.sourceSelector.isDestroyed()) {
                  if (!this.windows.sourceSelector.isVisible()) {
                    this.windows.sourceSelector.show()
                    this.windows.sourceSelector.focus()
                  }
                }
              } catch (e) {}
            }, 50)
          } catch (e) {}
          return this.windows.sourceSelector
        }

        const mainBounds = this.windows.main ? this.windows.main.getBounds() : null
        const width = WINDOW_CONFIG.sourceSelector.width
        const height = WINDOW_CONFIG.sourceSelector.height

        let x, y
        if (mainBounds) {
          x = mainBounds.x + Math.floor((mainBounds.width - width) / 2)
          y = mainBounds.y + Math.floor((mainBounds.height - height) / 2)
        }

        this.windows.sourceSelector = new BrowserWindow({
          ...WINDOW_CONFIG.sourceSelector,
          x,
          y,
          title: 'Select Source',
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: this.preloadPath,
            enableRemoteModule: false,
            sandbox: false
          },
          show: false
        })

        await this.windows.sourceSelector.loadFile('src/windows/source-selector.html')

        const winRef = this.windows.sourceSelector

        try {
          winRef.show()
          winRef.focus()
          winRef.moveTop()
        } catch (e) {}

        winRef.once('ready-to-show', () => {
          try {
            if (winRef && !winRef.isDestroyed()) {
              if (!winRef.isVisible()) {
              }
            }
          } catch (e) {}
        })

        winRef.on('closed', () => {
          if (this.windows.sourceSelector === winRef) this.windows.sourceSelector = null
        })

        if (!winRef || (winRef && typeof winRef.isDestroyed === 'function' && winRef.isDestroyed())) {
          return null
        }

        return winRef
      } finally {
        this._sourceSelectorCreating = null
      }
    })()

    return this._sourceSelectorCreating
  }

  async createDriveAccountsWindow() {
    if (this._driveAccountsCreating) {
      return this._driveAccountsCreating
    }

    const callerStack = new Error('createDriveAccountsWindow called').stack

    this._driveAccountsCreating = (async () => {
      const t0 = Date.now()
      try {
        if (this.windows.driveAccounts && !this.windows.driveAccounts.isDestroyed()) {
          try {
            this.windows.driveAccounts.restore() // In case it's minimized
            this.windows.driveAccounts.show()
            this.windows.driveAccounts.focus()
            this.windows.driveAccounts.moveTop() // Bring to front

            setTimeout(() => {
              try {
                if (this.windows.driveAccounts && !this.windows.driveAccounts.isDestroyed()) {
                  if (!this.windows.driveAccounts.isVisible()) {
                    this.windows.driveAccounts.show()
                    this.windows.driveAccounts.focus()
                  }
                }
              } catch (e) {}
            }, 50)
          } catch (e) {}
          return this.windows.driveAccounts
        }

        const mainBounds = this.windows.main ? this.windows.main.getBounds() : null
        const width = 720
        const height = 520

        let x, y
        if (mainBounds) {
          x = mainBounds.x + Math.floor((mainBounds.width - width) / 2)
          y = mainBounds.y + Math.floor((mainBounds.height - height) / 2)
        }

        const parentWindow = this.windows.save || this.windows.main
        let parentWasAlwaysOnTop = false
        if (parentWindow && typeof parentWindow.isAlwaysOnTop === 'function') {
          try {
            parentWasAlwaysOnTop = parentWindow.isAlwaysOnTop()
            if (parentWasAlwaysOnTop) parentWindow.setAlwaysOnTop(false)
          } catch (e) {}
        }

        this.windows.driveAccounts = new BrowserWindow({
          width,
          height,
          x,
          y,
          modal: !!parentWindow,
          parent: parentWindow || undefined,
          title: 'Drive Accounts',
          icon: this.getAppIcon(),
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: this.preloadPath,
            enableRemoteModule: false,
            sandbox: false
          },
          show: false // We'll show it manually after loading
        })

        this.windows.driveAccounts._windowManager = this

        try {
          await this.windows.driveAccounts.loadFile('src/windows/drive-accounts.html')
        } catch (loadErr) {
          try {
            if (this.windows.driveAccounts && !this.windows.driveAccounts.isDestroyed()) {
              this.windows.driveAccounts.close()
            }
          } catch (e) {}
          this.windows.driveAccounts = null
          throw loadErr
        }

        const winRef = this.windows.driveAccounts

        try {
          winRef.show()
          winRef.focus()
          winRef.moveTop()
        } catch (e) {}

        try {
          if (winRef && winRef.webContents) {
            winRef.webContents.once('dom-ready', () => {
              try {
                if (winRef && !winRef.isDestroyed()) {
                  if (!winRef.isVisible()) {
                  }
                } else {
                }
              } catch (e) {}
            })
          } else {
          }
        } catch (e) {}

        try {
          if (winRef) {
            winRef.once('ready-to-show', () => {
              try {
                if (winRef && !winRef.isDestroyed()) {
                  if (!winRef.isVisible()) {
                  }
                } else {
                }
              } catch (e) {}
            })
          } else {
          }
        } catch (e) {}

        try {
          if (winRef && typeof winRef.on === 'function') {
            winRef.on('closed', () => {
              try {
                if (this.windows.driveAccounts === winRef) this.windows.driveAccounts = null
                const saveWin = this.windows.save
                if (
                  saveWin &&
                  !saveWin.isDestroyed() &&
                  saveWin.webContents &&
                  typeof saveWin.webContents.send === 'function'
                ) {
                  try {
                    saveWin.webContents.send('drive-accounts-changed', { action: 'manage-closed' })
                  } catch (e) {}
                }
              } catch (e) {}
            })
          } else {
          }
        } catch (e) {}

        const t1 = Date.now()

        if (!winRef || (winRef && typeof winRef.isDestroyed === 'function' && winRef.isDestroyed())) {
          return null
        }

        return winRef
      } finally {
        this._driveAccountsCreating = null
      }
    })()

    return this._driveAccountsCreating
  }

  async createWebcamWindow(anchorWindow, options = {}) {
    try {
      if (this.windows.webcam && !this.windows.webcam.isDestroyed()) {
        try {
          this.windows.webcam.close()
        } catch (e) {}
        this.windows.webcam = null
      }

      const width = options.width || WINDOW_CONFIG.webcam.defaultWidth
      const height = options.height || WINDOW_CONFIG.webcam.defaultHeight
      const gap = 12

      let x = undefined
      let y = undefined

      if (anchorWindow && !anchorWindow.isDestroyed()) {
        try {
          const bounds = anchorWindow.getBounds()
          const disp = screen.getDisplayMatching(bounds) || screen.getPrimaryDisplay()
          const work = disp.workArea || disp.bounds || {}
          const originX = typeof work.x === 'number' ? work.x : 0
          const screenW = work.width || disp.workAreaSize?.width || screen.getPrimaryDisplay().workAreaSize.width

          if (options?.alignSides) {
            const marginRight = Number(options?.marginRight) || WINDOW_CONFIG.webcam.margins.right
            x = Math.max(originX + 10, originX + screenW - width - marginRight)
            const verticalCompensation = Number(options?.alignOffset ?? 0)
            y = bounds.y + bounds.height - height - verticalCompensation
          } else {
            x = bounds.x + bounds.width + gap
            const verticalCompensation = Number(options?.alignOffset ?? 0)
            y = bounds.y + bounds.height - height - verticalCompensation
          }

          try {
            const minY = typeof work.y === 'number' ? work.y + 8 : 8
            const maxY =
              typeof work.y === 'number' && typeof work.height === 'number' ? work.y + work.height - height - 8 : y
            if (y < minY) y = minY
            if (y > maxY) y = maxY
          } catch (clampErr) {}
        } catch (e) {}
      }

      if (typeof x === 'undefined' || typeof y === 'undefined') {
        const targetDisplay = options?.display || screen.getPrimaryDisplay()
        const workArea = targetDisplay.workArea || targetDisplay.bounds || {}
        const originX = typeof workArea.x === 'number' ? workArea.x : 0
        const originY = typeof workArea.y === 'number' ? workArea.y : 0
        const screenW = workArea.width || screen.getPrimaryDisplay().workAreaSize.width
        const screenH = workArea.height || screen.getPrimaryDisplay().workAreaSize.height
        const marginRight = Number(options?.marginRight) || WINDOW_CONFIG.webcam.margins.right
        const marginBottom = Number(options?.marginBottom) || WINDOW_CONFIG.webcam.margins.bottom

        x = Math.max(10, originX + screenW - width - marginRight)
        y = Math.max(10, originY + screenH - height - marginBottom)
      }

      this.windows.webcam = new BrowserWindow({
        width,
        height,
        x,
        y,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        transparent: true,
        backgroundColor: '#00000000',
        hasShadow: false,
        focusable: true,
        acceptFirstMouse: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: this.preloadPath,
          enableRemoteModule: false,
          sandbox: false
        },
        show: false
      })

      await this.windows.webcam.loadFile('src/windows/webcam-preview.html')

      try {
        this.windows.webcam.setAlwaysOnTop(true, 'screen-saver')
      } catch (e) {}
      try {
        this.windows.webcam.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      } catch (e) {}
      try {
        this.windows.webcam.setMovable(true)
      } catch (e) {}
      try {
        this.windows.webcam.setHasShadow(false)
      } catch (e) {}

      this.windows.webcam.on('closed', () => {
        this.windows.webcam = null
      })

      this.windows.webcam.once('ready-to-show', () => {
        try {
          this.windows.webcam.show()
        } catch (e) {}
      })

      setTimeout(() => {
        if (this.windows.webcam && !this.windows.webcam.isDestroyed() && !this.windows.webcam.isVisible()) {
          try {
            this.windows.webcam.show()
          } catch (e) {}
        }
      }, 200)

      return this.windows.webcam
    } catch (error) {
      throw error
    }
  }

  getWindow(type) {
    return this.windows[type] || null
  }

  closeWindow(type) {
    const window = this.windows[type]
    if (window && !window.isDestroyed()) {
      window.close()
      this.windows[type] = null
    }
  }

  closeAllWindows() {
    Object.keys(this.windows).forEach(type => {
      this.closeWindow(type)
    })
  }

  showMainWindow() {
    if (this.windows.main && !this.windows.main.isDestroyed()) {
      this.windows.main.show()
      this.windows.main.focus()
    }
  }

  minimizeMainWindow() {
    if (this.windows.main && !this.windows.main.isDestroyed()) {
      this.windows.main.minimize()
    }
  }

  moveFloatingWindow(deltaX, deltaY) {
    if (this.windows.floating && !this.windows.floating.isDestroyed()) {
      const [currentX, currentY] = this.windows.floating.getPosition()
      this.windows.floating.setPosition(currentX + deltaX, currentY + deltaY)
    }
  }

  startFloatingDrag() {
    if (this._dragInterval) clearInterval(this._dragInterval)
    if (!this.windows.floating || this.windows.floating.isDestroyed()) return

    const cursor = screen.getCursorScreenPoint()
    const [winX, winY] = this.windows.floating.getPosition()
    this._dragOffsetX = cursor.x - winX
    this._dragOffsetY = cursor.y - winY

    this._dragInterval = setInterval(() => {
      if (!this.windows.floating || this.windows.floating.isDestroyed()) {
        return this.stopFloatingDrag()
      }
      const pos = screen.getCursorScreenPoint()
      this.windows.floating.setPosition(
        Math.round(pos.x - this._dragOffsetX),
        Math.round(pos.y - this._dragOffsetY)
      )
    }, 16)
  }

  stopFloatingDrag() {
    if (this._dragInterval) {
      clearInterval(this._dragInterval)
      this._dragInterval = null
    }
  }

  resizeFloatingWindow(width, height) {
    if (this.windows.floating && !this.windows.floating.isDestroyed()) {
      const [currentX, currentY] = this.windows.floating.getPosition()
      this.windows.floating.setSize(width, height)
      this.windows.floating.setPosition(currentX, currentY)
    }
  }

  getAppIcon() {
    const platform = process.platform
    if (platform === 'darwin') {
      return path.join(__dirname, '../icon.icns')
    } else if (platform === 'win32') {
      return path.join(__dirname, '../icon.ico')
    } else {
      return path.join(__dirname, '../icon.png')
    }
  }

  hasOpenWindows() {
    return Object.values(this.windows).some(window => window && !window.isDestroyed())
  }

  getWindowCount() {
    return Object.values(this.windows).filter(window => window && !window.isDestroyed()).length
  }

  async createDriveAccountsWindow() {
    try {
      if (this.windows.driveAccounts && !this.windows.driveAccounts.isDestroyed()) {
        this.windows.driveAccounts.focus()
        return this.windows.driveAccounts
      }

      const mainWindow = this.windows.main
      let x, y

      if (mainWindow && !mainWindow.isDestroyed()) {
        const mainBounds = mainWindow.getBounds()
        const width = 700
        const height = 600
        x = mainBounds.x + Math.floor((mainBounds.width - width) / 2)
        y = mainBounds.y + Math.floor((mainBounds.height - height) / 2)
      }

      this.windows.driveAccounts = new BrowserWindow({
        width: 700,
        height: 600,
        x: x,
        y: y,
        title: 'Google Drive Accounts',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: this.preloadPath,
          enableRemoteModule: false,
          sandbox: false
        },
        show: false,
        resizable: true,
        minimizable: true,
        maximizable: true,
        fullscreenable: false
      })

      await this.windows.driveAccounts.loadFile('src/windows/drive-accounts.html')

      this.windows.driveAccounts.once('ready-to-show', () => {
        this.windows.driveAccounts.show()
      })

      this.windows.driveAccounts.on('closed', () => {
        this.windows.driveAccounts = null
      })

      return this.windows.driveAccounts
    } catch (error) {
      return null
    }
  }

  async createYouTubeAccountsWindow() {
    try {
      if (this.windows.youtubeAccounts && !this.windows.youtubeAccounts.isDestroyed()) {
        this.windows.youtubeAccounts.focus()
        return this.windows.youtubeAccounts
      }

      const mainWindow = this.windows.main
      let x, y

      if (mainWindow && !mainWindow.isDestroyed()) {
        const mainBounds = mainWindow.getBounds()
        const width = 700
        const height = 600
        x = mainBounds.x + Math.floor((mainBounds.width - width) / 2)
        y = mainBounds.y + Math.floor((mainBounds.height - height) / 2)
      }

      this.windows.youtubeAccounts = new BrowserWindow({
        width: 700,
        height: 600,
        x: x,
        y: y,
        title: 'YouTube Accounts',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: this.preloadPath,
          enableRemoteModule: false,
          sandbox: false
        },
        show: false,
        resizable: true,
        minimizable: true,
        maximizable: true,
        fullscreenable: false
      })

      await this.windows.youtubeAccounts.loadFile('src/windows/youtube-accounts.html')

      this.windows.youtubeAccounts.once('ready-to-show', () => {
        this.windows.youtubeAccounts.show()
      })

      this.windows.youtubeAccounts.on('closed', () => {
        this.windows.youtubeAccounts = null
      })

      return this.windows.youtubeAccounts
    } catch (error) {
      return null
    }
  }

}

module.exports = WindowManager
