const { ipcMain, screen } = require('electron')

class RecordingHandlers {
  constructor(app) {
    this.app = app
    this.registeredStartShortcut = null
    this.setupHandlers()
  }

  setupHandlers() {
    ipcMain.handle('get-desktop-sources', async () => {
      try {
        return await this.app.recordingManager.getDesktopSources()
      } catch (error) {
        throw error
      }
    })

    ipcMain.handle('start-recording', async () => {
      try {
        const validation = this.app.recordingManager.validateRecordingPrerequisites()
        if (!validation.isValid) {
          return { success: false, errors: validation.errors }
        }

        this.app.recordingManager.startRecording()
        const settings = await this.app.getSettings()
        const targetDisplay = this.getTargetDisplay()
        const floatingWindow = await this.app.windowManager.createFloatingWindow(settings, { display: targetDisplay })

        this.setupFloatingWindow(floatingWindow)
        this.setupWebcamIfNeeded(settings, targetDisplay, floatingWindow)

        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('pause-recording', () => {
      try {
        this.app.recordingManager.pauseRecording()
        this.app.broadcastToWindows('pause-recording-event')
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('resume-recording', () => {
      try {
        this.app.recordingManager.resumeRecording()
        this.app.broadcastToWindows('resume-recording-event')
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('stop-recording', async () => {
      try {
        this.app.recordingManager.stopRecording()
        this.app.windowManager.showMainWindow()
        this.app.broadcastToWindows('stop-recording-event')
        await new Promise(resolve => setTimeout(resolve, 250))
        this.app.windowManager.closeWindow('floating')
        try {
          this.app.windowManager.closeWindow('webcam')
        } catch (e) {}
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('discard-recording', async () => {
      try {
        this.app.broadcastToWindows('discard-recording-event')
        await new Promise(resolve => setTimeout(resolve, 50))
        this.app.recordingManager.stopRecording()
        this.app.recordingManager.clearRecordedVideoData()
        await new Promise(resolve => setTimeout(resolve, 250))
        this.app.windowManager.closeWindow('floating')
        try {
          this.app.windowManager.closeWindow('webcam')
        } catch (e) {}
        this.app.windowManager.showMainWindow()
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('set-recorded-video', async (event, data) => {
      try {
        let videoData = data
        let providedDuration = null

        if (data && typeof data === 'object' && ('videoData' in data || 'duration' in data)) {
          videoData = data.videoData || data.video || data.videoData
          providedDuration = data.duration != null ? data.duration : null
        }

        if (videoData) {
          this.app.recordingManager.setRecordedVideoData(videoData)
        }
        if (providedDuration != null) {
          this.app.recordingManager.setRecordedVideoDuration(providedDuration)
        }

        const settings = await this.app.getSettings()
        const isDriveAvailable = settings?.driveEnabled && this.app.driveService.isAuthenticated()
        const recordedPath = this.app.recordingManager.getRecordedVideoPath()

        this.app.windowManager.showMainWindow()
        await this.app.windowManager.createSaveWindow({
          showDriveOption: Boolean(isDriveAvailable),
          showDriveSignIn: !this.app.driveService.isAuthenticated(),
          showLocalOption: true,
          tempVideoPath: recordedPath,
          driveAccessToken: this.app.driveService.isAuthenticated() ? this.app.driveService.accessToken : undefined
        })

        return { success: true, uploaded: false }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('save-recorded-video-to-temp', async (event, videoBuffer, duration) => {
      const fs = require('fs').promises
      const path = require('path')
      const os = require('os')

      try {
        const tempDir = path.join(os.tmpdir(), 'streamsnap-recordings')
        await fs.mkdir(tempDir, { recursive: true })

        const timestamp = Date.now()
        const tempFilePath = path.join(tempDir, `recording-${timestamp}.webm`)

        const buffer = Buffer.from(videoBuffer)
        await fs.writeFile(tempFilePath, buffer)

        this.app.recordingManager.setRecordedVideoPath(tempFilePath)

        if (duration != null) {
          this.app.recordingManager.setRecordedVideoDuration(duration)
        }

        const settings = await this.app.getSettings()
        const isDriveAvailable = settings?.driveEnabled && this.app.driveService.isAuthenticated()

        this.app.windowManager.showMainWindow()
        await this.app.windowManager.createSaveWindow({
          showDriveOption: Boolean(isDriveAvailable),
          showDriveSignIn: !this.app.driveService.isAuthenticated(),
          showLocalOption: true,
          tempVideoPath: tempFilePath,
          driveAccessToken: this.app.driveService.isAuthenticated() ? this.app.driveService.accessToken : undefined
        })

        return { success: true, tempPath: tempFilePath }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('set-recorded-duration', (event, seconds) => {
      try {
        this.app.recordingManager.setRecordedVideoDuration(seconds)
        return { success: true }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    })

    ipcMain.handle('get-recorded-duration', () => {
      try {
        const duration = this.app.recordingManager.getRecordedVideoDuration()
        return { success: true, duration }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    })

    ipcMain.handle('discard-recorded-video', async () => {
      const fs = require('fs').promises

      try {
        const tempPath = this.app.recordingManager.getRecordedVideoPath()

        if (tempPath) {
          try {
            await fs.unlink(tempPath)
          } catch (e) {}
        }

        this.app.recordingManager.clearRecordedVideoData()
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('get-main-window-data', async () => {
      const fs = require('fs').promises

      try {
        const tempPath = this.app.recordingManager.getRecordedVideoPath()
        let recordedData = this.app.recordingManager.getRecordedVideoData()

        if (tempPath && !recordedData) {
          try {
            recordedData = await fs.readFile(tempPath)
          } catch (readError) {}
        }

        const duration = this.app.recordingManager.getRecordedVideoDuration()
        return { recordedVideoBlob: recordedData, recordedDuration: duration }
      } catch (error) {
        const recordedData = this.app.recordingManager.getRecordedVideoData()
        const duration = this.app.recordingManager.getRecordedVideoDuration()
        return { recordedVideoBlob: recordedData, recordedDuration: duration }
      }
    })

    ipcMain.handle('register-shortcuts', (event, shortcuts) => {
      this.app.recordingManager.updateShortcuts(shortcuts)
      
      // Register the start shortcut globally
      const { globalShortcut } = require('electron')
      
      // Unregister any existing start shortcut
      if (this.registeredStartShortcut) {
        try {
          globalShortcut.unregister(this.registeredStartShortcut)
        } catch (e) {}
      }
      
      // Register new start shortcut if provided
      if (shortcuts.start && shortcuts.start.trim()) {
        try {
          const registered = globalShortcut.register(shortcuts.start, () => {
            // Check if not already recording
            if (!this.app.recordingManager.isRecording) {
              // Show main window if hidden/minimized
              this.app.windowManager.showMainWindow()
              
              // Open source selector
              setTimeout(async () => {
                const mainWindow = this.app.windowManager.getWindow('main')
                if (mainWindow) {
                  mainWindow.webContents.executeJavaScript(`
                    if (window.screenRecorder && window.screenRecorder.openSourceSelector) {
                      window.screenRecorder.openSourceSelector()
                    }
                  `).catch(() => {})
                }
              }, 200)
            }
          })
          
          if (registered) {
            this.registeredStartShortcut = shortcuts.start
          }
        } catch (error) {
          console.error('Failed to register start shortcut:', error)
        }
      }
      
      return { success: true }
    })
  }

  getTargetDisplay() {
    let targetDisplay = screen.getPrimaryDisplay()
    try {
      const sel = this.app.recordingManager.selectedSource
      const displays = screen.getAllDisplays()

      if (sel && sel.display_index != null && displays[sel.display_index]) {
        targetDisplay = displays[sel.display_index]
      }
    } catch (e) {}
    return targetDisplay
  }

  setupFloatingWindow(floatingWindow) {
    if (floatingWindow && typeof floatingWindow.once === 'function') {
      floatingWindow.once('ready-to-show', () => {
        try {
          floatingWindow.show()
        } catch (e) {}
      })
    }

    setTimeout(() => {
      try {
        if (floatingWindow && !floatingWindow.isDestroyed() && !floatingWindow.isVisible()) floatingWindow.show()
      } catch (e) {}
    }, 120)
  }

  setupWebcamIfNeeded(settings, targetDisplay, floatingWindow) {
    try {
      const wantsWebcam = Boolean(settings?.recordWebcam || settings?.defaultRecordWebcam)

      if (wantsWebcam) {
        const webcamOptions = {
          width: settings?.webcamWidth || settings?.webcamPreviewWidth || 320,
          height: settings?.webcamHeight || settings?.webcamPreviewHeight || 180,
          movableControls: settings?.movableControls || false,
          display: targetDisplay,
          alignSides: true,
          marginBottom: Number(settings?.webcamMarginBottom || 40)
        }

        const createAnchoredWebcam = async () => {
          try {
            const webcamWindow = await this.app.windowManager.createWebcamWindow(floatingWindow, webcamOptions)
            if (webcamWindow) {
              try {
                webcamWindow.show()
              } catch (e) {}
            }
          } catch (e) {}
        }

        if (floatingWindow && typeof floatingWindow.getBounds === 'function') {
          setTimeout(createAnchoredWebcam, 120)
        } else if (floatingWindow && typeof floatingWindow.once === 'function') {
          floatingWindow.once('ready-to-show', () => {
            setTimeout(createAnchoredWebcam, 80)
          })
        }
      }
    } catch (e) {}
  }
}

module.exports = RecordingHandlers
