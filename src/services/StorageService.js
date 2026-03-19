const fs = require('fs')
const path = require('path')
const { dialog } = require('electron')
const { FILE_FILTERS } = require('../config/constants')

class StorageService {
  constructor() {
    this.defaultSaveFolder = this.getDefaultSaveFolder()
    this.ensureDefaultFolderExists()
  }

  getDefaultSaveFolder() {
    const { app } = require('electron')
    const downloadsPath = app.getPath('downloads')
    return path.join(downloadsPath, 'StreamSnap Recordings')
  }

  ensureDefaultFolderExists() {
    try {
      if (!fs.existsSync(this.defaultSaveFolder)) {
        fs.mkdirSync(this.defaultSaveFolder, { recursive: true })
      }
    } catch (error) {}
  }

  async showSaveDialog(parentWindow = null, defaultFileName = null) {
    try {
      const fileName = defaultFileName || `Recording-${Date.now()}.mp4`

      const result = await dialog.showSaveDialog(parentWindow, {
        title: 'Save Recording',
        defaultPath: path.join(this.defaultSaveFolder, fileName),
        filters: FILE_FILTERS.video,
        properties: ['createDirectory']
      })

      if (!result.canceled && result.filePath) {
        return { filePath: result.filePath }
      }

      return null
    } catch (error) {
      throw error
    }
  }

  async saveVideo(videoData, filePath) {
    try {
      const directory = path.dirname(filePath)
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true })
      }

      const buffer = Buffer.isBuffer(videoData) ? videoData : Buffer.from(videoData)
      fs.writeFileSync(filePath, buffer)

      const stats = fs.statSync(filePath)

      return {
        success: true,
        filePath,
        fileSize: stats.size,
        formattedSize: this.formatFileSize(stats.size)
      }
    } catch (error) {
      throw new Error(`Failed to save video: ${error.message}`)
    }
  }

  async validateFolder(folderPath) {
    try {
      if (!fs.existsSync(folderPath)) {
        return { isValid: false, error: 'Folder does not exist' }
      }

      const stats = fs.statSync(folderPath)
      if (!stats.isDirectory()) {
        return { isValid: false, error: 'Path is not a directory' }
      }

      const testFile = path.join(folderPath, '.streamsnap-test')
      try {
        fs.writeFileSync(testFile, 'test')
        fs.unlinkSync(testFile)
      } catch (writeError) {
        return { isValid: false, error: 'Folder is not writable' }
      }

      return { isValid: true }
    } catch (error) {
      return { isValid: false, error: error.message }
    }
  }

  async getFolderInfo(folderPath) {
    try {
      if (!fs.existsSync(folderPath)) {
        return null
      }

      const stats = fs.statSync(folderPath)
      const files = fs.readdirSync(folderPath)
      const recordings = files.filter(
        file => file.toLowerCase().endsWith('.webm') || file.toLowerCase().endsWith('.mp4')
      )

      return {
        path: folderPath,
        exists: true,
        isDirectory: stats.isDirectory(),
        totalFiles: files.length,
        recordingFiles: recordings.length,
        lastModified: stats.mtime,
        size: this.calculateFolderSize(folderPath)
      }
    } catch (error) {
      return null
    }
  }

  calculateFolderSize(folderPath) {
    try {
      let totalSize = 0
      const files = fs.readdirSync(folderPath)

      for (const file of files) {
        const filePath = path.join(folderPath, file)
        const stats = fs.statSync(filePath)

        if (stats.isDirectory()) {
          totalSize += this.calculateFolderSize(filePath)
        } else {
          totalSize += stats.size
        }
      }

      return totalSize
    } catch (error) {
      return 0
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  generateUniqueFileName(folderPath, baseName = 'Recording', extension = 'webm') {
    let counter = 1
    let fileName = `${baseName}.${extension}`
    let filePath = path.join(folderPath, fileName)

    while (fs.existsSync(filePath)) {
      fileName = `${baseName} (${counter}).${extension}`
      filePath = path.join(folderPath, fileName)
      counter++
    }

    return fileName
  }

  async cleanupOldRecordings(folderPath, maxAge = 30, maxCount = 100) {
    try {
      if (!fs.existsSync(folderPath)) {
        return { cleaned: 0, errors: [] }
      }

      const files = fs.readdirSync(folderPath)
      const recordings = files.filter(
        file => file.toLowerCase().endsWith('.webm') || file.toLowerCase().endsWith('.mp4')
      )

      const now = Date.now()
      const maxAgeMs = maxAge * 24 * 60 * 60 * 1000
      let cleaned = 0
      const errors = []

      const recordingsWithStats = recordings
        .map(file => {
          const filePath = path.join(folderPath, file)
          const stats = fs.statSync(filePath)
          return { file, filePath, mtime: stats.mtime.getTime() }
        })
        .sort((a, b) => a.mtime - b.mtime)

      for (const { file, filePath, mtime } of recordingsWithStats) {
        if (now - mtime > maxAgeMs) {
          try {
            fs.unlinkSync(filePath)
            cleaned++
          } catch (error) {
            errors.push(`Failed to delete ${file}: ${error.message}`)
          }
        }
      }

      const remainingFiles = recordingsWithStats.slice(cleaned)
      if (remainingFiles.length > maxCount) {
        const filesToRemove = remainingFiles.slice(0, remainingFiles.length - maxCount)
        for (const { file, filePath } of filesToRemove) {
          try {
            fs.unlinkSync(filePath)
            cleaned++
          } catch (error) {
            errors.push(`Failed to delete ${file}: ${error.message}`)
          }
        }
      }

      return { cleaned, errors }
    } catch (error) {
      throw error
    }
  }

  getDefaultSaveFolderPath() {
    return this.defaultSaveFolder
  }

  setDefaultSaveFolder(folderPath) {
    this.defaultSaveFolder = folderPath
  }

  async selectFolder() {
    const result = await dialog.showOpenDialog({
      title: 'Select Default Save Folder',
      properties: ['openDirectory']
    })

    if (result.canceled || !result.filePaths.length) {
      return null
    }

    return {
      folderPath: result.filePaths[0]
    }
  }
}

module.exports = StorageService
