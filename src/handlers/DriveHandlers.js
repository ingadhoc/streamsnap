const { ipcMain } = require('electron')
const DriveAccountManager = require('../services/DriveAccountManager')

class DriveHandlers {
  constructor(app) {
    this.app = app
    this.setupHandlers()
  }

  setupHandlers() {
    ipcMain.handle('open-drive-accounts', async () => {
      try {
        const window = await this.app.windowManager.createDriveAccountsWindow()
        return { success: true, window: !!window }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('drive-accounts:list', async () => {
      try {
        const accounts = DriveAccountManager.listAccounts()
        return { success: true, accounts }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('drive-accounts:get-active', async () => {
      try {
        const accounts = DriveAccountManager.getActiveAccounts()
        return { success: true, accounts }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('drive-accounts:refresh-all-tokens', async () => {
      try {
        const refreshedCount = await DriveAccountManager.refreshAllTokens()
        return { success: true, refreshedCount }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('drive-accounts:create', async (event, options) => {
      try {
        const account = await DriveAccountManager.createAccount(options)
        return { success: true, account }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('drive-accounts:remove', async (event, accountId) => {
      try {
        const removed = await DriveAccountManager.removeAccount(accountId)
        return { success: true, removed }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('drive-accounts:update', async (event, accountId, changes) => {
      try {
        const account = await DriveAccountManager.updateAccount(accountId, changes)
        return { success: true, account }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('drive-accounts:handle-auth-error', async (event, accountId) => {
      try {
        const result = await DriveAccountManager.handleAuthError(accountId)
        return result
      } catch (error) {
        return { success: false, shouldRemove: false, error: error.message }
      }
    })

    ipcMain.handle('get-drive-folders-account', async (event, accountId) => {
      try {
        const folders = await DriveAccountManager.getFolders(accountId)
        return folders
      } catch (error) {
        throw error
      }
    })

    ipcMain.handle('get-drive-folders-paged-account', async (event, accountId, options) => {
      try {
        const result = await DriveAccountManager.getFoldersPaged(accountId, options)
        return result
      } catch (error) {
        throw error
      }
    })

    ipcMain.handle('drive-sign-in', async () => {
      try {
        const result = await this.app.driveService.authenticate()

        if (result && result.success) {
          const accessToken = result.accessToken || result.access_token || null
          if (accessToken) {
            this.app.driveService.setTokens({ access_token: accessToken })
          }
          this.app.broadcastToWindows('drive-auth-updated', { authenticated: true, accessToken })
        } else {
          this.app.broadcastToWindows('drive-auth-updated', { authenticated: false })
        }

        return result
      } catch (error) {
        this.app.broadcastToWindows('drive-auth-updated', { authenticated: false })
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('drive-is-authenticated', () => {
      try {
        return { authenticated: this.app.driveService.isAuthenticated() }
      } catch (error) {
        return { authenticated: false }
      }
    })

    ipcMain.handle('drive-sign-out', () => {
      try {
        this.app.driveService.signOut()
        this.app.broadcastToWindows('drive-auth-updated', { authenticated: false })
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('save-to-drive-account', async (event, options) => {
      const fs = require('fs').promises

      try {
        const { accountId, folderId, videoData, fileName, privacy } = options

        const tempPath = this.app.recordingManager.getRecordedVideoPath()
        let dataToUpload = videoData

        if (tempPath) {
          try {
            dataToUpload = await fs.readFile(tempPath)
          } catch (readError) {
            if (!videoData) {
              throw readError
            }
          }
        }

        const result = await this.app.driveService.uploadVideo(accountId, folderId, dataToUpload, fileName, privacy)

        if (result.success && tempPath) {
          try {
            await fs.unlink(tempPath)
          } catch (e) {}
        }

        return result
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('drive-rename-file', async (event, options) => {
      try {
        const { accountId, fileId, fileName } = options || {}

        if (!accountId || !fileId || !fileName) {
          return { success: false, error: 'Missing required parameters' }
        }

        const result = await this.app.driveService.renameFile(accountId, fileId, fileName)
        return { success: true, ...result }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })
  }
}

module.exports = DriveHandlers
