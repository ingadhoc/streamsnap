const fs = require('fs').promises
const path = require('path')
const os = require('os')

class RecoveryManager {
  static getTempDir() {
    return path.join(os.tmpdir(), 'streamsnap-recordings')
  }

  static async listRecoverableVideos() {
    try {
      const tempDir = this.getTempDir()

      try {
        await fs.access(tempDir)
      } catch {
        return []
      }

      const files = await fs.readdir(tempDir)
      const videoFiles = []

      for (const file of files) {
        if (file.endsWith('.webm') || file.endsWith('.mp4')) {
          const filePath = path.join(tempDir, file)
          try {
            const stats = await fs.stat(filePath)
            const ageInHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60)

            if (ageInHours < 48) {
              videoFiles.push({
                fileName: file,
                filePath: filePath,
                size: stats.size,
                modified: stats.mtime,
                ageInHours: ageInHours
              })
            } else {
              try {
                await fs.unlink(filePath)
              } catch (e) {}
            }
          } catch (e) {}
        }
      }

      return videoFiles.sort((a, b) => b.modified - a.modified)
    } catch (error) {
      return []
    }
  }

  static async cleanupOldVideos() {
    try {
      const tempDir = this.getTempDir()

      try {
        await fs.access(tempDir)
      } catch {
        return { cleaned: 0 }
      }

      const files = await fs.readdir(tempDir)
      let cleaned = 0

      for (const file of files) {
        const filePath = path.join(tempDir, file)
        try {
          const stats = await fs.stat(filePath)
          const ageInHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60)

          if (ageInHours > 48) {
            await fs.unlink(filePath)
            cleaned++
          }
        } catch (e) {}
      }

      return { cleaned }
    } catch (error) {
      return { cleaned: 0, error: error.message }
    }
  }

  static async recoverVideo(filePath, destinationPath) {
    try {
      await fs.copyFile(filePath, destinationPath)

      try {
        await fs.unlink(filePath)
      } catch (e) {}

      return { success: true, destinationPath }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}

module.exports = RecoveryManager
