class ScreenRecorder {
  constructor() {
    this.recordingState = new RecordingState()
    this.settingsManager = new SettingsManager()
    this.uiManager = new UIManager()
    this.keyboardShortcuts = null

    this.settingsManager.loadSettings()
    this.settingsManager.updateSaveFolderDisplay()

    this.initializeUI()
    this.setupEventListeners()
    this.registerGlobalShortcuts()

    if (window.electronAPI && window.electronAPI.onDriveAuthUpdated) {
      window.electronAPI.onDriveAuthUpdated(data => {
        this.handleDriveAuthUpdate(data)
      })
    }
  }

  handleDriveAuthUpdate(data) {
    try {
      if (data && (data.authenticated || data.accessToken || data.token)) {
        this.settingsManager.settings.driveEnabled = true
        this.settingsManager.settings.drive.accessToken = data.accessToken || data.access_token || data.token || ''
        this.settingsManager.saveSettings()
        this.updateDriveUI()
      } else {
        this.settingsManager.settings.driveEnabled = false
        this.settingsManager.settings.drive = { accessToken: '', folderId: '', folderName: '' }
        this.settingsManager.settings.driveAccessToken = ''
        this.settingsManager.settings.driveFolderId = ''
        this.settingsManager.settings.driveFolderName = ''
        this.settingsManager.saveSettings()
        this.updateDriveUI()
      }
    } catch (e) {}
  }

  registerGlobalShortcuts() {
    if (window.electronAPI.registerShortcuts) {
      const shortcuts = {}
      if (this.settingsManager.settings.startShortcut && this.settingsManager.settings.startShortcut.trim())
        shortcuts.start = this.settingsManager.settings.startShortcut
      if (this.settingsManager.settings.pauseShortcut && this.settingsManager.settings.pauseShortcut.trim())
        shortcuts.pause = this.settingsManager.settings.pauseShortcut
      if (this.settingsManager.settings.stopShortcut && this.settingsManager.settings.stopShortcut.trim())
        shortcuts.stop = this.settingsManager.settings.stopShortcut
      if (this.settingsManager.settings.discardShortcut && this.settingsManager.settings.discardShortcut.trim())
        shortcuts.discard = this.settingsManager.settings.discardShortcut
      window.electronAPI.registerShortcuts(shortcuts)
    }
  }

  initializeUI() {
    const startBtn = document.getElementById('startRecordingBtn')
    startBtn.addEventListener('click', () => this.openSourceSelector())
    this.uiManager.updateRecordingStatus('Ready to record', 'ready')
    this.setupSettingsControls()

    if (window.KeyboardShortcutsManager) {
      this.keyboardShortcuts = new window.KeyboardShortcutsManager(this)
      this.keyboardShortcuts.init()
    }
  }

  setupSettingsControls() {
    this.setupAudioControls()
    this.setupCountdownControls()
    this.setupFolderControls()
    this.setupDriveControls()
  }

  setupAudioControls() {
    document.getElementById('recordMicrophone').addEventListener('change', e => {
      this.settingsManager.settings.recordMicrophone = e.target.checked
      this.settingsManager.saveSettings()
    })

    document.getElementById('recordSystemAudio').addEventListener('change', e => {
      this.settingsManager.settings.recordSystemAudio = e.target.checked
      this.settingsManager.saveSettings()
    })

    document.getElementById('recordWebcam').addEventListener('change', e => {
      this.settingsManager.settings.recordWebcam = e.target.checked
      this.settingsManager.saveSettings()
    })

    document.getElementById('defaultRecordMicrophone').addEventListener('change', e => {
      this.settingsManager.settings.defaultRecordMicrophone = e.target.checked
      this.settingsManager.settings.recordMicrophone = e.target.checked
      document.getElementById('recordMicrophone').checked = e.target.checked
      this.settingsManager.saveSettings()
    })

    document.getElementById('defaultRecordSystemAudio').addEventListener('change', e => {
      this.settingsManager.settings.defaultRecordSystemAudio = e.target.checked
      this.settingsManager.settings.recordSystemAudio = e.target.checked
      document.getElementById('recordSystemAudio').checked = e.target.checked
      this.settingsManager.saveSettings()
    })

    document.getElementById('defaultRecordWebcam').addEventListener('change', e => {
      this.settingsManager.settings.defaultRecordWebcam = e.target.checked
      this.settingsManager.settings.recordWebcam = e.target.checked
      const recWebcamEl = document.getElementById('recordWebcam')
      if (recWebcamEl) recWebcamEl.checked = e.target.checked
      this.settingsManager.saveSettings()
    })
  }

  setupCountdownControls() {
    document.getElementById('enableCountdown').addEventListener('change', e => {
      this.settingsManager.settings.enableCountdown = e.target.checked
      this.settingsManager.saveSettings()
      this.settingsManager.updateCountdownOptionsVisibility()
    })

    document.getElementById('countdownDuration').addEventListener('change', e => {
      this.settingsManager.settings.countdownDuration = parseInt(e.target.value)
      this.settingsManager.saveSettings()
    })
  }

  setupFolderControls() {
    const browseFolderBtn = document.getElementById('browseFolderBtn')
    if (browseFolderBtn) {
      browseFolderBtn.addEventListener('click', async () => {
        try {
          const result = await window.electronAPI.selectFolder()
          if (result && result.folderPath) {
            this.settingsManager.settings.saveFolderPath = result.folderPath
            this.settingsManager.saveSettings()
            this.settingsManager.updateSaveFolderDisplay()
          }
        } catch (error) {}
      })
    }
  }

  setupDriveControls() {}

  async updateDriveUI() {
    const driveStatus = document.getElementById('driveStatus')
    if (driveStatus) {
      driveStatus.textContent = 'Manage your Google Drive accounts for cloud storage'
    }
  }

  async showCountdown() {
    return new Promise((resolve, reject) => {
      const options = {
        duration: this.settingsManager.settings.countdownDuration || 5
      }

      window.electronAPI
        .showCountdown(options)
        .then(() => {
          const countdownDuration = (this.settingsManager.settings.countdownDuration || 5) * 1000
          setTimeout(() => {
            resolve()
          }, countdownDuration + 500)
        })
        .catch(error => {
          reject(error)
        })
    })
  }

  setupEventListeners() {
    window.electronAPI.onStopRecording &&
      window.electronAPI.onStopRecording(() => {
        this.stopRecording(true)
      })

    window.electronAPI.onPauseRecording &&
      window.electronAPI.onPauseRecording(() => {
        this.pauseRecording()
      })

    window.electronAPI.onResumeRecording &&
      window.electronAPI.onResumeRecording(() => {
        this.resumeRecording()
      })

    window.electronAPI.onDiscardRecording &&
      window.electronAPI.onDiscardRecording(() => {
        this.recordingState.isDiscarding = true
        this.recordingState.recordedChunks = []

        if (this.recordingState.mediaRecorder && this.recordingState.mediaRecorder.state !== 'inactive') {
          this.recordingState.mediaRecorder.ondataavailable = null
          this.recordingState.mediaRecorder.onstop = null
        }

        this.uiManager.updateRecordingStatus('Recording discarded', 'ready')
        this.uiManager.enableStartButton()
      })

    window.electronAPI.onShortcutPause &&
      window.electronAPI.onShortcutPause(() => {
        if (this.recordingState.isPaused) this.resumeRecording()
        else this.pauseRecording()
      })

    window.electronAPI.onShortcutStop &&
      window.electronAPI.onShortcutStop(() => {
        this.stopRecording()
      })

    window.electronAPI.onShortcutDiscard &&
      window.electronAPI.onShortcutDiscard(() => {
        this.discardRecording()
      })

    if (window.electronAPI.onDriveUploadDone) {
      window.electronAPI.onDriveUploadDone((_e, payload) => {
        if (payload?.success) {
          this.uiManager.updateRecordingStatus(`Uploaded to ${payload.uploadedCount} Drive account(s)`, 'complete')

          if (payload.totalAccounts > 1 || payload.uploadedCount > 1) {
            this.showMultiAccountSuccessModal(payload)
          } else {
            this.uiManager.showDriveSuccessModal(payload)
          }
        } else {
          this.uiManager.updateRecordingStatus('Drive upload failed', 'ready')
        }
      })
    }
  }

  async openSourceSelector() {
    try {
      await window.electronAPI.openSourceSelector()
    } catch (error) {
      alert('Failed to open source selector')
    }
  }

  async startRecordingWithSource(source) {
    try {
      this.recordingState.reset()
      this.recordingState.selectedSource = source

      if (this.settingsManager.settings.enableCountdown) {
        try {
          await this.showCountdown()
        } catch (error) {
          return
        }
      }

      const finalStream = await this.createMediaStream(source)
      if (!finalStream) {
        throw new Error('Failed to create media stream')
      }

      this.recordingState.stream = finalStream
      this.setupMediaRecorder(finalStream)

      this.recordingState.mediaRecorder.start(1000)
      this.recordingState.startTimer()
      this.recordingState.isRecording = true

      this.uiManager.updateRecordingStatus('Recording...', 'recording')
      this.uiManager.disableStartButton()

      await window.electronAPI.startRecording()
    } catch (error) {
      this.uiManager.updateRecordingStatus('Error starting recording', 'ready')
      this.recordingState.cleanup()
      this.showRecordingError(error)
    }
  }

  async createMediaStream(source) {
    const wantsMicrophone = this.settingsManager.settings.recordMicrophone
    const wantsSystemAudio = this.settingsManager.settings.recordSystemAudio

    if (!wantsMicrophone && !wantsSystemAudio) {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id
          }
        }
      })
    }

    if (wantsMicrophone && !wantsSystemAudio) {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id
          }
        }
      })

      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        return new MediaStream([...videoStream.getVideoTracks(), ...micStream.getAudioTracks()])
      } catch (micError) {
        alert('Microphone access denied. Recording video only.')
        return videoStream
      }
    }

    if (!wantsMicrophone && wantsSystemAudio) {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id
          }
        },
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id
          }
        }
      })
    }

    const displayStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id
        }
      }
    })

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      return this.mixAudioStreams(displayStream, micStream)
    } catch (micError) {
      alert('Microphone access denied. Recording with system audio only.')
      return displayStream
    }
  }

  mixAudioStreams(displayStream, micStream) {
    if (!displayStream.getAudioTracks().length) {
      return displayStream
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) {
        throw new Error('AudioContext not supported')
      }

      const audioContext = new AudioContextClass()
      const destination = audioContext.createMediaStreamDestination()

      const systemSource = audioContext.createMediaStreamSource(new MediaStream([displayStream.getAudioTracks()[0]]))
      const systemGain = audioContext.createGain()
      systemGain.gain.value = 0.7
      systemSource.connect(systemGain).connect(destination)

      const micSource = audioContext.createMediaStreamSource(micStream)
      const micGain = audioContext.createGain()
      micGain.gain.value = 1.0
      micSource.connect(micGain).connect(destination)

      this.recordingState.audioContext = audioContext

      return new MediaStream([...displayStream.getVideoTracks(), ...destination.stream.getAudioTracks()])
    } catch (mixError) {
      return displayStream
    }
  }

  setupMediaRecorder(stream) {
    let options = { videoBitsPerSecond: 2500000 }
    
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
      options.mimeType = 'video/webm;codecs=vp9,opus'
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
      options.mimeType = 'video/webm;codecs=vp8,opus'
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
      options.mimeType = 'video/webm;codecs=h264'
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      options.mimeType = 'video/webm'
    }

    this.recordingState.mediaRecorder = new MediaRecorder(stream, options)
    this.recordingState.recordedChunks = []

    this.recordingState.mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) this.recordingState.recordedChunks.push(event.data)
    }

    this.recordingState.mediaRecorder.onstop = () => {
      this.handleRecordingStop()
    }

    this.recordingState.mediaRecorder.onerror = event => {}

    stream.getVideoTracks()[0].addEventListener('ended', () => {
      this.stopRecording()
    })
  }

  pauseRecording() {
    if (this.recordingState.mediaRecorder && this.recordingState.isRecording && !this.recordingState.isPaused) {
      this.recordingState.mediaRecorder.pause()
      this.recordingState.isPaused = true
      this.recordingState.pauseTimer()
      this.uiManager.updateRecordingStatus('Recording paused', 'ready')
      if (window.electronAPI.pauseRecording) window.electronAPI.pauseRecording()
    }
  }

  resumeRecording() {
    if (this.recordingState.mediaRecorder && this.recordingState.isRecording && this.recordingState.isPaused) {
      this.recordingState.mediaRecorder.resume()
      this.recordingState.resumeTimer()
      this.recordingState.isPaused = false
      this.uiManager.updateRecordingStatus('Recording...', 'recording')
      if (window.electronAPI.resumeRecording) window.electronAPI.resumeRecording()
    }
  }

  async stopRecording(fromFloatingWindow = false) {
    if (this.recordingState.mediaRecorder && this.recordingState.isRecording) {
      this.recordingState.mediaRecorder.stop()
      this.recordingState.isRecording = false
      this.recordingState.isPaused = false

      this.recordingState.stream.getTracks().forEach(track => {
        track.stop()
      })

      this.recordingState.cleanup()

      if (!fromFloatingWindow) {
        await window.electronAPI.stopRecording()
      }
    }
  }

  async discardRecording() {
    if (this.recordingState.mediaRecorder && this.recordingState.isRecording) {
      this.recordingState.isDiscarding = true
      this.recordingState.recordedChunks = []

      this.recordingState.isRecording = false
      this.recordingState.isPaused = false

      if (this.recordingState.mediaRecorder.state !== 'inactive') {
        this.recordingState.mediaRecorder.onstop = null
        this.recordingState.mediaRecorder.stop()
      }

      if (this.recordingState.stream) {
        this.recordingState.stream.getTracks().forEach(track => {
          track.stop()
        })
      }

      this.recordingState.cleanup()
      this.recordingState.reset()

      this.uiManager.updateRecordingStatus('Ready to record', 'ready')
      this.uiManager.enableStartButton()

      try {
        await window.electronAPI.discardRecording()
        await window.electronAPI.showMainWindow()
      } catch (error) {}
    }
  }

  async handleRecordingStop() {
    if (this.recordingState.isDiscarding) {
      this.recordingState.isDiscarding = false
      this.recordingState.recordedChunks = []
      this.uiManager.updateRecordingStatus('Recording discarded', 'ready')
      this.uiManager.enableStartButton()
      return
    }

    if (this.recordingState.recordedChunks.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 500))

      if (this.recordingState.recordedChunks.length === 0) {
        this.uiManager.updateRecordingStatus('Recording discarded - no data captured', 'ready')
        this.uiManager.enableStartButton()
        return
      }
    }

    try {
      const mimeType = this.recordingState.mediaRecorder ? this.recordingState.mediaRecorder.mimeType : 'video/webm'
      const blob = new Blob(this.recordingState.recordedChunks, { type: mimeType })

      const computedDurationSeconds = this.recordingState.getDuration()
      let includedDuration = computedDurationSeconds

      if (includedDuration == null) {
        try {
          const durRes = await window.electronAPI.getRecordedDuration()
          if (durRes && durRes.success && typeof durRes.duration !== 'undefined') {
            includedDuration = durRes.duration
          }
        } catch (e) {}
      }

      const arrayBuffer = await blob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      const result = await window.electronAPI.saveRecordedVideoToTemp(uint8Array, includedDuration)

      if (!result || !result.success) {
        throw new Error(result?.error || 'Failed to save recording')
      }

      this.uiManager.updateRecordingStatus('Recording complete', 'complete')
      this.uiManager.enableStartButton()
    } catch (error) {
      this.uiManager.updateRecordingStatus('Error saving recording', 'ready')
      this.uiManager.enableStartButton()
      alert(
        `Failed to save recording: ${error.message || 'Unknown error'}\n\nPlease try again or contact support if the issue persists.`
      )
    }
  }

  getRecordingState() {
    return this.recordingState.getState()
  }

  showRecordingError(error) {
    let errorMessage = 'Failed to start recording'
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Permission denied. Please allow screen recording and microphone access.'
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'No recording source found. Please select a screen or window.'
    } else if (error.name === 'AbortError') {
      errorMessage = 'Recording was cancelled.'
    }

    alert(`${errorMessage}\n\nDetails: ${error.message}`)
  }

  showMultiAccountSuccessModal(payload) {}
}

document.addEventListener('DOMContentLoaded', () => {
  window.screenRecorder = new ScreenRecorder()
})

window.recorderAPI = {
  pause: () => window.screenRecorder?.pauseRecording(),
  resume: () => window.screenRecorder?.resumeRecording(),
  stop: () => window.screenRecorder?.stopRecording(),
  getState: () => window.screenRecorder?.getRecordingState(),
  startWithSource: source => window.screenRecorder?.startRecordingWithSource(source)
}
