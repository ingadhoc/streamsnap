const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  openExternal: url => ipcRenderer.invoke('open-external', url),
  openFolder: folderPath => ipcRenderer.invoke('open-folder', folderPath),

  startRecording: () => ipcRenderer.invoke('start-recording'),
  pauseRecording: () => ipcRenderer.invoke('pause-recording'),
  resumeRecording: () => ipcRenderer.invoke('resume-recording'),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  discardRecording: () => ipcRenderer.invoke('discard-recording'),

  showCountdown: options => ipcRenderer.invoke('show-countdown', options),
  closeCountdown: () => ipcRenderer.invoke('close-countdown'),
  countdownComplete: () => ipcRenderer.invoke('countdown-complete'),

  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  openSourceSelector: () => ipcRenderer.invoke('open-source-selector'),
  closeSourceSelector: () => ipcRenderer.invoke('close-source-selector'),
  sourceSelected: source => ipcRenderer.invoke('source-selected', source),

  saveVideo: videoData => ipcRenderer.invoke('save-video', videoData),
  setRecordedVideo: data => ipcRenderer.invoke('set-recorded-video', data),
  saveRecordedVideoToTemp: (blob, duration) => ipcRenderer.invoke('save-recorded-video-to-temp', blob, duration),
  discardRecordedVideo: () => ipcRenderer.invoke('discard-recorded-video'),
  setRecordedDuration: seconds => ipcRenderer.invoke('set-recorded-duration', seconds),
  getMainWindowData: () => ipcRenderer.invoke('get-main-window-data'),
  getRecordedDuration: () => ipcRenderer.invoke('get-recorded-duration'),

  getSaveOptions: () => {
    try {
      const b64Arg = process.argv.find(a => a && a.startsWith('--save-options-b64='))
      if (b64Arg) {
        const b64 = b64Arg.split('=')[1]
        const jsonStr = Buffer.from(b64, 'base64').toString('utf8')
        return JSON.parse(jsonStr)
      }

      const arg = process.argv.find(a => a && a.startsWith('--save-options='))
      if (arg) {
        const json = arg.split('=')[1]
        return JSON.parse(json)
      }
    } catch (e) {}
    return null
  },

  registerShortcuts: shortcuts => ipcRenderer.invoke('register-shortcuts', shortcuts),
  showMainWindow: () => ipcRenderer.invoke('show-main-window'),

  getDriveFolders: accessToken => ipcRenderer.invoke('get-drive-folders', accessToken),
  getDriveFoldersPaged: (accessToken, opts) => ipcRenderer.invoke('get-drive-folders-paged', accessToken, opts),
  createDriveFolder: (accessToken, folderName) => ipcRenderer.invoke('create-drive-folder', accessToken, folderName),
  uploadToDrive: (accessToken, folderId, videoData, fileName) =>
    ipcRenderer.invoke('upload-to-drive', accessToken, folderId, videoData, fileName),
  driveAccountsOpen: () => ipcRenderer.invoke('open-drive-accounts'),

  driveAccountsList: () => ipcRenderer.invoke('drive-accounts:list'),
  driveAccountsGetActive: () => ipcRenderer.invoke('drive-accounts:get-active'),
  driveAccountsCreate: opts => ipcRenderer.invoke('drive-accounts:create', opts),
  driveAccountsRemove: accountId => ipcRenderer.invoke('drive-accounts:remove', accountId),
  driveAccountsUpdate: (accountId, changes) => ipcRenderer.invoke('drive-accounts:update', accountId, changes),
  driveAccountsRefreshTokens: () => ipcRenderer.invoke('drive-accounts:refresh-all-tokens'),
  driveAccountsHandleAuthError: accountId => ipcRenderer.invoke('drive-accounts:handle-auth-error', accountId),

  getDriveFoldersForAccount: accountId => ipcRenderer.invoke('get-drive-folders-account', accountId),
  getDriveFoldersPagedForAccount: (accountId, opts) =>
    ipcRenderer.invoke('get-drive-folders-paged-account', accountId, opts),
  createDriveFolderForAccount: (accountId, folderName) =>
    ipcRenderer.invoke('create-drive-folder-account', accountId, folderName),
  uploadToDriveAccount: (accountId, folderId, videoData, fileName, privacy) =>
    ipcRenderer.invoke('upload-to-drive-account', accountId, folderId, videoData, fileName, privacy),
  saveToDriveAccount: options => ipcRenderer.invoke('save-to-drive-account', options),
  driveAccountReauth: accountId => ipcRenderer.invoke('drive-account-reauth', accountId),

  driveIsAuthenticated: () => ipcRenderer.invoke('drive-is-authenticated'),
  driveSignOut: () => ipcRenderer.invoke('drive-sign-out'),

  youtubeAccountsOpen: () => ipcRenderer.invoke('open-youtube-accounts'),
  youtubeAccountsList: () => ipcRenderer.invoke('youtube-accounts:list'),
  youtubeAccountsGetActive: () => ipcRenderer.invoke('youtube-accounts:get-active'),
  youtubeAccountsCreate: opts => ipcRenderer.invoke('youtube-accounts:create', opts),
  youtubeAccountsRemove: accountId => ipcRenderer.invoke('youtube-accounts:remove', accountId),
  youtubeAccountsUpdate: (accountId, changes) => ipcRenderer.invoke('youtube-accounts:update', accountId, changes),
  youtubeSignIn: () => ipcRenderer.invoke('youtube-sign-in'),
  saveToYouTubeAccount: options => ipcRenderer.invoke('save-to-youtube-account', options),
  youtubeGetChannelInfo: accountId => ipcRenderer.invoke('youtube-get-channel-info', accountId),
  youtubeGetPlaylists: accountId => ipcRenderer.invoke('youtube-get-playlists', accountId),

  selectFolder: () => ipcRenderer.invoke('select-folder'),

  saveToDrive: options => ipcRenderer.invoke('save-to-drive', options),
  saveToLocal: options => ipcRenderer.invoke('save-to-local', options),

  recoveryListVideos: () => ipcRenderer.invoke('recovery:list-videos'),
  recoveryRecoverVideo: (filePath, destinationPath) =>
    ipcRenderer.invoke('recovery:recover-video', filePath, destinationPath),
  recoveryCleanup: () => ipcRenderer.invoke('recovery:cleanup'),

  submitAuthCode: code => ipcRenderer.send('submit-auth-code', code),

  closeFloating: () => ipcRenderer.invoke('close-floating'),
  moveFloatingWindow: (deltaX, deltaY) => ipcRenderer.invoke('move-floating-window', deltaX, deltaY),
  startFloatingDrag: () => ipcRenderer.invoke('start-floating-drag'),
  stopFloatingDrag: () => ipcRenderer.send('stop-floating-drag'),
  resizeFloatingWindow: (width, height) => ipcRenderer.invoke('resize-floating-window', width, height),
  minimizeMain: () => ipcRenderer.invoke('minimize-main'),
  closeSaveWindow: () => ipcRenderer.invoke('close-save-window'),

  onStopRecording: callback => ipcRenderer.on('stop-recording-event', callback),
  onPauseRecording: callback => ipcRenderer.on('pause-recording-event', callback),
  onResumeRecording: callback => ipcRenderer.on('resume-recording-event', callback),
  onDiscardRecording: callback => ipcRenderer.on('discard-recording-event', callback),

  onDriveUploadDone: callback => ipcRenderer.on('drive-upload-done', callback),
  onLocalSaveDone: callback => ipcRenderer.on('local-save-done', callback),

  onInitSaveOptions: callback => {
    ipcRenderer.on('init-save-options', (event, data) => {
      try {
        callback(data)
      } catch (e) {}
    })
  },

  onDriveAuthUpdated: callback => {
    ipcRenderer.on('drive-auth-updated', (event, data) => {
      try {
        callback(data)
      } catch (e) {}
    })
  },

  onDriveAccountsUpdated: callback => {
    ipcRenderer.on('drive-accounts-updated', (event, data) => {
      try {
        callback(data)
      } catch (e) {}
    })
  },

  onDriveAccountsChanged: callback => {
    ipcRenderer.on('drive-accounts-changed', (event, data) => {
      try {
        callback(data)
      } catch (e) {}
    })
  },

  onYouTubeAuthUpdated: callback => {
    ipcRenderer.on('youtube-auth-updated', (event, data) => {
      try {
        callback(data)
      } catch (e) {}
    })
  },

  onYouTubeAccountsUpdated: callback => {
    ipcRenderer.on('youtube-accounts-updated', (event, data) => {
      try {
        callback(data)
      } catch (e) {}
    })
  },

  onRecordingConversionProgress: callback => {
    ipcRenderer.on('recording-conversion-progress', (event, data) => {
      try {
        callback(data)
      } catch (e) {}
    })
  },

  onShortcutPause: callback => ipcRenderer.on('shortcut-pause', callback),
  onShortcutStop: callback => ipcRenderer.on('shortcut-stop', callback),
  onShortcutDiscard: callback => ipcRenderer.on('shortcut-discard', callback),

  onStartCountdown: callback => ipcRenderer.on('start-countdown', (event, duration) => callback(duration)),
  onStopCountdown: callback => ipcRenderer.on('stop-countdown', callback)
})
