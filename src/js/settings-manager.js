class SettingsManager {
  constructor() {
    this.settings = {
      startShortcut: '',
      pauseShortcut: '',
      stopShortcut: '',
      restartShortcut: '',
      discardShortcut: '',
      recordMicrophone: false,
      recordSystemAudio: false,
      recordWebcam: false,
      defaultRecordWebcam: false,
      defaultRecordMicrophone: false,
      defaultRecordSystemAudio: false,
      preferredMicrophoneId: 'default',
      preferredWebcamId: 'default',
      driveEnabled: false,
      driveAccessToken: '',
      driveFolderId: '',
      driveFolderName: '',
      driveVideoPrivacy: 'restricted',
      driveAutoSaveEnabled: false,
      driveAutoSaveAccountIds: [],
      drive: { accessToken: '', folderId: '', folderName: '', videoPrivacy: 'restricted' },
      enableCountdown: true,
      countdownDuration: 5,

      launchOnStartup: false
    }
  }

  loadSettings() {
    const saved = localStorage.getItem('streamsnap-settings')
    if (saved) {
      this.settings = { ...this.settings, ...JSON.parse(saved) }
    } else {
    }

    this.settings.drive = this.settings.drive || {
      accessToken: '',
      folderId: '',
      folderName: '',
      videoPrivacy: 'restricted'
    }
    if (!Array.isArray(this.settings.driveAutoSaveAccountIds)) {
      this.settings.driveAutoSaveAccountIds = []
    }
    this.settings.driveAutoSaveAccountIds = this.settings.driveAutoSaveAccountIds.filter(
      accountId => typeof accountId === 'string' && accountId.trim().length > 0
    )
    if (!this.settings.drive.accessToken && this.settings.driveAccessToken)
      this.settings.drive.accessToken = this.settings.driveAccessToken
    if (!this.settings.drive.folderId && this.settings.driveFolderId)
      this.settings.drive.folderId = this.settings.driveFolderId
    if (!this.settings.drive.folderName && this.settings.driveFolderName)
      this.settings.drive.folderName = this.settings.driveFolderName
    if (!this.settings.drive.videoPrivacy && this.settings.driveVideoPrivacy)
      this.settings.drive.videoPrivacy = this.settings.driveVideoPrivacy
    if (typeof this.settings.preferredMicrophoneId !== 'string' || !this.settings.preferredMicrophoneId.trim()) {
      this.settings.preferredMicrophoneId = 'default'
    }
    if (typeof this.settings.preferredWebcamId !== 'string' || !this.settings.preferredWebcamId.trim()) {
      this.settings.preferredWebcamId = 'default'
    }

    this.updateUI()
    this.syncDefaults()
  }

  saveSettings() {
    this.settings.driveAccessToken = this.settings.drive.accessToken
    this.settings.driveFolderId = this.settings.drive.folderId
    this.settings.driveFolderName = this.settings.drive.folderName
    this.settings.driveVideoPrivacy = this.settings.drive.videoPrivacy
    localStorage.setItem('streamsnap-settings', JSON.stringify(this.settings))
  }

  updateUI() {
    document.getElementById('recordMicrophone').checked = this.settings.recordMicrophone
    document.getElementById('recordSystemAudio').checked = this.settings.recordSystemAudio
    document.getElementById('recordWebcam').checked = this.settings.recordWebcam
    document.getElementById('defaultRecordMicrophone').checked = this.settings.defaultRecordMicrophone
    document.getElementById('defaultRecordSystemAudio').checked = this.settings.defaultRecordSystemAudio

    const defaultWebcamEl = document.getElementById('defaultRecordWebcam')
    if (defaultWebcamEl) defaultWebcamEl.checked = !!this.settings.defaultRecordWebcam

    document.getElementById('enableCountdown').checked = this.settings.enableCountdown
    document.getElementById('countdownDuration').value = this.settings.countdownDuration || 5
    const launchOnStartupEl = document.getElementById('launchOnStartup')
    if (launchOnStartupEl) launchOnStartupEl.checked = this.settings.launchOnStartup === true
    const driveAutoSaveEnabledEl = document.getElementById('driveAutoSaveEnabled')
    if (driveAutoSaveEnabledEl) driveAutoSaveEnabledEl.checked = this.settings.driveAutoSaveEnabled === true
    this.updateCountdownOptionsVisibility()
  }

  syncDefaults() {
    if (this.settings.defaultRecordMicrophone && !this.settings.recordMicrophone) {
      this.settings.recordMicrophone = true
      document.getElementById('recordMicrophone').checked = true
    }
    if (this.settings.defaultRecordSystemAudio && !this.settings.recordSystemAudio) {
      this.settings.recordSystemAudio = true
      document.getElementById('recordSystemAudio').checked = true
    }
    if (this.settings.defaultRecordWebcam && !this.settings.recordWebcam) {
      this.settings.recordWebcam = true
      const recWebcamEl2 = document.getElementById('recordWebcam')
      if (recWebcamEl2) recWebcamEl2.checked = true
    }
  }

  updateCountdownOptionsVisibility() {
    const countdownOptions = document.getElementById('countdownOptions')
    if (countdownOptions) {
      countdownOptions.style.display = this.settings.enableCountdown ? 'block' : 'none'
    }
  }

  getAudioConstraints() {
    const wantsMicrophone = this.settings.recordMicrophone
    const wantsSystemAudio = this.settings.recordSystemAudio

    if (!wantsMicrophone && !wantsSystemAudio) {
      return false
    }

    if (wantsMicrophone && !wantsSystemAudio) {
      return {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
      }
    }

    if (!wantsMicrophone && wantsSystemAudio) {
      return {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: this.selectedSource?.id
        }
      }
    }

    return {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 44100
    }
  }
}
