class SaveVideoHandler {
  constructor() {
    this.videoBlob = null
    this.saveOptions = {}
    this.selectedLocalFolder = null
    this.activeAccounts = []
    this.activeYouTubeAccounts = []
    this.selectedAccounts = new Map()
    this.selectedYouTubeAccounts = new Set()

    this.initializeUI()
    this.loadSaveOptions()
    this.loadVideoData()

    window.addEventListener('beforeunload', async e => {
      if (this.videoBlob) {
        try {
          if (window.electronAPI && window.electronAPI.discardRecordedVideo) {
            await window.electronAPI.discardRecordedVideo()
          }
        } catch (err) {}
      }
    })

    if (window.electronAPI && window.electronAPI.onDriveAuthUpdated) {
      window.electronAPI.onDriveAuthUpdated(() => {
        this.loadActiveAccounts()
          .then(() => this.renderDriveAccounts())
          .catch(() => {})
      })
    }

    if (window.electronAPI && window.electronAPI.onDriveAccountsUpdated) {
      window.electronAPI.onDriveAccountsUpdated(() => {
        this.loadActiveAccounts()
          .then(() => this.renderDriveAccounts())
          .catch(() => {})
      })
    }

    if (window.electronAPI && window.electronAPI.onDriveAccountsChanged) {
      window.electronAPI.onDriveAccountsChanged(() => {
        this.refreshAccountsUI()
      })
    }

    if (window.electronAPI && window.electronAPI.onDriveAccountsUpdated) {
      window.electronAPI.onDriveAccountsUpdated(() => {
        this.refreshAccountsUI()
      })
    }

    if (window.electronAPI && window.electronAPI.onYouTubeAuthUpdated) {
      window.electronAPI.onYouTubeAuthUpdated(() => {
        this.loadYouTubeAccounts()
          .then(() => this.renderYouTubeAccounts())
          .catch(() => {})
      })
    }

    if (window.electronAPI && window.electronAPI.onYouTubeAccountsUpdated) {
      window.electronAPI.onYouTubeAccountsUpdated(() => {
        this.loadYouTubeAccounts()
          .then(() => this.renderYouTubeAccounts())
          .catch(() => {})
      })
    }

    this.setupDriveAccountsListener()
  }

  setupDriveAccountsListener() {
    const originalFocus = window.onfocus
    window.onfocus = () => {
      this.refreshAccountsUI()
      if (originalFocus) originalFocus()
    }
  }

  refreshAccountsUI() {
    this.loadActiveAccounts()
      .then(() => {
        this.renderDriveAccounts()
        this.configureSaveOptions()
      })
      .catch(() => {})
    this.loadYouTubeAccounts()
      .then(() => {
        this.renderYouTubeAccounts()
        this.configureSaveOptions()
      })
      .catch(() => {})
  }

  initializeUI() {
    const discardBtn = document.getElementById('discardBtn')
    const fileNameInput = document.getElementById('fileName')
    const localSaveBtn = document.getElementById('localSaveBtn')
    const browseLocalBtn = document.getElementById('browseLocalBtn')
    const manageDriveAccountsBtn = document.getElementById('manageDriveAccountsBtn')
    const addMoreAccountsBtn = document.getElementById('addMoreAccountsBtn')
    const manageYouTubeAccountsBtn = document.getElementById('manageYouTubeAccountsBtn')
    const addMoreYouTubeAccountsBtn = document.getElementById('addMoreYouTubeAccountsBtn')

    discardBtn.addEventListener('click', () => this.discardVideo())
    localSaveBtn.addEventListener('click', () => this.saveToLocal())
    browseLocalBtn.addEventListener('click', () => this.browseLocalFolder())
    manageDriveAccountsBtn.addEventListener('click', () => this.manageDriveAccounts())

    if (addMoreAccountsBtn) {
      addMoreAccountsBtn.addEventListener('click', () => this.manageDriveAccounts())
    }

    if (manageYouTubeAccountsBtn) {
      manageYouTubeAccountsBtn.addEventListener('click', () => this.manageYouTubeAccounts())
    }

    if (addMoreYouTubeAccountsBtn) {
      addMoreYouTubeAccountsBtn.addEventListener('click', () => this.manageYouTubeAccounts())
    }

    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    const dateStr = `${pad(now.getDate())}_${pad(now.getMonth() + 1)}_${now.getFullYear()}_${pad(now.getHours())}_${pad(now.getMinutes())}_${pad(now.getSeconds())}`
    fileNameInput.value = `StreamSnap_${dateStr}`
  }

  async loadSaveOptions() {
    try {
      const opts = await window.electronAPI.getSaveOptions()
      if (opts) {
        this.saveOptions = opts
      } else {
        this.showDefaultOptions()
      }
    } catch (err) {
      this.showDefaultOptions()
    }

    if (window.saveOptions) {
      this.saveOptions = window.saveOptions
    }

    await this.loadActiveAccounts()
    this.configureSaveOptions()

    if (window.electronAPI && window.electronAPI.onInitSaveOptions) {
      window.electronAPI.onInitSaveOptions(async data => {
        try {
          if (data) {
            this.saveOptions = data
            await this.loadActiveAccounts()
            this.configureSaveOptions()
          }
        } catch (e) {}
      })
    }
  }

  async loadActiveAccounts() {
    try {
      if (window.electronAPI && window.electronAPI.driveAccountsGetActive) {
        const res = await window.electronAPI.driveAccountsGetActive()
        this.activeAccounts = (res && res.accounts) || res || []
      } else {
        this.activeAccounts = []
      }
    } catch (e) {
      this.activeAccounts = []
    }
  }

  async loadYouTubeAccounts() {
    try {
      if (window.electronAPI && window.electronAPI.youtubeAccountsGetActive) {
        const res = await window.electronAPI.youtubeAccountsGetActive()
        this.activeYouTubeAccounts = (res && res.accounts) || res || []
      } else {
        this.activeYouTubeAccounts = []
      }
    } catch (e) {
      this.activeYouTubeAccounts = []
    }
  }

  async configureSaveOptions() {
    const localSection = document.getElementById('localSaveSection')
    const driveAccountsSection = document.getElementById('driveAccountsSection')
    const noDriveAccountsSection = document.getElementById('noDriveAccountsSection')
    const youtubeAccountsSection = document.getElementById('youtubeAccountsSection')
    const noYouTubeAccountsSection = document.getElementById('noYouTubeAccountsSection')
    const addMoreAccountsBtn = document.getElementById('addMoreAccountsBtn')
    const addMoreYouTubeAccountsBtn = document.getElementById('addMoreYouTubeAccountsBtn')

    if (this.saveOptions.showLocalOption !== false) {
      localSection.classList.remove('hidden')

      try {
        const mainSettings = JSON.parse(localStorage.getItem('streamsnap-settings') || '{}')
        const defaultFolder = this.saveOptions.defaultLocalFolder || mainSettings.saveFolderPath

        if (defaultFolder) {
          document.getElementById('localFolderPath').value = defaultFolder
          this.selectedLocalFolder = defaultFolder
        }
      } catch (e) {
        if (this.saveOptions.defaultLocalFolder) {
          document.getElementById('localFolderPath').value = this.saveOptions.defaultLocalFolder
          this.selectedLocalFolder = this.saveOptions.defaultLocalFolder
        }
      }
    } else {
      localSection.classList.add('hidden')
    }

    const showDriveOption = this.saveOptions.showDriveOption !== false
    const showYouTubeOption = this.saveOptions.showYouTubeOption !== false

    if (addMoreAccountsBtn) {
      addMoreAccountsBtn.classList.add('hidden')
    }
    if (addMoreYouTubeAccountsBtn) {
      addMoreYouTubeAccountsBtn.classList.add('hidden')
    }

    if (showDriveOption && Array.isArray(this.activeAccounts) && this.activeAccounts.length > 0) {
      driveAccountsSection.classList.remove('hidden')
      noDriveAccountsSection.classList.add('hidden')
      this.renderDriveAccounts()
    } else {
      driveAccountsSection.classList.add('hidden')
      noDriveAccountsSection.classList.add('hidden')
    }

    if (showYouTubeOption && Array.isArray(this.activeYouTubeAccounts) && this.activeYouTubeAccounts.length > 0) {
      youtubeAccountsSection.classList.remove('hidden')
      noYouTubeAccountsSection.classList.add('hidden')
      this.renderYouTubeAccounts()
    } else {
      youtubeAccountsSection.classList.add('hidden')
      noYouTubeAccountsSection.classList.add('hidden')
    }
  }

  renderDriveAccounts() {
    const accountsList = document.getElementById('driveAccountsList')
    if (!accountsList) return

    accountsList.innerHTML = ''

    this.activeAccounts.forEach(account => {
      const accountDiv = document.createElement('div')
      accountDiv.className =
        'group border-2 border-transparent hover:border-green-300 rounded-xl p-4 bg-white hover:bg-green-50/50 transition-all duration-200 hover:shadow-md'
      accountDiv.dataset.accountId = account.id

      const contentDiv = document.createElement('div')
      contentDiv.className = 'flex items-center justify-between'

      const leftDiv = document.createElement('div')
      leftDiv.className = 'flex items-center gap-4 flex-1 min-w-0'

      const avatarDiv = document.createElement('div')
      avatarDiv.className =
        'w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold flex items-center justify-center text-lg shadow-md group-hover:shadow-lg transition-all'
      const initials = account.email ? account.email.substring(0, 2).toUpperCase() : 'DR'
      avatarDiv.textContent = initials

      const infoDiv = document.createElement('div')
      infoDiv.className = 'flex-1 min-w-0'

      const nameDiv = document.createElement('div')
      nameDiv.className = 'font-bold text-gray-800 text-base truncate'
      nameDiv.textContent = account.email || account.displayName || `Account ${account.id.slice(0, 8)}`

      const emailDiv = document.createElement('div')
      emailDiv.className = 'text-sm text-gray-500 truncate'
      if (account.displayName && account.displayName !== account.email && account.email) {
        emailDiv.textContent = account.displayName
      }

      const folderDiv = document.createElement('div')
      folderDiv.className = 'text-xs text-gray-400 truncate flex items-center gap-1 mt-1'
      folderDiv.innerHTML = `<span>📁</span><span>${account.defaultFolderName || 'No folder set'}</span>`

      infoDiv.appendChild(nameDiv)
      if (emailDiv.textContent) infoDiv.appendChild(emailDiv)
      infoDiv.appendChild(folderDiv)

      const saveBtn = document.createElement('button')
      saveBtn.className =
        'px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-medium transition-all hover:scale-105 hover:shadow-md text-sm'
      saveBtn.innerHTML = '💾 Save Here'
      saveBtn.addEventListener('click', () => this.saveToDriveAccount(account))

      leftDiv.appendChild(avatarDiv)
      leftDiv.appendChild(infoDiv)

      const headerDiv = document.createElement('div')
      headerDiv.className = 'flex items-center justify-between mb-3'
      headerDiv.appendChild(leftDiv)
      headerDiv.appendChild(saveBtn)

      const folderConfigDiv = document.createElement('div')
      folderConfigDiv.className = 'flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200 mb-2'

      const folderLabel = document.createElement('label')
      folderLabel.className = 'text-sm font-medium text-blue-800 flex-shrink-0'
      folderLabel.textContent = '📁 Folder:'

      const folderDisplay = document.createElement('div')
      folderDisplay.className =
        'flex-1 px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm text-gray-700 truncate min-w-0'
      folderDisplay.style.maxWidth = '300px'
      folderDisplay.id = `folder-display-${account.id}`
      folderDisplay.textContent = account.defaultFolderName || 'No folder selected'

      const folderBtn = document.createElement('button')
      folderBtn.className =
        'px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-all'
      folderBtn.textContent = '📁 Select'
      folderBtn.addEventListener('click', () => this.selectFolderForAccount(account))

      folderConfigDiv.appendChild(folderLabel)
      folderConfigDiv.appendChild(folderDisplay)
      folderConfigDiv.appendChild(folderBtn)

      accountDiv.appendChild(headerDiv)
      accountDiv.appendChild(folderConfigDiv)
      accountsList.appendChild(accountDiv)
    })
  }

  async selectFolderForAccount(account) {
    try {
      const folderPicker = new FolderPickerModal()
      const selectedFolder = await folderPicker.show(account.id)

      if (selectedFolder) {
        account.currentFolderId = selectedFolder.id
        account.currentFolderName = selectedFolder.name

        const folderDisplay = document.getElementById(`folder-display-${account.id}`)
        if (folderDisplay) {
          folderDisplay.textContent = selectedFolder.name
        }

        try {
          await window.electronAPI.driveAccountsUpdate(account.id, {
            defaultFolderId: selectedFolder.id,
            defaultFolderName: selectedFolder.name
          })
          this.showSuccess('Folder updated successfully')
        } catch (updateErr) {
          this.showError('Failed to save folder preference')
        }
      }
    } catch (error) {
      this.showError('Failed to select folder')
    }
  }

  async saveToDriveAccount(account) {
    try {
      let fileName = document.getElementById('fileName').value.trim() || 'recording'

      if (!fileName.toLowerCase().endsWith('.mp4')) {
        fileName += '.mp4'
      }

      if (!this.videoBlob) {
        this.showError('No video data available')
        return
      }

      const selectedFolderId = account.currentFolderId || account.defaultFolderId

      if (!selectedFolderId) {
        this.showError('No folder selected for this account. Please select a folder first.')
        return
      }

      this.showSavingState(true)
      const savingText = document.getElementById('savingText')
      savingText.textContent = `Saving to ${account.displayName || account.email || 'Drive account'}...`

      const videoData = await this.prepareVideoData()

      const result = await window.electronAPI.saveToDriveAccount({
        accountId: account.id,
        folderId: selectedFolderId,
        videoData: videoData,
        fileName: fileName
      })

      this.showSavingState(false)

      if (result && result.success) {
        if (result.webViewLink || result.fileId) {
          this.showUploadSuccessModal(
            account.displayName || account.email,
            result.webViewLink,
            result.fileName || fileName
          )
        } else {
          this.showSuccess(`Successfully saved to ${account.displayName || account.email || 'Drive account'}!`)
        }

        const saveBtn = document.getElementById(`save-button-${account.id}`)
        if (saveBtn) {
          saveBtn.textContent = '✓ Saved'
          saveBtn.classList.add('bg-green-500', 'text-white')

          setTimeout(() => {
            saveBtn.textContent = 'Save'
            saveBtn.classList.remove('bg-green-500', 'text-white')
          }, 3000)
        }
      } else {
        this.showError(`Failed to save to ${account.displayName || account.email || 'Drive account'}`)

        const saveBtn = document.getElementById(`save-button-${account.id}`)
        if (saveBtn) {
          saveBtn.textContent = '✗ Failed'
          saveBtn.classList.add('bg-red-500', 'text-white')

          setTimeout(() => {
            saveBtn.textContent = 'Save'
            saveBtn.classList.remove('bg-red-500', 'text-white')
          }, 3000)
        }
      }
    } catch (error) {
      this.showSavingState(false)
      this.showError(`Failed to save to ${account.displayName || account.email || 'Drive account'}: ${error.message}`)

      const saveBtn = document.getElementById(`save-button-${account.id}`)
      if (saveBtn) {
        saveBtn.textContent = '✗ Error'
        saveBtn.classList.add('bg-red-500', 'text-white')

        setTimeout(() => {
          saveBtn.textContent = 'Save'
          saveBtn.classList.remove('bg-red-500', 'text-white')
        }, 3000)
      }
    }
  }

  async saveToLocal() {
    try {
      let fileName = document.getElementById('fileName').value.trim() || 'recording'

      if (!fileName.toLowerCase().endsWith('.mp4')) {
        fileName += '.mp4'
      }

      if (!this.videoBlob) {
        this.showError('No video data available')
        return
      }

      let folder = this.selectedLocalFolder
      if (!folder) {
        const result = await window.electronAPI.selectFolder()
        if (!result || !result.folderPath) return
        folder = result.folderPath
        this.selectedLocalFolder = folder
      }

      this.showSavingState(true)
      const savingText = document.getElementById('savingText')
      savingText.textContent = 'Saving to computer...'

      const videoData = await this.prepareVideoData()

      const result = await window.electronAPI.saveToLocal({
        videoData,
        folderPath: folder,
        fileName
      })

      this.showSavingState(false)

      if (result && result.success) {
        this.showSuccess('Video saved successfully to your computer!')
      } else {
        this.showError('Failed to save video locally')
      }
    } catch (error) {
      this.showSavingState(false)
      this.showError('Failed to save video')
    }
  }

  async browseLocalFolder() {
    try {
      const result = await window.electronAPI.selectFolder()
      if (result && result.folderPath) {
        this.selectedLocalFolder = result.folderPath
        document.getElementById('localFolderPath').value = result.folderPath
      }
    } catch (error) {
      this.showError('Failed to select folder')
    }
  }

  async loadVideoData() {
    try {
      const video = document.getElementById('previewVideo')
      const durationSpan = document.getElementById('videoDuration')
      const sizeSpan = document.getElementById('videoSize')

      if (window.electronAPI && window.electronAPI.getMainWindowData) {
        try {
          const data = await window.electronAPI.getMainWindowData()
          const videoBlob = data && (data.recordedVideoBlob || data.videoBlob)

          if (videoBlob) {
            this.videoBlob = videoBlob
            video.src = URL.createObjectURL(new Blob([videoBlob], { type: 'video/mp4' }))

            const recordedDuration = data.recordedDuration
            if (recordedDuration && recordedDuration > 0) {
              const minutes = Math.floor(recordedDuration / 60)
              const seconds = Math.floor(recordedDuration % 60)
              durationSpan.textContent = `Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`
            } else {
              video.addEventListener('loadedmetadata', () => {
                if (video.duration && !isNaN(video.duration) && video.duration !== Infinity) {
                  const duration = Math.round(video.duration)
                  const minutes = Math.floor(duration / 60)
                  const seconds = duration % 60
                  durationSpan.textContent = `Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`
                } else {
                  durationSpan.textContent = 'Duration: --:--'
                }
              })
            }

            const sizeInMB = (videoBlob.byteLength / (1024 * 1024)).toFixed(1)
            sizeSpan.textContent = `Size: ${sizeInMB} MB`
          } else {
            this.showError('No video data available. Please try recording again.')
          }
        } catch (err) {
          this.showError('Failed to load video data')
        }
      }
    } catch (error) {
      this.showError('Error loading video data')
    }
  }

  async prepareVideoData() {
    if (this.videoBlob) {
      return this.videoBlob
    }

    if (window.electronAPI && window.electronAPI.getMainWindowData) {
      const data = await window.electronAPI.getMainWindowData()

      const videoBlob = data && (data.recordedVideoBlob || data.videoBlob)
      if (videoBlob) {
        this.videoBlob = videoBlob
        return videoBlob
      }
    }

    throw new Error('No video data available')
  }

  async discardVideo() {
    if (confirm('Are you sure you want to discard this recording?')) {
      try {
        if (window.electronAPI && window.electronAPI.discardRecordedVideo) {
          await window.electronAPI.discardRecordedVideo()
        }
      } catch (e) {}
      window.close()
    }
  }

  async closeWindow() {
    try {
      if (window.electronAPI && window.electronAPI.discardRecordedVideo) {
        await window.electronAPI.discardRecordedVideo()
      }
    } catch (e) {}
  }

  showDefaultOptions() {
    this.saveOptions = {
      showLocalOption: true,
      defaultLocalFolder: null
    }
  }

  showSavingState(show) {
    const savingState = document.getElementById('savingState')
    const mainContent = document.getElementById('mainContent')

    if (show) {
      savingState.classList.remove('hidden')
      mainContent.style.opacity = '0.5'
      mainContent.style.pointerEvents = 'none'
    } else {
      savingState.classList.add('hidden')
      mainContent.style.opacity = '1'
      mainContent.style.pointerEvents = 'auto'
    }
  }

  showError(message) {
    const toast = document.createElement('div')
    toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
    toast.textContent = message
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 4000)
  }

  showSuccess(message) {
    const toast = document.createElement('div')
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
    toast.textContent = message
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
  }

  showUploadSuccessModal(accountName, webViewLink, fileName) {
    try {
      if (typeof UploadSuccessModal === 'undefined') {
        this.showSuccess('Video uploaded successfully!')
        return
      }
      const modal = new UploadSuccessModal()
      modal.show(accountName, webViewLink, fileName, {
        platform: 'drive',
        fileLabel: 'File Name:',
        primaryButtonText: 'Open & Copy'
      })
    } catch (error) {
      this.showSuccess('Video uploaded successfully!')
    }
  }

  async manageDriveAccounts() {
    try {
      await window.electronAPI.driveAccountsOpen()
    } catch (error) {
      this.showError('Failed to open Drive accounts manager')
    }
  }

  renderYouTubeAccounts() {
    const container = document.getElementById('youtubeAccountsList')
    if (!container) return

    if (!this.activeYouTubeAccounts || this.activeYouTubeAccounts.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-gray-400">
          <svg class="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
          <p>No YouTube accounts connected</p>
          <button id="add-first-youtube-account" class="mt-4 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 rounded-lg hover:opacity-90 transition-opacity">
            ▶️ Connect YouTube Account
          </button>
        </div>
      `
      const addBtn = document.getElementById('add-first-youtube-account')
      if (addBtn) {
        addBtn.addEventListener('click', () => this.manageYouTubeAccounts())
      }
      return
    }

    container.innerHTML = this.activeYouTubeAccounts
      .map(account => {
        const isSelected = this.selectedYouTubeAccounts.has(account.id)
        const selectedClass = isSelected ? 'ring-2 ring-red-500' : ''

        return `
        <div class="youtube-account-card ${selectedClass} bg-white rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer border border-gray-200"
             data-account-id="${account.id}">
          <div class="flex items-start gap-3">
            <img src="${account.thumbnail || ''}" 
                 alt="${account.channelName}"
                 class="w-12 h-12 rounded-full flex-shrink-0"
                 style="${account.thumbnail ? '' : 'display: none;'}">
            ${!account.thumbnail ? `<div class="w-12 h-12 rounded-full flex-shrink-0 bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white font-semibold text-lg">${account.channelName ? account.channelName[0].toUpperCase() : 'Y'}</div>` : ''}
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h4 class="font-medium text-gray-800 truncate">${account.channelName}</h4>
                ${isSelected ? '<span class="text-xs bg-red-500 text-white px-2 py-0.5 rounded">Selected</span>' : ''}
              </div>
              
              <div class="mt-3 space-y-2">
                <div class="flex items-center gap-2">
                  <label class="text-xs text-gray-600">Privacy:</label>
                  <select class="youtube-privacy-select bg-white text-gray-800 px-2 py-1 rounded text-xs border border-gray-300"
                          data-account-id="${account.id}">
                    <option value="private" ${account.privacy === 'private' ? 'selected' : ''}>🔒 Private</option>
                    <option value="unlisted" ${account.privacy === 'unlisted' ? 'selected' : ''}>🔗 Unlisted</option>
                    <option value="public" ${account.privacy === 'public' ? 'selected' : ''}>🌐 Public</option>
                  </select>
                </div>
                
                <div class="flex items-center gap-2">
                  <label class="text-xs text-gray-600">Playlist:</label>
                  <select class="youtube-playlist-select bg-white text-gray-800 px-2 py-1 rounded text-xs border border-gray-300 flex-1"
                          data-account-id="${account.id}">
                    <option value="">None</option>
                    ${
                      account.playlists
                        ? account.playlists
                            .map(
                              p =>
                                `<option value="${p.id}" ${account.selectedPlaylistId === p.id ? 'selected' : ''}>${p.title}</option>`
                            )
                            .join('')
                        : ''
                    }
                  </select>
                  <button class="youtube-refresh-playlists text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300"
                          data-account-id="${account.id}"
                          title="Refresh playlists">
                    🔄
                  </button>
                </div>
                
                <button class="youtube-upload-btn w-full mt-2 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 rounded-lg hover:opacity-90 transition-opacity text-white font-medium text-xs"
                        data-account-id="${account.id}">
                  ▶️ Upload to YouTube
                </button>
              </div>
            </div>
          </div>
        </div>
      `
      })
      .join('')

    container.querySelectorAll('.youtube-account-card').forEach(card => {
      const accountId = card.dataset.accountId
      card.addEventListener('click', e => {
        if (
          !e.target.closest('.youtube-privacy-select') &&
          !e.target.closest('.youtube-playlist-select') &&
          !e.target.closest('.youtube-refresh-playlists') &&
          !e.target.closest('.youtube-upload-btn')
        ) {
          this.toggleYouTubeAccountSelection(accountId)
        }
      })
    })

    container.querySelectorAll('.youtube-privacy-select').forEach(select => {
      select.addEventListener('change', e => {
        const accountId = e.target.dataset.accountId
        const privacy = e.target.value
        this.updateYouTubeAccountPrivacy(accountId, privacy)
      })
    })

    container.querySelectorAll('.youtube-playlist-select').forEach(select => {
      select.addEventListener('change', e => {
        const accountId = e.target.dataset.accountId
        const playlistId = e.target.value
        this.updateYouTubePlaylist(accountId, playlistId)
      })
    })

    container.querySelectorAll('.youtube-refresh-playlists').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation()
        const accountId = btn.dataset.accountId
        await this.refreshYouTubePlaylists(accountId)
      })
    })

    container.querySelectorAll('.youtube-upload-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation()
        const accountId = btn.dataset.accountId
        const account = this.activeYouTubeAccounts.find(a => a.id === accountId)
        if (account) {
          this.saveToYouTubeAccount(account)
        }
      })
    })

    this.activeYouTubeAccounts.forEach(account => {
      if (!account.playlists) {
        this.refreshYouTubePlaylists(account.id)
      }
    })
  }

  async refreshYouTubePlaylists(accountId) {
    try {
      const result = await window.electronAPI.youtubeGetPlaylists(accountId)
      if (result && result.success) {
        const account = this.activeYouTubeAccounts.find(a => a.id === accountId)
        if (account) {
          account.playlists = result.playlists
          this.renderYouTubeAccounts()
        }
      }
    } catch (error) {}
  }

  updateYouTubePlaylist(accountId, playlistId) {
    const account = this.activeYouTubeAccounts.find(a => a.id === accountId)
    if (account) {
      account.selectedPlaylistId = playlistId
    }
  }

  toggleYouTubeAccountSelection(accountId) {
    if (this.selectedYouTubeAccounts.has(accountId)) {
      this.selectedYouTubeAccounts.delete(accountId)
    } else {
      this.selectedYouTubeAccounts.add(accountId)
    }
    this.renderYouTubeAccounts()
  }

  async updateYouTubeAccountPrivacy(accountId, privacy) {
    try {
      const account = this.activeYouTubeAccounts.find(a => a.id === accountId)
      if (account) {
        account.privacy = privacy
        await window.electronAPI.youtubeAccountsUpdate(accountId, { privacy })
      }
    } catch (error) {
      this.showError('Failed to update YouTube account privacy')
    }
  }

  async saveToYouTubeAccount(account) {
    const fileNameInput = document.getElementById('fileName')
    const title = fileNameInput.value.trim() || 'Screen Recording'
    const description = 'Uploaded with StreamSnap'

    try {
      const btn = document.querySelector(`button[data-account-id="${account.id}"]`)
      if (btn) {
        btn.disabled = true
        btn.innerHTML = '⏳ Uploading...'
      }

      this.showSavingState(true)
      const savingText = document.getElementById('savingText')
      savingText.textContent = `Uploading to ${account.channelName || 'YouTube'}...`

      const videoData = await this.prepareVideoData()

      const uploadOptions = {
        accountId: account.id,
        videoData: videoData,
        title,
        description,
        privacy: account.privacy || 'private'
      }

      if (account.selectedPlaylistId) {
        uploadOptions.playlistId = account.selectedPlaylistId
      }

      const result = await window.electronAPI.saveToYouTubeAccount(uploadOptions)

      this.showSavingState(false)

      if (result && result.success) {
        if (btn) {
          btn.innerHTML = '✅ Uploaded!'
        }

        this.showYouTubeSuccessModal(account.channelName, result.videoUrl, title)
      } else {
        this.showError(`Failed to upload to YouTube: ${result?.error || 'Unknown error'}`)
        if (btn) {
          btn.disabled = false
          btn.innerHTML = '▶️ Upload to YouTube'
        }
      }
    } catch (error) {
      this.showSavingState(false)
      this.showError(`Failed to upload to YouTube: ${error.message}`)
      const btn = document.querySelector(`button[data-account-id="${account.id}"]`)
      if (btn) {
        btn.disabled = false
        btn.innerHTML = '▶️ Upload to YouTube'
      }
    }
  }

  showYouTubeSuccessModal(channelName, videoUrl, title) {
    try {
      if (typeof UploadSuccessModal === 'undefined') {
        this.showSuccess('Video uploaded successfully!')
        return
      }

      const modal = new UploadSuccessModal()
      modal.show(channelName, videoUrl, title, {
        platform: 'youtube',
        title: 'Video Uploaded!',
        subtitle: 'Your video has been successfully uploaded to YouTube',
        details: [
          { label: 'Channel:', value: channelName },
          { label: 'Title:', value: title }
        ],
        primaryButtonText: 'Open & Copy'
      })
    } catch (error) {
      this.showSuccess('Video uploaded successfully!')
    }
  }

  async manageYouTubeAccounts() {
    try {
      await window.electronAPI.youtubeAccountsOpen()
    } catch (error) {
      this.showError('Failed to open YouTube accounts manager')
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.saveVideoHandler = new SaveVideoHandler()
})
