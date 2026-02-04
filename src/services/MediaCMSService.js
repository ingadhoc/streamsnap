const fs = require('fs')
const path = require('path')
const keytar = require('keytar')
const { app } = require('electron')
const FormData = require('form-data')
const fetch = require('node-fetch')
const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path

ffmpeg.setFfmpegPath(ffmpegPath)

class MediaCMSService {
  constructor() {
    this.serverUrl = null
    this.username = null
    this.token = null
    this.userId = null

    try {
      const dataPath = app.getPath('userData')
      this.configFile = path.join(dataPath, 'mediacms_config.json')

      keytar
        .getPassword('StreamSnap', 'mediacms_config')
        .then((savedStr) => {
          try {
            if (savedStr) {
              const saved = JSON.parse(savedStr)
              this.serverUrl = saved.serverUrl || null
              this.username = saved.username || null
              this.token = saved.token || null
              this.userId = saved.userId || null
              return
            }
          } catch (e) {
            console.error('Error loading from keychain:', e)
          }

          try {
            if (fs.existsSync(this.configFile)) {
              const raw = fs.readFileSync(this.configFile, 'utf8') || '{}'
              const saved = JSON.parse(raw)
              this.serverUrl = saved.serverUrl || null
              this.username = saved.username || null
              this.token = saved.token || null
              this.userId = saved.userId || null
            }
          } catch (diskErr) {
            console.error('Error loading from file:', diskErr)
          }
        })
        .catch((keyErr) => {
          console.error('Keychain error:', keyErr)
          try {
            if (fs.existsSync(this.configFile)) {
              const raw = fs.readFileSync(this.configFile, 'utf8') || '{}'
              const saved = JSON.parse(raw)
              this.serverUrl = saved.serverUrl || null
              this.username = saved.username || null
              this.token = saved.token || null
              this.userId = saved.userId || null
            }
          } catch (diskErr2) {
            console.error('Error loading from file (fallback):', diskErr2)
          }
        })
    } catch (err) {
      console.error('Constructor error:', err)
    }
  }

  async saveConfig() {
    const config = {
      serverUrl: this.serverUrl,
      username: this.username,
      token: this.token,
      userId: this.userId
    }

    try {
      await keytar.setPassword('StreamSnap', 'mediacms_config', JSON.stringify(config))
    } catch (keyErr) {
      console.error('Error saving to keychain:', keyErr)
    }

    try {
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2), 'utf8')
    } catch (diskErr) {
      console.error('Error saving to file:', diskErr)
    }
  }

  isAuthenticated() {
    return !!(this.serverUrl && this.token && this.username)
  }

  async authenticate(serverUrl, username, password) {
    try {
      const baseUrl = serverUrl.replace(/\/$/, '')

      const form = new FormData()
      form.append('username', username)
      form.append('password', password)

      const response = await fetch(`${baseUrl}/api/v1/login`, {
        method: 'POST',
        headers: {
          ...form.getHeaders()
        },
        body: form
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Authentication failed: ${response.status} ${errorText}`)
      }

      const data = await response.json()

      if (!data.token) {
        throw new Error('No token received from server')
      }

      this.serverUrl = baseUrl
      this.username = username
      this.token = data.token
      this.userId = data.user_id || null

      await this.saveConfig()

      return {
        success: true,
        username: this.username,
        serverUrl: this.serverUrl
      }
    } catch (error) {
      console.error('Authentication error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  async logout() {
    this.serverUrl = null
    this.username = null
    this.token = null
    this.userId = null

    try {
      await keytar.deletePassword('StreamSnap', 'mediacms_config')
    } catch (e) {
      console.error('Error deleting from keychain:', e)
    }

    try {
      if (fs.existsSync(this.configFile)) {
        fs.unlinkSync(this.configFile)
      }
    } catch (e) {
      console.error('Error deleting config file:', e)
    }

    return { success: true }
  }

  async uploadVideo(filePath, title, description = '', isPublic = true, category = null) {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with MediaCMS')
    }

    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`)
      }

      const tempMp4Path = filePath.replace('.webm', '_converted.mp4')
      
      await new Promise((resolve, reject) => {
        ffmpeg(filePath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions(['-preset fast', '-crf 22', '-movflags +faststart'])
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(tempMp4Path)
      })

      const form = new FormData()
      const filename = path.basename(tempMp4Path)
      const fileStream = fs.createReadStream(tempMp4Path)
      const fileStats = fs.statSync(tempMp4Path)
      
      form.append('media_file', fileStream, {
        filename: filename,
        contentType: 'video/mp4',
        knownLength: fileStats.size
      })
      
      form.append('title', title)

      if (description) {
        form.append('description', description)
      }

      form.append('state', isPublic ? 'public' : 'private')

      if (category) {
        form.append('category', category)
      }

      const response = await fetch(`${this.serverUrl}/api/v1/media`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${this.token}`,
          ...form.getHeaders()
        },
        body: form
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Upload failed: ${response.status} ${errorText}`)
      }

      const data = await response.json()

      try {
        const tempMp4Path = filePath.replace('.webm', '_converted.mp4')
        if (fs.existsSync(tempMp4Path)) {
          fs.unlinkSync(tempMp4Path)
        }
      } catch (cleanupError) {
        console.warn('Could not cleanup temp file:', cleanupError)
      }

      return {
        success: true,
        url: data.url || `${this.serverUrl}/media/${data.friendly_token}`,
        mediaId: data.friendly_token,
        title: data.title
      }
    } catch (error) {
      console.error('Upload error:', error)
      
      try {
        const tempMp4Path = filePath.replace('.webm', '.mp4')
        if (fs.existsSync(tempMp4Path)) {
          fs.unlinkSync(tempMp4Path)
        }
      } catch (cleanupError) {
        console.warn('Could not cleanup temp file:', cleanupError)
      }
      
      throw error
    }
  }

  async getCategories() {
    if (!this.isAuthenticated()) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const response = await fetch(`${this.serverUrl}/api/v1/categories`, {
        headers: {
          Authorization: `Token ${this.token}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.status}`)
      }

      const data = await response.json()

      return {
        success: true,
        categories: data.results || data
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  getConfig() {
    return {
      serverUrl: this.serverUrl,
      username: this.username,
      isAuthenticated: this.isAuthenticated()
    }
  }
}

module.exports = MediaCMSService
