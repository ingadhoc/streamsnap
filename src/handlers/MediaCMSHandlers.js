const { ipcMain } = require('electron')

class MediaCMSHandlers {
  constructor(app) {
    this.app = app
    this.setupHandlers()
  }

  setupHandlers() {
    ipcMain.handle('open-mediacms-settings', async () => {
      try {
        const window = await this.app.windowManager.createMediaCMSSettingsWindow()
        if (window) {
          window.show()
          window.focus()
        }
        return { success: true, window: !!window }
      } catch (error) {
        console.error('Handler: Error creating window:', error)
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('mediacms:get-config', async () => {
      try {
        const config = this.app.mediaCMSService.getConfig()
        return { success: true, config }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('mediacms:authenticate', async (event, { serverUrl, username, password }) => {
      try {
        const result = await this.app.mediaCMSService.authenticate(serverUrl, username, password)

        if (result.success) {
          this.app.broadcastToWindows('mediacms:auth-updated', result)
        }

        return result
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('mediacms:logout', async () => {
      try {
        const result = await this.app.mediaCMSService.logout()

        if (result.success) {
          this.app.broadcastToWindows('mediacms:auth-updated', { success: true, isAuthenticated: false })
        }

        return result
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('mediacms:get-categories', async () => {
      try {
        return await this.app.mediaCMSService.getCategories()
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('mediacms:upload-video', async (event, { filePath, title, description, isPublic, category }) => {
      try {
        const result = await this.app.mediaCMSService.uploadVideo(filePath, title, description, isPublic, category)
        return result
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('mediacms:is-authenticated', async () => {
      try {
        return {
          success: true,
          isAuthenticated: this.app.mediaCMSService.isAuthenticated()
        }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })
  }
}

module.exports = MediaCMSHandlers
