const { ipcMain } = require('electron')
const RecoveryManager = require('../utils/recovery-manager')

class StorageHandlers {
  constructor(app) {
    this.app = app
    this.setupHandlers()
  }

  setupHandlers() {
    ipcMain.handle('save-video', async (event, videoData) => {
      try {
        const saveWindow = this.app.windowManager.getWindow('save')
        const result = await this.app.storageService.showSaveDialog(saveWindow)

        if (result) {
          const saveResult = await this.app.storageService.saveVideo(videoData, result.filePath)
          this.app.recordingManager.clearRecordedVideoData()
          this.app.windowManager.closeWindow('save')
          return saveResult
        }

        return { success: false, error: 'No file path selected' }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    // ── Local recordings library ───────────────────────────────────────────
    // Lists, opens in save panel, and deletes recordings in the permanent
    // save folder (Downloads/StreamSnap Recordings).

    ipcMain.handle('local-recordings:list', async () => {
      const fs = require('fs').promises
      const path = require('path')

      try {
        const folder = this.app.storageService.getDefaultSaveFolderPath()

        try {
          await fs.access(folder)
        } catch {
          return { success: true, recordings: [] }
        }

        const files = await fs.readdir(folder)
        const recordings = []

        for (const file of files) {
          const lower = file.toLowerCase()
          if (!lower.endsWith('.webm') && !lower.endsWith('.mp4')) continue

          const filePath = path.join(folder, file)
          try {
            const stats = await fs.stat(filePath)
            recordings.push({
              fileName: file,
              filePath,
              size: stats.size,
              modified: stats.mtime.toISOString()
            })
          } catch (e) {}
        }

        // Newest first
        recordings.sort((a, b) => new Date(b.modified) - new Date(a.modified))
        return { success: true, recordings }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('local-recordings:open-in-save-panel', async (event, filePath) => {
      const fs = require('fs').promises

      try {
        // Verify the file still exists
        await fs.access(filePath)

        const path = require('path')
        const ext = path.extname(filePath).replace('.', '') || 'webm'

        // Point the recording manager at this file so Drive/YouTube handlers can read it
        this.app.recordingManager.clearRecordedVideoData()
        this.app.recordingManager.setRecordedVideoPath(filePath)

        const DriveAccountManager = require('../services/DriveAccountManager')
        const YouTubeAccountManager = require('../services/YouTubeAccountManager')

        const saveOpts = {
          showDriveOption: Boolean(DriveAccountManager.getActiveAccounts().length > 0),
          showYouTubeOption: Boolean(YouTubeAccountManager.getActiveAccounts().length > 0),
          showDriveSignIn: !this.app.driveService.isAuthenticated(),
          showLocalOption: false,
          tempVideoPath: filePath,
          driveAccessToken: this.app.driveService.isAuthenticated()
            ? this.app.driveService.accessToken
            : undefined,
          autoSaved: false,
          autoSaveAttempted: false,
          outputFormat: ext
        }

        // Open with focus so the user can interact with it immediately
        await this.app.windowManager.createSaveWindow(saveOpts, true)
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('local-recordings:delete', async (event, filePath) => {
      const fs = require('fs').promises

      try {
        await fs.unlink(filePath)

        // If this was the current recording being managed, clear the path
        const currentPath = this.app.recordingManager.getRecordedVideoPath()
        if (currentPath === filePath) {
          this.app.recordingManager.clearRecordedVideoData()
        }

        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('open-external', (event, url) => {
      require('electron').shell.openExternal(url)
      return { success: true }
    })

    ipcMain.handle('copy-to-clipboard', (event, text) => {
      const { clipboard } = require('electron')
      clipboard.writeText(text || '')
      return { success: true }
    })

    ipcMain.handle('open-folder', (event, itemPath) => {
      const { shell } = require('electron')
      const fs = require('fs')
      const path = require('path')

      if (fs.existsSync(itemPath)) {
        const stats = fs.statSync(itemPath)
        if (stats.isDirectory()) {
          shell.openPath(itemPath)
        } else {
          shell.showItemInFolder(itemPath)
        }
      }
      return { success: true }
    })

    ipcMain.handle('recovery:list-videos', async () => {
      try {
        const videos = await RecoveryManager.listRecoverableVideos()
        return { success: true, videos }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('recovery:recover-video', async (event, filePath, destinationPath) => {
      try {
        const result = await RecoveryManager.recoverVideo(filePath, destinationPath)
        return result
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('recovery:cleanup', async () => {
      try {
        const result = await RecoveryManager.cleanupOldVideos()
        return { success: true, ...result }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })
  }
}

module.exports = StorageHandlers
