const { ipcMain } = require('electron')
const YouTubeAccountManager = require('../services/YouTubeAccountManager')

class YouTubeHandlers {
  constructor(app) {
    this.app = app
    this.setupHandlers()
  }

  setupHandlers() {
    ipcMain.handle('youtube-accounts:list', async () => {
      try {
        const accounts = YouTubeAccountManager.listAccounts()
        return { success: true, accounts }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('youtube-accounts:get-active', async () => {
      try {
        const accounts = YouTubeAccountManager.getActiveAccounts()
        return { success: true, accounts }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('youtube-accounts:create', async (event, options) => {
      try {
        const account = await YouTubeAccountManager.createAccount(options)
        return { success: true, account }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('youtube-accounts:remove', async (event, accountId) => {
      try {
        const removed = await YouTubeAccountManager.removeAccount(accountId)
        return { success: true, removed }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('youtube-accounts:update', async (event, accountId, changes) => {
      try {
        const account = await YouTubeAccountManager.updateAccount(accountId, changes)
        return { success: true, account }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('youtube-sign-in', async () => {
      try {
        const result = await this.app.youtubeService.authenticate()

        if (result && result.success) {
          const channelInfo = await this.app.youtubeService.getChannelInfo(result.accessToken)

          if (channelInfo.success) {
            const account = await YouTubeAccountManager.createAccount({
              accessToken: result.accessToken,
              refreshToken: result.refreshToken,
              email: channelInfo.channelName,
              channelName: channelInfo.channelName,
              channelId: channelInfo.channelId,
              thumbnail: channelInfo.thumbnail,
              tokenExpiry: Date.now() + 3600000
            })

            this.app.broadcastToWindows('youtube-auth-updated', {
              authenticated: true,
              account
            })

            return { success: true, account }
          } else {
            return { success: false, error: channelInfo.error || 'Failed to get channel info' }
          }
        }

        this.app.broadcastToWindows('youtube-auth-updated', { authenticated: false })
        return result || { success: false, error: 'Authentication failed' }
      } catch (error) {
        this.app.broadcastToWindows('youtube-auth-updated', { authenticated: false })
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('save-to-youtube-account', async (event, options) => {
      const fs = require('fs').promises
      const path = require('path')

      try {
        const { accountId, videoData, title, description, privacy, playlistId } = options

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

        let mimeType = 'video/mp4'
        if (tempPath) {
          const ext = path.extname(tempPath).toLowerCase()
          if (ext === '.webm') {
            mimeType = 'video/webm'
          }
        }

        const uploadOptions = { privacy, mimeType }
        if (playlistId) {
          uploadOptions.playlistId = playlistId
        }

        const result = await this.app.youtubeService.uploadVideo(
          accountId,
          dataToUpload,
          title,
          description,
          uploadOptions
        )

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

    ipcMain.handle('youtube-get-channel-info', async (event, accountId) => {
      try {
        const result = await this.app.youtubeService.getChannelInfo(accountId)
        return result
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('youtube-get-playlists', async (event, accountId) => {
      try {
        const result = await this.app.youtubeService.getPlaylists(accountId)
        return result
      } catch (error) {
        return { success: false, error: error.message, playlists: [] }
      }
    })
  }
}

module.exports = YouTubeHandlers
