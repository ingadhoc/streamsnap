const { desktopCapturer, systemPreferences, dialog, globalShortcut } = require('electron')

class RecordingManager {
  constructor() {
    this.isRecording = false
    this.isPaused = false
    this.selectedSource = null
    this.recordedVideoData = null
    this.recordedVideoPath = null
    this.currentShortcuts = {}
    this.recordedVideoDuration = null
    this.platform = process.platform
  }

  async getDesktopSources() {
    try {
      if (this.platform === 'darwin') {
        await this.checkMacOSPermissions()
      }

      const allSources = []
      const { screen } = require('electron')
      const displays = screen.getAllDisplays()

      try {
        const sources1 = await desktopCapturer.getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 320, height: 180 },
          fetchWindowIcons: true
        })
        allSources.push(...sources1)
      } catch (e) {}

      try {
        const sources2 = await desktopCapturer.getSources({
          types: ['window'],
          thumbnailSize: { width: 150, height: 150 },
          fetchWindowIcons: true
        })

        sources2.forEach(source => {
          if (!allSources.find(existing => existing.id === source.id)) {
            allSources.push(source)
          }
        })
      } catch (e) {}

      const uniqueSources = []
      const seenIds = new Set()

      allSources.forEach(source => {
        if (!seenIds.has(source.id)) {
          seenIds.add(source.id)

          const isOwnWindow =
            source.name.includes('StreamSnap') ||
            source.name.includes('Select Recording Source') ||
            source.name.includes('streamsnap') ||
            source.name.includes('Save Recording') ||
            source.name.includes('Video Editor')

          if (!isOwnWindow) {
            uniqueSources.push(source)
          }
        }
      })

      // Separate screens and windows
      const screens = uniqueSources.filter(s => s.id.startsWith('screen:'))
      const windows = uniqueSources.filter(s => !s.id.startsWith('screen:'))

      const displayIndexById = new Map(displays.map((display, index) => [String(display.id), index]))
      const screenEntries = screens.map(source => ({
        source,
        displayId: source.display_id != null ? String(source.display_id) : null,
        hasDisplayMatch:
          source.display_id != null && displayIndexById.has(String(source.display_id))
      }))

      let orderedScreens = [...screenEntries]

      // Prefer display_id ordering when available. Keep Linux fallback reverse only when IDs are unavailable.
      if (orderedScreens.some(entry => entry.hasDisplayMatch)) {
        orderedScreens.sort((a, b) => {
          const aHas = a.hasDisplayMatch
          const bHas = b.hasDisplayMatch

          if (aHas && bHas) {
            return displayIndexById.get(a.displayId) - displayIndexById.get(b.displayId)
          }

          if (aHas) return -1
          if (bHas) return 1
          return 0
        })
      } else if (this.platform === 'linux') {
        // Linux fallback: desktopCapturer may return reverse order compared to display layout.
        orderedScreens = orderedScreens.reverse()
      }

      const serializedSources = []
      
      // Map screens with stable display metadata to avoid cross-display mismatches.
      orderedScreens.forEach((entry, index) => {
        const source = entry.source
        let thumbnailData = null

        if (source.thumbnail && !source.thumbnail.isEmpty()) {
          try {
            thumbnailData = {
              dataURL: source.thumbnail.toDataURL(),
              isEmpty: false
            }
          } catch (err) {
            thumbnailData = { isEmpty: true }
          }
        } else {
          thumbnailData = { isEmpty: true }
        }

        const resolvedDisplayIndex =
          entry.hasDisplayMatch && displayIndexById.has(entry.displayId)
            ? displayIndexById.get(entry.displayId)
            : index

        serializedSources.push({
          id: source.id,
          name: source.name,
          thumbnail: thumbnailData,
          display_index: resolvedDisplayIndex,
          display_id: entry.displayId
        })
      })

      // Add windows
      windows.forEach(source => {
        let thumbnailData = null

        if (source.thumbnail && !source.thumbnail.isEmpty()) {
          try {
            thumbnailData = {
              dataURL: source.thumbnail.toDataURL(),
              isEmpty: false
            }
          } catch (err) {
            thumbnailData = { isEmpty: true }
          }
        } else {
          thumbnailData = { isEmpty: true }
        }

        serializedSources.push({
          id: source.id,
          name: source.name,
          thumbnail: thumbnailData
        })
      })

      return serializedSources
    } catch (error) {
      throw error
    }
  }

  async checkMacOSPermissions() {
    try {
      const screenStatus = systemPreferences.getMediaAccessStatus('screen')

      const microphoneStatus = systemPreferences.getMediaAccessStatus('microphone')

      const cameraStatus = systemPreferences.getMediaAccessStatus('camera')

      const accessibilityTrusted = systemPreferences.isTrustedAccessibilityClient(false)

      if (
        screenStatus !== 'granted' ||
        microphoneStatus !== 'granted' ||
        cameraStatus !== 'granted' ||
        !accessibilityTrusted
      ) {
        let permissionDetails = `Please grant the following permissions in System Preferences > Security & Privacy > Privacy:\n\n`
        permissionDetails += `• Screen Recording: ${screenStatus}\n`
        permissionDetails += `• Microphone: ${microphoneStatus}\n`
        permissionDetails += `• Camera: ${cameraStatus}\n`
        permissionDetails += `• Accessibility: ${accessibilityTrusted ? 'granted' : 'denied'}\n\n`
        permissionDetails += `After granting permissions, please restart the app.\n\n`
        permissionDetails += `Note: Accessibility permission helps detect more application windows like Chrome, Safari, etc.`

        const result = await dialog.showMessageBox(null, {
          type: 'warning',
          title: 'Permissions Required',
          message: 'StreamSnap needs additional permissions to work properly.',
          detail: permissionDetails,
          buttons: ['Open System Preferences', 'Continue Anyway', 'Quit App'],
          defaultId: 0
        })

        if (result.response === 0) {
          require('child_process').exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy"')
        } else if (result.response === 2) {
          const { app } = require('electron')
          app.quit()
          return
        }

        try {
          if (screenStatus !== 'granted') {
            await systemPreferences.askForMediaAccess('screen')
          }
          if (microphoneStatus !== 'granted') {
            await systemPreferences.askForMediaAccess('microphone')
          }
          if (cameraStatus !== 'granted') {
            await systemPreferences.askForMediaAccess('camera')
          }
          if (!accessibilityTrusted) {
            systemPreferences.isTrustedAccessibilityClient(true)
          }
        } catch (err) {}
      }
    } catch (error) {
      throw error
    }
  }

  setSelectedSource(source) {
    this.selectedSource = source
  }

  startRecording() {
    if (this.isRecording) {
      throw new Error('Recording is already in progress')
    }

    this.isRecording = true
    this.isPaused = false
    this.registerRecordingShortcuts()
  }

  pauseRecording() {
    if (!this.isRecording) {
      throw new Error('No recording in progress')
    }

    this.isPaused = true
  }

  resumeRecording() {
    if (!this.isRecording) {
      throw new Error('No recording in progress')
    }

    this.isPaused = false
  }

  stopRecording() {
    if (!this.isRecording) {
      return
    }

    this.isRecording = false
    this.isPaused = false
    this.unregisterShortcuts()
  }

  setRecordedVideoData(data) {
    this.recordedVideoData = data
  }

  setRecordedVideoPath(path) {
    this.recordedVideoPath = path
  }

  getRecordedVideoPath() {
    return this.recordedVideoPath
  }

  setRecordedVideoDuration(seconds) {
    try {
      const s = typeof seconds === 'string' ? Number(seconds) : seconds
      if (isFinite(s) && !isNaN(s) && s >= 0) {
        this.recordedVideoDuration = Math.floor(s)
      }
    } catch (e) {}
  }

  getRecordedVideoDuration() {
    return this.recordedVideoDuration
  }

  getRecordedVideoData() {
    return this.recordedVideoData
  }

  clearRecordedVideoData() {
    this.recordedVideoData = null
    this.recordedVideoPath = null
    this.recordedVideoDuration = null
  }

  registerRecordingShortcuts() {
    if (!this.isRecording || !this.currentShortcuts) {
      return
    }

    globalShortcut.unregisterAll()

    try {
      if (this.currentShortcuts.pause && this.currentShortcuts.pause.trim()) {
        const pauseRegistered = globalShortcut.register(this.currentShortcuts.pause, () => {
          if (this.isRecording) {
            this.emitShortcutEvent('pause')
          }
        })
      }

      if (this.currentShortcuts.stop && this.currentShortcuts.stop.trim()) {
        const stopRegistered = globalShortcut.register(this.currentShortcuts.stop, () => {
          if (this.isRecording) {
            this.emitShortcutEvent('stop')
          }
        })
      }

      if (this.currentShortcuts.restart && this.currentShortcuts.restart.trim()) {
        const restartRegistered = globalShortcut.register(this.currentShortcuts.restart, () => {
          if (this.isRecording) {
            this.emitShortcutEvent('restart')
          }
        })
      }

      if (this.currentShortcuts.discard && this.currentShortcuts.discard.trim()) {
        const discardRegistered = globalShortcut.register(this.currentShortcuts.discard, () => {
          if (this.isRecording) {
            this.emitShortcutEvent('discard')
          }
        })
      }
    } catch (error) {}
  }

  unregisterShortcuts() {
    globalShortcut.unregisterAll()
  }

  updateShortcuts(shortcuts) {
    this.currentShortcuts = shortcuts

    if (this.isRecording) {
      this.registerRecordingShortcuts()
    }
  }

  emitShortcutEvent(action) {}

  getRecordingState() {
    return {
      isRecording: this.isRecording,
      isPaused: this.isPaused,
      hasSelectedSource: !!this.selectedSource,
      selectedSource: this.selectedSource,
      hasRecordedData: !!this.recordedVideoData
    }
  }

  validateRecordingPrerequisites() {
    const errors = []

    if (!this.selectedSource) {
      errors.push('No recording source selected')
    }

    if (this.isRecording) {
      errors.push('Recording is already in progress')
    }

    if (this.platform === 'darwin') {
      const screenStatus = systemPreferences.getMediaAccessStatus('screen')
      const microphoneStatus = systemPreferences.getMediaAccessStatus('microphone')

      if (screenStatus !== 'granted') {
        errors.push('Screen recording permission not granted on macOS')
      }

      if (microphoneStatus !== 'granted') {
        errors.push('Microphone permission not granted on macOS')
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  getRecordingStats() {
    return {
      platform: this.platform,
      recordingState: this.getRecordingState(),
      shortcuts: this.currentShortcuts,
      videoDataSize: this.recordedVideoData?.length || 0
    }
  }

  cleanup() {
    this.unregisterShortcuts()
    this.clearRecordedVideoData()
    this.isRecording = false
    this.isPaused = false
    this.selectedSource = null
  }
}

module.exports = RecordingManager
