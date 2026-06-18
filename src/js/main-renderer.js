class ScreenRecorder {
  constructor() {
    this.recordingState = new RecordingState()
    this.settingsManager = new SettingsManager()
    this.uiManager = new UIManager()
    this.historyManager = new window.HistoryManager()
    this.keyboardShortcuts = null
    this.driveAutoSaveAccounts = []
    this.micStream = null
    this.micAnalyser = null
    this.micAnimationFrame = null
    this.webcamStream = null
    this.availableAudioInputs = []
    this.availableVideoInputs = []
    this._onMediaDeviceChange = null

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
      if (this.settingsManager.settings.restartShortcut && this.settingsManager.settings.restartShortcut.trim())
        shortcuts.restart = this.settingsManager.settings.restartShortcut
      if (this.settingsManager.settings.discardShortcut && this.settingsManager.settings.discardShortcut.trim())
        shortcuts.discard = this.settingsManager.settings.discardShortcut
      window.electronAPI.registerShortcuts(shortcuts)
    }
  }

  initializeUI() {
    const startBtn = document.getElementById('startRecordingBtn')
    startBtn.addEventListener('click', () => this.openSourceSelector())
    this.uiManager.updateRecordingStatus('Ready to record', 'ready')
    this.historyManager.init()
    this.setupSettingsControls()

    if (window.KeyboardShortcutsManager) {
      this.keyboardShortcuts = new window.KeyboardShortcutsManager(this)
      this.keyboardShortcuts.init()
    }

    // Show mic/webcam tests if already enabled (either current session or default)
    if (this.settingsManager.settings.recordMicrophone || this.settingsManager.settings.defaultRecordMicrophone) {
      this.showMicTest()
    }
    if (this.settingsManager.settings.recordWebcam || this.settingsManager.settings.defaultRecordWebcam) {
      this.showWebcamTest()
    }
  }

  setupSettingsControls() {
    this.setupGeneralControls()
    this.setupAudioControls()

    this.setupCountdownControls()
    this.setupFolderControls()
    this.setupDriveControls()
  }

  setupGeneralControls() {
    const launchOnStartupEl = document.getElementById('launchOnStartup')
    if (launchOnStartupEl) {
      // Sync toggle with real OS state on load
      if (window.electronAPI && window.electronAPI.getLaunchOnStartup) {
        window.electronAPI.getLaunchOnStartup().then(result => {
          if (result && typeof result.enabled === 'boolean') {
            launchOnStartupEl.checked = result.enabled
            this.settingsManager.settings.launchOnStartup = result.enabled
          }
        }).catch(() => {})
      }

      launchOnStartupEl.addEventListener('change', e => {
        this.settingsManager.settings.launchOnStartup = e.target.checked
        this.settingsManager.saveSettings()
        if (window.electronAPI && window.electronAPI.setLaunchOnStartup) {
          window.electronAPI.setLaunchOnStartup(e.target.checked)
        }
      })
    }
  }

  setupAudioControls() {
    document.getElementById('recordMicrophone').addEventListener('change', e => {
      this.settingsManager.settings.recordMicrophone = e.target.checked
      this.settingsManager.saveSettings()
      
      // Show/hide and start/stop mic test
      if (e.target.checked) {
        this.showMicTest()
      } else {
        this.hideMicTest()
      }
    })

    document.getElementById('recordSystemAudio').addEventListener('change', e => {
      this.settingsManager.settings.recordSystemAudio = e.target.checked
      this.settingsManager.saveSettings()
    })

    document.getElementById('recordWebcam').addEventListener('change', e => {
      this.settingsManager.settings.recordWebcam = e.target.checked
      this.settingsManager.saveSettings()
      
      // Show/hide webcam preview
      if (e.target.checked) {
        this.showWebcamTest()
      } else {
        this.hideWebcamTest()
      }
    })

    document.getElementById('defaultRecordMicrophone').addEventListener('change', e => {
      this.settingsManager.settings.defaultRecordMicrophone = e.target.checked
      this.settingsManager.settings.recordMicrophone = e.target.checked
      document.getElementById('recordMicrophone').checked = e.target.checked
      this.settingsManager.saveSettings()
      if (e.target.checked) {
        this.showMicTest()
      } else {
        this.hideMicTest()
      }
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
      if (e.target.checked) {
        this.showWebcamTest()
      } else {
        this.hideWebcamTest()
      }
    })

    this.initializeMediaDeviceControls()
  }

  async initializeMediaDeviceControls() {
    const micSelect = document.getElementById('micDeviceSelect')
    const webcamSelect = document.getElementById('webcamDeviceSelect')
    const refreshBtn = document.getElementById('refreshMediaDevicesBtn')

    if (micSelect && !micSelect.dataset.bound) {
      micSelect.dataset.bound = 'true'
      micSelect.addEventListener('change', async e => {
        this.settingsManager.settings.preferredMicrophoneId = e.target.value || 'default'
        this.settingsManager.saveSettings()
        this.updateDeviceHints()

        if (this.settingsManager.settings.recordMicrophone) {
          await this.showMicTest(true)
        }
      })
    }

    if (webcamSelect && !webcamSelect.dataset.bound) {
      webcamSelect.dataset.bound = 'true'
      webcamSelect.addEventListener('change', async e => {
        this.settingsManager.settings.preferredWebcamId = e.target.value || 'default'
        this.settingsManager.saveSettings()
        this.updateDeviceHints()

        if (this.settingsManager.settings.recordWebcam) {
          await this.showWebcamTest(true)
        }
      })
    }

    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = 'true'
      refreshBtn.addEventListener('click', async () => {
        await this.refreshMediaDevices({ requestPermission: true })
      })
    }

    if (!this._onMediaDeviceChange && navigator.mediaDevices?.addEventListener) {
      this._onMediaDeviceChange = () => {
        this.refreshMediaDevices({ requestPermission: false })
      }
      navigator.mediaDevices.addEventListener('devicechange', this._onMediaDeviceChange)
    }

    await this.refreshMediaDevices({ requestPermission: false })
  }

  async refreshMediaDevices({ requestPermission = false } = {}) {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return
    }

    if (requestPermission) {
      await this.warmMediaPermissions()
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      this.availableAudioInputs = devices.filter(device => {
        if (device.kind !== 'audioinput') return false
        const id = String(device.deviceId || '').toLowerCase()
        return id !== 'default' && id !== 'communications'
      })
      this.availableVideoInputs = devices.filter(device => {
        if (device.kind !== 'videoinput') return false
        const id = String(device.deviceId || '').toLowerCase()
        return id !== 'default'
      })

      this.populateDeviceSelect(
        'micDeviceSelect',
        this.availableAudioInputs,
        this.settingsManager.settings.preferredMicrophoneId,
        'System default microphone',
        'No microphones found'
      )
      this.populateDeviceSelect(
        'webcamDeviceSelect',
        this.availableVideoInputs,
        this.settingsManager.settings.preferredWebcamId,
        'System default camera',
        'No webcams found'
      )
      this.updateDeviceHints()
    } catch (error) {}
  }

  populateDeviceSelect(selectId, devices, preferredId, defaultLabel, emptyLabel) {
    const select = document.getElementById(selectId)
    if (!select) return

    const selectedBefore = preferredId || select.value || 'default'
    const hasDefaultOption = devices.length > 0
    const defaultOption = `<option value="default">${defaultLabel}</option>`
    const deviceOptions = devices
      .map((device, index) => {
        const fallbackName = `${defaultLabel.replace('System default ', '')} ${index + 1}`
        const label = (device.label || fallbackName).replace(/</g, '&lt;').replace(/>/g, '&gt;')
        return `<option value="${device.deviceId}">${label}</option>`
      })
      .join('')

    select.innerHTML = hasDefaultOption ? `${defaultOption}${deviceOptions}` : `<option value="default">${emptyLabel}</option>`
    select.disabled = !hasDefaultOption

    const hasPreferred = selectedBefore === 'default' || devices.some(device => device.deviceId === selectedBefore)
    select.value = hasPreferred ? selectedBefore : 'default'
    // Do NOT write back to settings or call saveSettings() here — this runs on
    // every startup and devices may be unavailable before permissions are granted,
    // which would permanently overwrite the user's saved device preference.
  }

  updateDeviceHints() {
    const micHint = document.getElementById('micDeviceHint')
    const webcamHint = document.getElementById('webcamDeviceHint')
    const micSelect = document.getElementById('micDeviceSelect')
    const webcamSelect = document.getElementById('webcamDeviceSelect')

    if (micHint && micSelect) {
      const label = micSelect.options[micSelect.selectedIndex]?.text || 'System default microphone'
      micHint.textContent = `Default: ${label}`
    }

    if (webcamHint && webcamSelect) {
      const label = webcamSelect.options[webcamSelect.selectedIndex]?.text || 'System default camera'
      webcamHint.textContent = `Default: ${label}`
    }
  }

  async warmMediaPermissions() {
    const tracks = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      tracks.push(...stream.getTracks())
    } catch (error) {
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true })
        tracks.push(...audioOnly.getTracks())
      } catch (audioErr) {}

      try {
        const videoOnly = await navigator.mediaDevices.getUserMedia({ video: true })
        tracks.push(...videoOnly.getTracks())
      } catch (videoErr) {}
    }

    tracks.forEach(track => {
      try {
        track.stop()
      } catch (e) {}
    })
  }

  getPreferredMicrophoneConstraints() {
    const preferredMic = this.settingsManager.settings.preferredMicrophoneId || 'default'
    const constraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
      sampleRate: 44100
    }

    if (preferredMic && preferredMic !== 'default') {
      constraints.deviceId = { exact: preferredMic }
    }

    return constraints
  }

  getPreferredWebcamConstraints() {
    const preferredCam = this.settingsManager.settings.preferredWebcamId || 'default'
    const constraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user'
    }

    if (preferredCam && preferredCam !== 'default') {
      constraints.deviceId = { exact: preferredCam }
    }

    return constraints
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

  setupDriveControls() {
    const manageDriveAccountsBtn = document.getElementById('manageDriveAccountsBtn')
    const driveAutoSaveEnabledEl = document.getElementById('driveAutoSaveEnabled')

    if (manageDriveAccountsBtn) {
      manageDriveAccountsBtn.addEventListener('click', async () => {
        try {
          await window.electronAPI.driveAccountsOpen()
          setTimeout(() => this.loadDriveAutoSaveAccounts(), 300)
        } catch (e) {}
      })
    }

    if (driveAutoSaveEnabledEl) {
      driveAutoSaveEnabledEl.addEventListener('change', e => {
        this.settingsManager.settings.driveAutoSaveEnabled = e.target.checked
        this.settingsManager.saveSettings()
        this.updateDriveAutoSaveAccountsState()
      })
    }

    if (window.electronAPI && window.electronAPI.onDriveAccountsUpdated) {
      window.electronAPI.onDriveAccountsUpdated(() => {
        this.loadDriveAutoSaveAccounts()
      })
    }

    if (window.electronAPI && window.electronAPI.onDriveAccountsChanged) {
      window.electronAPI.onDriveAccountsChanged(() => {
        this.loadDriveAutoSaveAccounts()
      })
    }

    this.loadDriveAutoSaveAccounts()
  }

  async updateDriveUI() {
    const driveStatus = document.getElementById('driveStatus')
    if (driveStatus) {
      driveStatus.textContent = 'Manage your Google Drive accounts for cloud storage'
    }
  }

  updateDriveAutoSaveAccountsState() {
    const enabled = this.settingsManager.settings.driveAutoSaveEnabled === true
    const container = document.getElementById('driveAutoSaveAccountsContainer')
    const list = document.getElementById('driveAutoSaveAccountsList')

    if (container) {
      container.style.opacity = enabled ? '1' : '0.6'
    }

    if (list) {
      list.querySelectorAll('input[type="checkbox"]').forEach(input => {
        const canSelect = input.getAttribute('data-can-select') === 'true'
        input.disabled = !enabled || !canSelect
      })
    }
  }

  async loadDriveAutoSaveAccounts() {
    const list = document.getElementById('driveAutoSaveAccountsList')
    if (!list) return

    try {
      const res = await window.electronAPI.driveAccountsGetActive()
      const accounts = (res && res.accounts) || []
      this.driveAutoSaveAccounts = Array.isArray(accounts) ? accounts : []

      const activeIds = new Set(this.driveAutoSaveAccounts.map(account => account.id))
      const savedIds = Array.isArray(this.settingsManager.settings.driveAutoSaveAccountIds)
        ? this.settingsManager.settings.driveAutoSaveAccountIds
        : []
      const validIds = savedIds.filter(id => activeIds.has(id))

      // Only persist the filtered list if we got a non-empty accounts response —
      // an empty list likely means accounts haven't loaded yet, not that they
      // were all removed, and saving an empty array would erase the user's config.
      if (accounts.length > 0 && validIds.length !== savedIds.length) {
        this.settingsManager.settings.driveAutoSaveAccountIds = validIds
        this.settingsManager.saveSettings()
      }

      this.renderDriveAutoSaveAccounts()
    } catch (error) {
      list.innerHTML = '<p class="text-sm text-red-500">Failed to load Drive accounts</p>'
      this.driveAutoSaveAccounts = []
      this.updateDriveAutoSaveAccountsState()
    }
  }

  renderDriveAutoSaveAccounts() {
    const list = document.getElementById('driveAutoSaveAccountsList')
    if (!list) return

    if (!Array.isArray(this.driveAutoSaveAccounts) || this.driveAutoSaveAccounts.length === 0) {
      list.innerHTML = '<p class="text-sm text-gray-500">No active Drive accounts. Use Manage Accounts first.</p>'
      this.updateDriveAutoSaveAccountsState()
      return
    }

    const selectedIds = new Set(this.settingsManager.settings.driveAutoSaveAccountIds || [])

    list.innerHTML = this.driveAutoSaveAccounts
      .map(account => {
        const name = account.email || account.displayName || 'Drive account'
        const hasFolder = !!account.defaultFolderId
        const folderName = account.defaultFolderName || 'No default folder configured'
        const checked = selectedIds.has(account.id)

        return `
          <label class="flex items-start gap-3 py-2 ${hasFolder ? '' : 'opacity-70'}">
            <input
              type="checkbox"
              class="mt-1"
              data-drive-auto-save-account-id="${account.id}"
              data-can-select="${hasFolder ? 'true' : 'false'}"
              ${checked ? 'checked' : ''}
              ${hasFolder ? '' : 'disabled'}
            />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-800 truncate">${name}</p>
              <p class="text-xs ${hasFolder ? 'text-gray-500' : 'text-amber-600'} truncate">Folder: ${folderName}</p>
            </div>
          </label>
        `
      })
      .join('')

    list.querySelectorAll('input[data-drive-auto-save-account-id]').forEach(input => {
      input.addEventListener('change', event => {
        const accountId = event.target.getAttribute('data-drive-auto-save-account-id')
        const currentIds = new Set(this.settingsManager.settings.driveAutoSaveAccountIds || [])

        if (event.target.checked) currentIds.add(accountId)
        else currentIds.delete(accountId)

        this.settingsManager.settings.driveAutoSaveAccountIds = Array.from(currentIds)
        this.settingsManager.saveSettings()
      })
    })

    this.updateDriveAutoSaveAccountsState()
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

    window.electronAPI.onShortcutRestart &&
      window.electronAPI.onShortcutRestart(() => {
        if (this.recordingState.isRecording) {
          window.electronAPI.restartRecording()
        }
      })

    if (window.electronAPI.onDriveUploadDone) {
      window.electronAPI.onDriveUploadDone((_e, payload) => {
        if (payload?.success) {
          this.uiManager.updateRecordingStatus(`Uploaded to ${payload.uploadedCount} Drive account(s)`, 'complete')

          if (payload.totalAccounts > 1 || payload.uploadedCount > 1) {
            this.showMultiAccountSuccessModal(payload)
          } else {
            this.uiManager.showUploadSuccessModal(payload)
          }
        } else {
          this.uiManager.updateRecordingStatus('Drive upload failed', 'ready')
        }
      })
    }

    if (window.electronAPI.onShowSavePanel) {
      window.electronAPI.onShowSavePanel(options => {
        window.__saveModalMode = true
        window.saveOptions = options
        const overlay = document.getElementById('savePanelOverlay')
        if (!overlay) return
        if (window.saveVideoHandler) {
          // Reset state for new recording
          window.saveVideoHandler.saveOptions = options
          window.saveVideoHandler.videoBlob = null
          window.saveVideoHandler.autoSaveSuccessModalShown = false
          window.saveVideoHandler.selectedAccounts = new Map()
          window.saveVideoHandler.selectedYouTubeAccounts = new Set()
          // Reset filename with new timestamp
          const now = new Date()
          const pad = n => String(n).padStart(2, '0')
          const dateStr = `${pad(now.getDate())}_${pad(now.getMonth() + 1)}_${now.getFullYear()}_${pad(now.getHours())}_${pad(now.getMinutes())}_${pad(now.getSeconds())}`
          const fileNameInput = document.getElementById('fileName')
          if (fileNameInput) fileNameInput.value = `StreamSnap_${dateStr}`
          window.saveVideoHandler.loadVideoData()
          window.saveVideoHandler.loadSaveOptions()
        } else {
          window.saveVideoHandler = new SaveVideoHandler()
        }
        overlay.classList.remove('hidden')
        // Close button inside the overlay
        const closeBtn = document.getElementById('savePanelCloseBtn')
        if (closeBtn && !closeBtn._hasOverlayListener) {
          closeBtn._hasOverlayListener = true
          closeBtn.addEventListener('click', () => overlay.classList.add('hidden'))
        }
      })
    }

    if (window.electronAPI.onShowSourceSelector) {
      window.electronAPI.onShowSourceSelector(() => {
        window.__sourceSelectorModalMode = true
        const overlay = document.getElementById('sourceSelectorOverlay')
        if (!overlay) return
        if (window.sourceSelector) {
          // Reset selection state for a fresh pick
          window.sourceSelector.selectedSource = null
          window.sourceSelector.isObserving = false
          document.getElementById('selectedInfo')?.classList.add('hidden')
          const startBtn = document.getElementById('ssSelectorStartBtn')
          if (startBtn) startBtn.disabled = true
          window.sourceSelector.loadSources()
          window.sourceSelector.startRealTimeDetection()
        } else {
          window.sourceSelector = new SourceSelector()
        }
        overlay.classList.remove('hidden')
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
      const captureSource = await this.resolveSourceForCapture(source)
      this.recordingState.selectedSource = captureSource

      if (this.settingsManager.settings.enableCountdown) {
        try {
          await this.showCountdown()
        } catch (error) {
          return
        }
      }

      const finalStream = await this.createMediaStream(captureSource)
      if (!finalStream) {
        throw new Error('Failed to create media stream')
      }

      this.recordingState.stream = finalStream
      await this.setupMediaRecorder(finalStream)

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

  async resolveSourceForCapture(source) {
    if (!source || !source.id || !source.id.startsWith('screen:') || !window.electronAPI?.getDesktopSources) {
      return source
    }

    try {
      const latestSources = await window.electronAPI.getDesktopSources()
      const latestScreens = latestSources.filter(s => s.id && s.id.startsWith('screen:'))

      let match = null

      if (source.display_id != null) {
        match = latestScreens.find(s => String(s.display_id) === String(source.display_id))
      }

      if (!match) {
        match = latestScreens.find(s => s.id === source.id)
      }

      if (!match && source.name) {
        match = latestScreens.find(s => s.name === source.name)
      }

      return match ? { ...source, ...match } : source
    } catch (error) {
      return source
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
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: this.getPreferredMicrophoneConstraints() })
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        if (!AudioContextClass) {
          return new MediaStream([...videoStream.getVideoTracks(), ...micStream.getAudioTracks()])
        }
        const audioContext = new AudioContext()
        const destination = audioContext.createMediaStreamDestination()
        const micSource = audioContext.createMediaStreamSource(micStream)
        const micGain = audioContext.createGain()
        micGain.gain.value = 2.0
        micSource.connect(micGain).connect(destination)
        this.recordingState.audioContext = audioContext
        return new MediaStream([...videoStream.getVideoTracks(), ...destination.stream.getAudioTracks()])
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
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: this.getPreferredMicrophoneConstraints() })
      return this.mixAudioStreams(displayStream, micStream)
    } catch (micError) {
      alert('Microphone access denied. Recording with system audio only.')
      return displayStream
    }
  }

  async createLinuxDisplayMediaStream({ wantsMicrophone, wantsSystemAudio }) {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: !!wantsSystemAudio
    })

    if (!wantsMicrophone) {
      if (!wantsSystemAudio && displayStream.getAudioTracks().length) {
        displayStream.getAudioTracks().forEach(track => track.stop())
      }
      return displayStream
    }

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: this.getPreferredMicrophoneConstraints() })

      if (wantsSystemAudio && displayStream.getAudioTracks().length) {
        return this.mixAudioStreams(displayStream, micStream)
      }

      return new MediaStream([...displayStream.getVideoTracks(), ...micStream.getAudioTracks()])
    } catch (micError) {
      if (!wantsSystemAudio && displayStream.getAudioTracks().length) {
        displayStream.getAudioTracks().forEach(track => track.stop())
        return new MediaStream([...displayStream.getVideoTracks()])
      }

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
      micGain.gain.value = 2.0
      micSource.connect(micGain).connect(destination)

      this.recordingState.audioContext = audioContext

      return new MediaStream([...displayStream.getVideoTracks(), ...destination.stream.getAudioTracks()])
    } catch (mixError) {
      return displayStream
    }
  }

  async setupMediaRecorder(stream) {
    // Always record with standard MediaRecorder (WebM).
    // WebCodecs H.264 on Linux silently produces zero frames on many GPU/driver
    // combinations, causing "no data captured" failures. WebM via MediaRecorder
    // works reliably across all platforms.
    let options = { videoBitsPerSecond: 2500000 }

    const webmTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264',
      'video/webm'
    ]

    const supportedType = webmTypes.find(type => MediaRecorder.isTypeSupported(type))
    if (supportedType) {
      options.mimeType = supportedType
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

      // Stream teardown and cleanup() are deferred to handleRecordingStop()
      // so that an async WebCodecs encoder/muxer can fully finalize before
      // the underlying tracks are stopped.

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
    // Tear down the stream now that recording is fully complete (or discarded).
    this.recordingState.cleanup()

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

      this.uiManager.updateRecordingStatus('Processing recording...', 'recording')
      this.uiManager.disableStartButton()

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

      const result = await window.electronAPI.saveRecordedVideoToTemp(uint8Array, includedDuration, { mimeType })

      if (window.__isMainWindow) {
        window.__currentRecordingData = {
            recordedVideoBlob: blob,
            recordedDuration: includedDuration,
            tempVideoPath: result?.tempPath
        };
      }

      if (!result || !result.success) {
        throw new Error(result?.error || 'Failed to save recording')
      }

      this.uiManager.hideConversionProgress()
      if (result.autoSaved) {
        this.uiManager.updateRecordingStatus(
          `Auto-saved to Drive (${result.uploadedCount || 0} account${result.uploadedCount === 1 ? '' : 's'})`,
          'complete'
        )
      } else if (result.autoSaveAttempted && result.autoSaveUploadedCount > 0) {
        this.uiManager.updateRecordingStatus('Auto-save partially completed. Review save options.', 'complete')
      } else {
        this.uiManager.updateRecordingStatus('Recording complete', 'complete')
      }
      this.uiManager.enableStartButton()
    } catch (error) {
      this.uiManager.hideConversionProgress()
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

  async showMicTest(forceRestart = false) {
    const container = document.getElementById('micTestContainer')
    if (!container) return

    if (forceRestart) {
      this.hideMicTest()
    }
    
    container.classList.remove('hidden')
    
    try {
      // Request microphone access
      this.micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: this.getPreferredMicrophoneConstraints()
      })
      
      // Set up audio analysis
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(this.micStream)
      this.micAnalyser = audioContext.createAnalyser()
      this.micAnalyser.fftSize = 64
      this.micAnalyser.smoothingTimeConstant = 0.8
      source.connect(this.micAnalyser)
      
      // Start visualization
      this.animateMicBars()
      
      document.getElementById('micStatus').textContent = '✓ Working'
      document.getElementById('micStatus').classList.remove('text-blue-600', 'text-sky-600', 'text-red-600', 'text-gray-500')
      document.getElementById('micStatus').classList.add('text-green-600')
      this.refreshMediaDevices({ requestPermission: false })
    } catch (error) {
      document.getElementById('micStatus').textContent = '✗ Error'
      document.getElementById('micStatus').classList.remove('text-blue-600', 'text-sky-600', 'text-green-600', 'text-gray-500')
      document.getElementById('micStatus').classList.add('text-red-600')
      console.error('Microphone access error:', error)
    }
  }

  hideMicTest() {
    const container = document.getElementById('micTestContainer')
    if (container) {
      container.classList.add('hidden')
    }
    
    // Stop animation
    if (this.micAnimationFrame) {
      cancelAnimationFrame(this.micAnimationFrame)
      this.micAnimationFrame = null
    }
    
    // Stop microphone stream
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop())
      this.micStream = null
    }
    
    this.micAnalyser = null
    const status = document.getElementById('micStatus')
    if (status) {
      status.textContent = 'Speak to test...'
      status.classList.remove('text-green-600', 'text-red-600', 'text-blue-600', 'text-sky-600', 'text-violet-600', 'text-purple-600')
      status.classList.add('text-gray-500')
    }
  }

  animateMicBars() {
    if (!this.micAnalyser) return
    
    const bars = document.querySelectorAll('.mic-bar')
    const dataArray = new Uint8Array(this.micAnalyser.frequencyBinCount)
    
    const animate = () => {
      if (!this.micAnalyser) return
      
      this.micAnalyser.getByteFrequencyData(dataArray)
      
      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      
      // Update bars based on frequency data
      bars.forEach((bar, index) => {
        const dataIndex = Math.floor(index * dataArray.length / bars.length)
        const value = dataArray[dataIndex] || 0
        
        // Scale the height (min 8px, max 48px)
        const height = Math.max(8, (value / 255) * 48)
        bar.style.height = `${height}px`
        
        // Add active class if there's significant audio
        if (value > 30) {
          bar.classList.add('active')
        } else {
          bar.classList.remove('active')
        }
      })
      
      this.micAnimationFrame = requestAnimationFrame(animate)
    }
    
    animate()
  }

  async showWebcamTest(forceRestart = false) {
    const container = document.getElementById('webcamTestContainer')
    const video = document.getElementById('webcamPreview')
    const status = document.getElementById('webcamStatus')
    
    if (!container || !video) return
    
    if (forceRestart) {
      this.hideWebcamTest()
    }

    container.classList.remove('hidden')

    try {
      // Request webcam access
      this.webcamStream = await navigator.mediaDevices.getUserMedia({ 
        video: this.getPreferredWebcamConstraints()
      })
      
      video.srcObject = this.webcamStream
      
      status.textContent = '✓ Working'
      status.style.color = '#22c55e'
      this.refreshMediaDevices({ requestPermission: false })
    } catch (error) {
      status.textContent = '✗ Error'
      status.style.color = '#ef4444'
      console.error('Webcam access error:', error)
    }
  }

  hideWebcamTest() {
    const container = document.getElementById('webcamTestContainer')
    const video = document.getElementById('webcamPreview')
    
    if (container) {
      container.classList.add('hidden')
    }

    // Stop webcam stream
    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach(track => track.stop())
      this.webcamStream = null
    }
    
    if (video) {
      video.srcObject = null
    }

    const status = document.getElementById('webcamStatus')
    if (status) {
      status.textContent = 'Loading...'
      status.style.color = ''
    }
  }

  showMultiAccountSuccessModal(payload) {}
}

async function ensureOverlayPage({ overlayId, contentId, rootAttribute, htmlPath, scriptPath, styleId }) {
  const overlay = document.getElementById(overlayId)
  const content = document.getElementById(contentId)
  if (!overlay || !content) {
    return null
  }

  if (!window.__overlayPageCache) {
    window.__overlayPageCache = new Map()
  }

  const cacheKey = `${overlayId}:${htmlPath}`

  if (!window.__overlayPageCache.has(cacheKey)) {
    window.__overlayPageCache.set(
      cacheKey,
      (async () => {
        const response = await fetch(htmlPath)
        if (!response.ok) {
          throw new Error(`Failed to load overlay template: ${htmlPath}`)
        }

        const html = await response.text()
        const doc = new DOMParser().parseFromString(html, 'text/html')

        if (styleId && !document.getElementById(styleId)) {
          const styleEl = document.createElement('style')
          styleEl.id = styleId
          styleEl.textContent = Array.from(doc.querySelectorAll('style'))
            .map(style => style.textContent || '')
            .join('\n')
          document.head.appendChild(styleEl)
        }

        Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).forEach(link => {
          const href = link.getAttribute('href')
          if (!href) return

          const resolvedHref = new URL(href, response.url).toString()
          if (document.querySelector(`link[data-overlay-href="${resolvedHref}"]`)) {
            return
          }

          const linkEl = document.createElement('link')
          linkEl.rel = 'stylesheet'
          linkEl.href = resolvedHref
          linkEl.dataset.overlayHref = resolvedHref
          document.head.appendChild(linkEl)
        })

        const bodyClone = doc.body.cloneNode(true)
        bodyClone.querySelectorAll('script').forEach(script => script.remove())

        content.innerHTML = `<div ${rootAttribute} class="w-full max-w-5xl">${bodyClone.innerHTML}</div>`

        const root = content.querySelector(`[${rootAttribute}]`)
        const pageShell = root?.querySelector('.page-shell')
        const heroPanel = root?.querySelector('.hero-panel')
        const accountsList = root?.querySelector('#accountsList')

        if (root && pageShell) {
          root.classList.add('overlay-accounts-root')
          pageShell.classList.add('overlay-accounts-shell')
        }

        if (heroPanel) {
          heroPanel.classList.add('overlay-accounts-hero')
        }

        if (accountsList) {
          accountsList.classList.add('overlay-accounts-list')
        }

        const closeBtn = root?.querySelector('#closeBtn')
        if (closeBtn && !closeBtn.dataset.overlayCloseBound) {
          closeBtn.addEventListener('click', () => {
            document.getElementById(overlayId)?.classList.add('hidden')
          })
          closeBtn.dataset.overlayCloseBound = 'true'
        }

        if (!window.__overlayScriptPromises) {
          window.__overlayScriptPromises = new Map()
        }

        if (!window.__overlayScriptPromises.has(scriptPath)) {
          window.__overlayScriptPromises.set(
            scriptPath,
            new Promise((resolve, reject) => {
              const scriptEl = document.createElement('script')
              scriptEl.src = scriptPath
              scriptEl.async = false
              scriptEl.onload = resolve
              scriptEl.onerror = reject
              document.body.appendChild(scriptEl)
            })
          )
        }

        await window.__overlayScriptPromises.get(scriptPath)

        return root
      })()
    )
  }

  await window.__overlayPageCache.get(cacheKey)
  return content.querySelector(`[${rootAttribute}]`)
}

function ensureAccountsOverlayStyles() {
  if (document.getElementById('embedded-accounts-overlay-styles')) {
    return
  }

  const styleEl = document.createElement('style')
  styleEl.id = 'embedded-accounts-overlay-styles'
  styleEl.textContent = `
    .overlay-accounts-root {
      width: 100%;
      display: flex;
      justify-content: center;
    }

    .overlay-accounts-shell {
      width: min(100%, 1040px);
      background: rgba(255, 255, 255, 0.96);
      border-radius: 28px;
      padding: 28px;
      box-shadow: 0 30px 80px rgba(15, 23, 42, 0.22);
      border: 1px solid rgba(148, 163, 184, 0.2);
      gap: 0;
    }

    .overlay-accounts-hero {
      background: transparent !important;
      box-shadow: none !important;
      border: none !important;
      border-bottom: 1px solid rgba(148, 163, 184, 0.22) !important;
      border-radius: 0 !important;
      padding: 0 0 20px 0 !important;
      margin-bottom: 18px;
    }

    .overlay-accounts-list {
      padding-top: 4px;
    }
  `
  document.head.appendChild(styleEl)
}

async function openAccountsOverlay({ overlayId, contentId, rootAttribute, htmlPath, scriptPath, styleId, modalFlag }) {
  window[modalFlag] = true
  const overlay = document.getElementById(overlayId)
  if (!overlay) {
    return
  }

  ensureAccountsOverlayStyles()
  await ensureOverlayPage({ overlayId, contentId, rootAttribute, htmlPath, scriptPath, styleId })
  overlay.classList.remove('hidden')

  if (!overlay.dataset.overlayBound) {
    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        overlay.classList.add('hidden')
      }
    })
    overlay.dataset.overlayBound = 'true'
  }
}

function bootstrapScreenRecorder() {
  if (window.screenRecorder) {
    return
  }

  window.screenRecorder = new ScreenRecorder()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapScreenRecorder)
} else {
  bootstrapScreenRecorder()
}

if (window.electronAPI?.onShowDriveAccounts) {
  window.electronAPI.onShowDriveAccounts(() => {
    openAccountsOverlay({
      overlayId: 'driveAccountsOverlay',
      contentId: 'driveAccountsOverlayContent',
      rootAttribute: 'data-drive-accounts-root',
      htmlPath: '../windows/drive-accounts.html',
      scriptPath: '../js/drive-accounts-renderer.js',
      styleId: 'drive-accounts-overlay-styles',
      modalFlag: '__driveAccountsModalMode'
    }).catch(() => {})
  })
}

if (window.electronAPI?.onShowYouTubeAccounts) {
  window.electronAPI.onShowYouTubeAccounts(() => {
    openAccountsOverlay({
      overlayId: 'youtubeAccountsOverlay',
      contentId: 'youtubeAccountsOverlayContent',
      rootAttribute: 'data-youtube-accounts-root',
      htmlPath: '../windows/youtube-accounts.html',
      scriptPath: '../js/youtube-accounts-renderer.js',
      styleId: 'youtube-accounts-overlay-styles',
      modalFlag: '__youtubeAccountsModalMode'
    }).catch(() => {})
  })
}

window.recorderAPI = {
  pause: () => window.screenRecorder?.pauseRecording(),
  resume: () => window.screenRecorder?.resumeRecording(),
  stop: () => window.screenRecorder?.stopRecording(),
  getState: () => window.screenRecorder?.getRecordingState(),
  startWithSource: source => window.screenRecorder?.startRecordingWithSource(source)
}
