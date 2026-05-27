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

    ipcMain.handle('save-to-local', async (event, options) => {
      const fs = require('fs').promises
      const path = require('path')

      try {
        const { videoData, folderPath, fileName } = options
        const filePath = path.join(folderPath, fileName)

        const tempPath = this.app.recordingManager.getRecordedVideoPath()

        if (tempPath) {
          await fs.copyFile(tempPath, filePath)

          try {
            await fs.unlink(tempPath)
          } catch (e) {}

          this.app.recordingManager.clearRecordedVideoData()
          return { success: true, filePath }
        }

        const saveResult = await this.app.storageService.saveVideo(videoData, filePath)
        this.app.recordingManager.clearRecordedVideoData()
        return saveResult
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('select-folder', async () => {
      try {
        const result = await this.app.storageService.selectFolder()
        return result
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
