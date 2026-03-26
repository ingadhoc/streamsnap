const { ipcMain, screen } = require('electron')
const VideoConversionService = require('../services/VideoConversionService')
const DriveAccountManager = require('../services/DriveAccountManager')
const YouTubeAccountManager = require('../services/YouTubeAccountManager')

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
        // On Linux the source is chosen via the OS display-media picker (getDisplayMedia),
        // so the renderer never goes through the custom source selector and selectedSource
        // is not set in the main process. Provide a placeholder so validation passes.
        if (process.platform === 'linux' && !this.app.recordingManager.selectedSource) {
          this.app.recordingManager.setSelectedSource({ id: 'linux-display-media', name: 'Screen Capture' })
        }

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

        const hasDriveAccounts = DriveAccountManager.getActiveAccounts().length > 0
        const hasYouTubeAccounts = YouTubeAccountManager.getActiveAccounts().length > 0
        const recordedPath = this.app.recordingManager.getRecordedVideoPath()

        this.app.windowManager.showMainWindow()
        await this.app.windowManager.createSaveWindow({
          showDriveOption: Boolean(hasDriveAccounts),
          showYouTubeOption: Boolean(hasYouTubeAccounts),
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
      const parseTimemarkToSeconds = timemark => {
        if (!timemark || typeof timemark !== 'string') return null

        const parts = timemark.split(':')
        if (parts.length !== 3) return null

        const hours = Number(parts[0])
        const minutes = Number(parts[1])
        const seconds = Number(parts[2])

        if ([hours, minutes, seconds].some(n => Number.isNaN(n))) return null

        return hours * 3600 + minutes * 60 + seconds
      }

      try {
        const tempDir = path.join(os.tmpdir(), 'streamsnap-recordings')
        await fs.mkdir(tempDir, { recursive: true })

        const timestamp = Date.now()
        const tempWebmPath = path.join(tempDir, `recording-${timestamp}.webm`)
        const tempMp4Path = path.join(tempDir, `recording-${timestamp}.mp4`)

        const buffer = Buffer.from(videoBuffer)
        await fs.writeFile(tempWebmPath, buffer)

        this.app.broadcastToWindows('recording-conversion-progress', {
          stage: 'started',
          percent: 0,
          message: 'Converting to MP4...'
        })

        await VideoConversionService.convertWebmToMp4(tempWebmPath, tempMp4Path, progress => {
          const timemark = typeof progress?.timemark === 'string' ? progress.timemark : null
          const rawPercent = typeof progress?.percent === 'number' ? progress.percent : null
          const durationSeconds = typeof duration === 'number' && duration > 0 ? duration : null
          const timemarkSeconds = parseTimemarkToSeconds(timemark)

          let percent = null
          if (rawPercent != null) {
            percent = Math.max(0, Math.min(100, Math.round(rawPercent)))
          } else if (durationSeconds != null && timemarkSeconds != null) {
            const estimated = Math.round((timemarkSeconds / durationSeconds) * 100)
            percent = Math.max(0, Math.min(99, estimated))
          }

          const fallbackMessage = timemark
            ? `Converting to MP4... (${timemark})`
            : 'Converting to MP4...'

          this.app.broadcastToWindows('recording-conversion-progress', {
            stage: 'progress',
            percent,
            message: percent == null ? fallbackMessage : `Converting to MP4... ${percent}%`
          })
        }, {
          timeoutMs: 20 * 60 * 1000
        })

        this.app.broadcastToWindows('recording-conversion-progress', {
          stage: 'completed',
          percent: 100,
          message: 'MP4 conversion completed'
        })

        try {
          await fs.unlink(tempWebmPath)
        } catch (e) {}

        this.app.recordingManager.setRecordedVideoPath(tempMp4Path)

        if (duration != null) {
          this.app.recordingManager.setRecordedVideoDuration(duration)
        }

        const hasDriveAccounts = DriveAccountManager.getActiveAccounts().length > 0
        const hasYouTubeAccounts = YouTubeAccountManager.getActiveAccounts().length > 0

        this.app.windowManager.showMainWindow()
        await this.app.windowManager.createSaveWindow({
          showDriveOption: Boolean(hasDriveAccounts),
          showYouTubeOption: Boolean(hasYouTubeAccounts),
          showDriveSignIn: !this.app.driveService.isAuthenticated(),
          showLocalOption: true,
          tempVideoPath: tempMp4Path,
          driveAccessToken: this.app.driveService.isAuthenticated() ? this.app.driveService.accessToken : undefined
        })

        return { success: true, tempPath: tempMp4Path, outputFormat: 'mp4' }
      } catch (error) {
        this.app.broadcastToWindows('recording-conversion-progress', {
          stage: 'failed',
          message: error.message || 'Error during MP4 conversion'
        })
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

    ipcMain.handle('trim-recorded-video', async (event, options = {}) => {
      const fs = require('fs').promises
      const path = require('path')
      const os = require('os')

      try {
        const startTime = Number(options.startTime)
        const endTime = Number(options.endTime)

        if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
          return { success: false, error: 'Invalid trim range' }
        }

        let sourcePath = this.app.recordingManager.getRecordedVideoPath()
        const inMemoryVideo = this.app.recordingManager.getRecordedVideoData()

        if (!sourcePath) {
          if (!inMemoryVideo) {
            return { success: false, error: 'No recorded video available' }
          }

          const tempDir = path.join(os.tmpdir(), 'streamsnap-recordings')
          await fs.mkdir(tempDir, { recursive: true })
          sourcePath = path.join(tempDir, `recording-${Date.now()}-source.mp4`)
          await fs.writeFile(sourcePath, Buffer.from(inMemoryVideo))
          this.app.recordingManager.setRecordedVideoPath(sourcePath)
        }

        const sourceDir = path.dirname(sourcePath)
        const outputPath = path.join(sourceDir, `recording-${Date.now()}-trimmed.mp4`)

        await VideoConversionService.trimVideo(sourcePath, outputPath, startTime, endTime)

        try {
          if (sourcePath !== outputPath) {
            await fs.unlink(sourcePath)
          }
        } catch (e) {}

        const newDuration = Math.max(0, Math.floor(endTime - startTime))
        this.app.recordingManager.setRecordedVideoData(null)
        this.app.recordingManager.setRecordedVideoPath(outputPath)
        this.app.recordingManager.setRecordedVideoDuration(newDuration)

        const saveWindow = this.app.windowManager.getWindow('save')
        if (saveWindow && !saveWindow.isDestroyed()) {
          try {
            saveWindow.webContents.send('video-trimmed', {
              success: true,
              duration: newDuration,
              tempVideoPath: outputPath
            })
          } catch (e) {}
        }

        return { success: true, tempVideoPath: outputPath, duration: newDuration }
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
        const tempVideoPath = this.app.recordingManager.getRecordedVideoPath()
        return { recordedVideoBlob: recordedData, recordedDuration: duration, tempVideoPath }
      } catch (error) {
        const recordedData = this.app.recordingManager.getRecordedVideoData()
        const duration = this.app.recordingManager.getRecordedVideoDuration()
        const tempVideoPath = this.app.recordingManager.getRecordedVideoPath()
        return { recordedVideoBlob: recordedData, recordedDuration: duration, tempVideoPath }
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
