class VideoEditorHandler {
  constructor() {
    this.videoBlob = null
    this.videoUrl = null
    this.videoDuration = 0
    this.isPreviewingSelection = false

    this.videoEl = document.getElementById('editorPreviewVideo')
    this.startRange = document.getElementById('trimStartRange')
    this.endRange = document.getElementById('trimEndRange')
    this.startInput = document.getElementById('trimStartInput')
    this.endInput = document.getElementById('trimEndInput')
    this.totalDurationLabel = document.getElementById('totalDurationLabel')
    this.trimWindowLabel = document.getElementById('trimWindowLabel')
    this.applyTrimBtn = document.getElementById('applyTrimBtn')
    this.cancelEditBtn = document.getElementById('cancelEditBtn')
    this.previewTrimBtn = document.getElementById('previewTrimBtn')
    this.errorBox = document.getElementById('editorError')

    this.bindEvents()
    this.loadVideo()
  }

  bindEvents() {
    this.startRange.addEventListener('input', () => {
      const start = Number(this.startRange.value)
      const end = Number(this.endRange.value)
      if (start >= end) {
        this.startRange.value = Math.max(0, end - 0.1)
      }
      this.stopPreviewSelection()
      this.videoEl.currentTime = Number(this.startRange.value)
      this.updateLabels()
    })

    this.endRange.addEventListener('input', () => {
      const start = Number(this.startRange.value)
      const end = Number(this.endRange.value)
      if (end <= start) {
        this.endRange.value = Math.min(this.videoDuration, start + 0.1)
      }
      this.stopPreviewSelection()
      this.videoEl.currentTime = Number(this.endRange.value)
      this.updateLabels()
    })

    this.startInput.addEventListener('change', () => {
      this.applyManualTime('start')
    })
    this.startInput.addEventListener('blur', () => {
      this.applyManualTime('start')
    })

    this.endInput.addEventListener('change', () => {
      this.applyManualTime('end')
    })
    this.endInput.addEventListener('blur', () => {
      this.applyManualTime('end')
    })

    this.applyTrimBtn.addEventListener('click', () => this.applyTrim())
    this.cancelEditBtn.addEventListener('click', () => this.closeEditor())
    this.previewTrimBtn.addEventListener('click', () => this.togglePreviewSelection())

    this.videoEl.addEventListener('timeupdate', () => {
      if (!this.isPreviewingSelection) {
        return
      }

      const { end } = this.getTrimRange()
      if (this.videoEl.currentTime >= end) {
        this.videoEl.pause()
        this.videoEl.currentTime = end
        this.stopPreviewSelection()
      }
    })

    this.videoEl.addEventListener('loadedmetadata', () => {
      if (!this.videoDuration || !Number.isFinite(this.videoDuration)) {
        this.videoDuration = Number(this.videoEl.duration) || 0
        this.initializeRanges()
      }
    })
  }

  async loadVideo() {
    try {
      const options = window.electronAPI?.getVideoEditorOptions?.() || {}
      if (window.electronAPI && window.electronAPI.onInitVideoEditorOptions) {
        window.electronAPI.onInitVideoEditorOptions(data => {
          if (data && data.duration && !this.videoDuration) {
            this.videoDuration = Number(data.duration) || 0
          }
        })
      }

      const data = await window.electronAPI.getMainWindowData()
      const videoBlob = data && (data.recordedVideoBlob || data.videoBlob)
      const dataDuration = data && Number(data.recordedDuration)

      if (!videoBlob) {
        this.showError('No video was found to edit.')
        this.applyTrimBtn.disabled = true
        return
      }

      this.videoBlob = videoBlob
      this.videoDuration = Number.isFinite(dataDuration) && dataDuration > 0 ? dataDuration : Number(options.duration) || 0
      this.videoUrl = URL.createObjectURL(new Blob([videoBlob], { type: 'video/mp4' }))
      this.videoEl.src = this.videoUrl

      this.initializeRanges()
    } catch (error) {
      this.showError('Failed to load the recorded video.')
      this.applyTrimBtn.disabled = true
    }
  }

  initializeRanges() {
    const max = this.videoDuration > 0 ? this.videoDuration : 0
    this.startRange.max = String(max)
    this.endRange.max = String(max)
    this.startRange.value = '0'
    this.endRange.value = String(max)
    this.updateLabels()
  }

  updateLabels() {
    const start = Number(this.startRange.value)
    const end = Number(this.endRange.value)
    const duration = Math.max(0, end - start)

    this.startInput.value = this.formatTime(start)
    this.endInput.value = this.formatTime(end)
    this.totalDurationLabel.textContent = `Total: ${this.formatTime(this.videoDuration)}`
    this.trimWindowLabel.textContent = `Trim: ${this.formatTime(start)} to ${this.formatTime(end)} (${this.formatTime(duration)})`
  }

  applyManualTime(target) {
    const isStart = target === 'start'
    const input = isStart ? this.startInput : this.endInput
    const parsedSeconds = this.parseTimeToSeconds(input.value)

    if (parsedSeconds == null) {
      this.showError('Use mm:ss format. Example: 01:30')
      this.updateLabels()
      return
    }

    this.showError('')
    const clamped = Math.min(this.videoDuration, Math.max(0, parsedSeconds))

    if (isStart) {
      this.startRange.value = String(clamped)
      if (Number(this.startRange.value) >= Number(this.endRange.value)) {
        const fixedStart = Math.max(0, Number(this.endRange.value) - 0.1)
        this.startRange.value = String(fixedStart)
      }
      this.videoEl.currentTime = Number(this.startRange.value)
    } else {
      this.endRange.value = String(clamped)
      if (Number(this.endRange.value) <= Number(this.startRange.value)) {
        const fixedEnd = Math.min(this.videoDuration, Number(this.startRange.value) + 0.1)
        this.endRange.value = String(fixedEnd)
      }
      this.videoEl.currentTime = Number(this.endRange.value)
    }

    this.stopPreviewSelection()
    this.updateLabels()
  }

  parseTimeToSeconds(value) {
    const input = String(value || '').trim()
    const match = input.match(/^(\d{1,2}):(\d{2})$/)
    if (!match) {
      return null
    }

    const minutes = Number(match[1])
    const seconds = Number(match[2])

    if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds < 0 || seconds > 59) {
      return null
    }

    return minutes * 60 + seconds
  }

  getTrimRange() {
    const start = Number(this.startRange.value)
    const end = Number(this.endRange.value)
    return {
      start: Number.isFinite(start) ? start : 0,
      end: Number.isFinite(end) ? end : 0
    }
  }

  async togglePreviewSelection() {
    if (this.isPreviewingSelection) {
      this.stopPreviewSelection()
      this.videoEl.pause()
      return
    }

    try {
      this.showError('')
      const { start, end } = this.getTrimRange()

      if (end <= start) {
        this.showError('End time must be greater than start time.')
        return
      }

      this.videoEl.pause()
      this.videoEl.currentTime = start
      this.isPreviewingSelection = true
      this.previewTrimBtn.textContent = 'Stop Preview'
      await this.videoEl.play()
    } catch (error) {
      this.stopPreviewSelection()
      this.showError('Could not play selection preview.')
    }
  }

  stopPreviewSelection() {
    this.isPreviewingSelection = false
    this.previewTrimBtn.textContent = 'Preview Selection'
  }

  formatTime(seconds) {
    const safeValue = Math.max(0, Number(seconds) || 0)
    const minutes = Math.floor(safeValue / 60)
    const secs = Math.floor(safeValue % 60)
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  async applyTrim() {
    try {
      this.showError('')
      this.stopPreviewSelection()
      this.videoEl.pause()

      const { start: startTime, end: endTime } = this.getTrimRange()

      if (endTime <= startTime) {
        this.showError('End time must be greater than start time.')
        return
      }

      this.applyTrimBtn.disabled = true
      this.applyTrimBtn.textContent = 'Applying...'

      const result = await window.electronAPI.trimRecordedVideo({ startTime, endTime })

      if (!result || !result.success) {
        throw new Error(result?.error || 'Unable to trim video')
      }

      await this.closeEditor()
    } catch (error) {
      this.showError(error.message || 'Failed to trim video.')
      this.applyTrimBtn.disabled = false
      this.applyTrimBtn.textContent = 'Apply Trim'
    }
  }

  async closeEditor() {
    try {
      this.stopPreviewSelection()
      this.videoEl.pause()
      if (window.electronAPI && window.electronAPI.closeVideoEditor) {
        await window.electronAPI.closeVideoEditor()
      } else {
        window.close()
      }
    } catch (error) {
      window.close()
    }
  }

  showError(message) {
    if (!message) {
      this.errorBox.classList.add('hidden')
      this.errorBox.textContent = ''
      return
    }

    this.errorBox.textContent = message
    this.errorBox.classList.remove('hidden')
  }

  cleanup() {
    if (this.videoUrl) {
      URL.revokeObjectURL(this.videoUrl)
      this.videoUrl = null
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.videoEditorHandler = new VideoEditorHandler()
})

window.addEventListener('beforeunload', () => {
  if (window.videoEditorHandler && typeof window.videoEditorHandler.cleanup === 'function') {
    window.videoEditorHandler.cleanup()
  }
})
