class SourceSelector {
  constructor() {
    this.selectedSource = null
    this.activeTab = 'screen'
    this.sources = []
    this.isObserving = false
    this.lastSourceCount = 0
    // In modal mode the start button has a different ID to avoid conflicts with main window
    this._startBtnId = window.__sourceSelectorModalMode ? 'ssSelectorStartBtn' : 'startRecordingBtn'

    this.initializeUI()
    this.loadSources()
    this.startRealTimeDetection()
  }

  initializeUI() {
    document.getElementById('screenTab').addEventListener('click', () => this.switchTab('screen'))
    document.getElementById('windowTab').addEventListener('click', () => this.switchTab('window'))

    document.getElementById('closeBtn').addEventListener('click', () => this.close())
    document.getElementById('cancelBtn').addEventListener('click', () => this.close())
    document.getElementById(this._startBtnId).addEventListener('click', () => this.startRecording())

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.close()
    })

    window.addEventListener('focus', () => this.onWindowFocus())
    document.addEventListener('visibilitychange', () => this.onVisibilityChange())
  }

  startRealTimeDetection() {
    if (this.isObserving) return

    this.isObserving = true
    // On Linux/Wayland each call to getDesktopSources() opens the XDG portal.
    // Focus/visibility events would re-trigger that portal causing an infinite loop,
    // so only the MutationObserver (safe, DOM-only) is set up on Linux.
    if (window.electronAPI?.platform !== 'linux') {
      this.setupSystemObservers()
    }
    this.setupMutationObserver()
  }

  setupSystemObservers() {
    if (this._systemObserversSetup) return
    this._systemObserversSetup = true

    if (window.electronAPI && window.electronAPI.onAppActivate) {
      window.electronAPI.onAppActivate(() => {
        this.checkForSourceChanges()
      })
    }

    if (window.electronAPI && window.electronAPI.onWindowStateChange) {
      window.electronAPI.onWindowStateChange(() => {
        this.checkForSourceChanges()
      })
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.checkForSourceChanges()
        }
      })
    })

    this._intersectionObserver = observer

    if (window.__sourceSelectorModalMode) {
      const overlay = document.getElementById('sourceSelectorOverlay')
      if (overlay) observer.observe(overlay)
    } else {
      observer.observe(document.body)
    }
  }

  setupMutationObserver() {
    const windowContainer = document.getElementById('windowSources')
    const screenContainer = document.getElementById('screenSources')

    const mutationObserver = new MutationObserver(mutations => {
      let shouldUpdate = false
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
          shouldUpdate = true
        }
      })

      if (shouldUpdate) {
        this.updateSourceCounts()
      }
    })

    if (windowContainer) {
      mutationObserver.observe(windowContainer, { childList: true })
    }
    if (screenContainer) {
      mutationObserver.observe(screenContainer, { childList: true })
    }
  }

  onWindowFocus() {
    if (window.electronAPI?.platform === 'linux') return
    this.checkForSourceChanges()
  }

  onVisibilityChange() {
    if (window.electronAPI?.platform === 'linux') return
    if (!document.hidden) {
      this.checkForSourceChanges()
    }
  }

  async checkForSourceChanges() {
    if (!this.isObserving) return

    try {
      const newSources = await window.electronAPI.getDesktopSources()

      if (newSources.length !== this.sources.length) {
        this.sources = newSources
        this.populateSources()
        this.showSourceChangeNotification(newSources.length - this.sources.length)
        return
      }

      const currentIds = this.sources.map(s => s.id).sort()
      const newIds = newSources.map(s => s.id).sort()

      const idsChanged = currentIds.length !== newIds.length || currentIds.some((id, index) => id !== newIds[index])

      if (idsChanged) {
        this.sources = newSources
        this.populateSources()
        this.showSourceChangeNotification()
      }
    } catch (error) {}
  }

  showSourceChangeNotification(change) {
    const notification = document.createElement('div')
    notification.className =
      'fixed top-4 right-4 bg-green-500 text-white px-3 py-2 rounded-lg shadow-lg z-50 text-sm animate-fade-in'
    notification.innerHTML = '🔄 Sources updated'

    document.body.appendChild(notification)

    setTimeout(() => {
      notification.style.opacity = '0'
      notification.style.transform = 'translateY(-10px)'
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification)
        }
      }, 300)
    }, 2000)
  }

  updateSourceCounts() {
    const windowCount = document.getElementById('windowSources')?.children.length || 0
    const screenCount = document.getElementById('screenSources')?.children.length || 0

    const windowTab = document.getElementById('windowTab')
    const screenTab = document.getElementById('screenTab')

    windowTab.querySelector('.source-count')?.remove()
    screenTab.querySelector('.source-count')?.remove()

    if (windowCount > 0) {
      const badge = document.createElement('span')
      badge.className = 'source-count ml-1 bg-blue-500 text-white text-xs rounded-full px-2 py-0.5'
      badge.textContent = windowCount
      windowTab.appendChild(badge)
    }

    if (screenCount > 0) {
      const badge = document.createElement('span')
      badge.className = 'source-count ml-1 bg-blue-500 text-white text-xs rounded-full px-2 py-0.5'
      badge.textContent = screenCount
      screenTab.appendChild(badge)
    }
  }

  switchTab(tab) {
    this.activeTab = tab

    const windowTab = document.getElementById('windowTab')
    const screenTab = document.getElementById('screenTab')
    const windowContent = document.getElementById('windowContent')
    const screenContent = document.getElementById('screenContent')
    const windowInfoBanner = document.getElementById('windowInfoBanner')

    if (tab === 'screen') {
      screenTab.className =
        'flex-1 py-4 px-6 text-center font-semibold border-b-2 border-blue-500 text-blue-600 bg-blue-50'
      windowTab.className =
        'flex-1 py-4 px-6 text-center font-semibold border-b-2 border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-all'
      screenContent.classList.remove('hidden')
      windowContent.classList.add('hidden')
      windowInfoBanner.classList.add('hidden')
    } else {
      windowTab.className =
        'flex-1 py-4 px-6 text-center font-semibold border-b-2 border-blue-500 text-blue-600 bg-blue-50'
      screenTab.className =
        'flex-1 py-4 px-6 text-center font-semibold border-b-2 border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-all'
      windowContent.classList.remove('hidden')
      screenContent.classList.add('hidden')
      windowInfoBanner.classList.remove('hidden')
    }

    // On Linux, switching tabs must not trigger getDesktopSources() (portal loop).
    if (window.electronAPI?.platform !== 'linux') {
      this.checkForSourceChanges()
    }
  }

  async loadSources() {
    try {
      this.sources = await window.electronAPI.getDesktopSources()
      this.populateSources()
    } catch (error) {
      this.showError('Failed to load available sources')
    }
  }

  populateSources() {
    const windowSources = this.sources.filter(s => s.id.startsWith('window:'))
    const screenSources = this.sources.filter(s => s.id.startsWith('screen:'))

    this.populateWindowSources(windowSources)
    this.populateScreenSources(screenSources)
    this.updateSourceCounts()
  }

  populateWindowSources(windows) {
    const container = document.getElementById('windowSources')
    const noWindows = document.getElementById('noWindows')

    if (windows.length === 0) {
      container.classList.add('hidden')
      noWindows.classList.remove('hidden')
      return
    }

    container.classList.remove('hidden')
    noWindows.classList.add('hidden')
    container.innerHTML = ''

    windows.forEach(source => {
      const sourceCard = this.createSourceCard(source)
      container.appendChild(sourceCard)
    })
  }

  populateScreenSources(screens) {
    const container = document.getElementById('screenSources')
    const noScreens = document.getElementById('noScreens')

    if (screens.length === 0) {
      container.classList.add('hidden')
      noScreens.classList.remove('hidden')
      return
    }

    container.classList.remove('hidden')
    noScreens.classList.add('hidden')
    container.innerHTML = ''

    screens.forEach(source => {
      const sourceCard = this.createSourceCard(source, true)
      container.appendChild(sourceCard)
    })
  }

  createSourceCard(source, isScreen = false) {
    const card = document.createElement('div')
    card.className = `
      bg-white border-2 border-gray-200 rounded-xl p-4 cursor-pointer transition-all duration-200
      hover:border-blue-400 hover:shadow-lg group animate-fade-in
    `

    const thumbnailContainer = document.createElement('div')
    thumbnailContainer.className = `w-full ${isScreen ? 'h-32' : 'h-24'} bg-gray-100 rounded-lg mb-3 overflow-hidden relative`

    if (source.thumbnail && source.thumbnail.dataURL && !source.thumbnail.isEmpty) {
      const thumbnail = document.createElement('img')
      thumbnail.src = source.thumbnail.dataURL
      thumbnail.className = 'w-full h-full object-cover'

      thumbnail.onerror = e => {
        this.addFallbackIcon(thumbnailContainer, isScreen)
      }

      thumbnailContainer.appendChild(thumbnail)
    } else {
      this.addFallbackIcon(thumbnailContainer, isScreen)
    }

    const info = document.createElement('div')
    info.innerHTML = `
      <h3 class="font-semibold text-gray-800 text-sm mb-1 truncate group-hover:text-blue-600 transition-colors">
        ${source.name || 'Unknown Source'}
      </h3>
      <p class="text-xs text-gray-500">
        ${isScreen ? 'Screen' : 'Window'}
      </p>
    `

    const selectionIndicator = document.createElement('div')
    selectionIndicator.className =
      'absolute top-2 right-2 w-6 h-6 rounded-full border-2 border-white bg-white shadow-md hidden'
    selectionIndicator.innerHTML = '✓'
    selectionIndicator.style.color = '#3b82f6'
    selectionIndicator.style.fontSize = '12px'
    selectionIndicator.style.display = 'flex'
    selectionIndicator.style.alignItems = 'center'
    selectionIndicator.style.justifyContent = 'center'

    thumbnailContainer.appendChild(selectionIndicator)
    card.appendChild(thumbnailContainer)
    card.appendChild(info)

    card.addEventListener('click', () => this.selectSource(source, card))

    return card
  }

  addFallbackIcon(container, isScreen) {
    container.innerHTML = `
      <div class="w-full h-full flex flex-col items-center justify-center text-gray-400 text-lg bg-gradient-to-br from-gray-100 to-gray-200">
        <div class="text-2xl mb-2">${isScreen ? '🖥️' : '🪟'}</div>
        <div class="text-xs text-gray-500 text-center px-2">
          ${isScreen ? 'Screen' : 'Window'}<br>
          <span class="text-blue-500">Ready to record</span>
        </div>
      </div>
    `
  }

  selectSource(source, cardElement) {
    const now = Date.now()
    if (this._lastSourceSelectAt && now - this._lastSourceSelectAt < 300) {
      return
    }
    this._lastSourceSelectAt = now

    const allCards = document.querySelectorAll('.source-card-selected')
    allCards.forEach(card => {
      card.classList.remove('source-card-selected', 'border-blue-500', 'bg-blue-50')
      card.classList.add('border-gray-200')
      const indicator = card.querySelector('.absolute')
      if (indicator) indicator.classList.add('hidden')
    })

    cardElement.classList.add('source-card-selected', 'border-blue-500', 'bg-blue-50')
    cardElement.classList.remove('border-gray-200')
    const indicator = cardElement.querySelector('.absolute')
    if (indicator) indicator.classList.remove('hidden')

    this.selectedSource = source
    document.getElementById('selectedInfo').classList.remove('hidden')
    document.getElementById('selectedName').textContent = source.name
    document.getElementById(this._startBtnId).disabled = false
  }

  startRecording() {
    if (!this.selectedSource) {
      return
    }

    const now = Date.now()
    if (this._lastStartRecordingAt && now - this._lastStartRecordingAt < 500) {
      return
    }
    this._lastStartRecordingAt = now

    const sourceData = {
      id: this.selectedSource.id,
      name: this.selectedSource.name,
      display_index: this.selectedSource.display_index,
      display_id: this.selectedSource.display_id
    }

    const startBtn = document.getElementById(this._startBtnId)
    if (startBtn) {
      startBtn.disabled = true
      startBtn.textContent = 'Starting...'
    }

    if (window.electronAPI && window.electronAPI.sourceSelected) {
      window.electronAPI.sourceSelected(sourceData)
    }

    this.close()
  }

  close() {
    this.isObserving = false

    if (this._intersectionObserver) {
      this._intersectionObserver.disconnect()
      this._intersectionObserver = null
    }

    if (window.__sourceSelectorModalMode) {
      const overlay = document.getElementById('sourceSelectorOverlay')
      if (overlay) overlay.classList.add('hidden')
      return
    }

    if (window.electronAPI && window.electronAPI.closeSourceSelector) {
      window.electronAPI.closeSourceSelector()
    } else {
      window.close()
    }
  }

  showError(message) {
    const errorDiv = document.createElement('div')
    errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
    errorDiv.textContent = message

    document.body.appendChild(errorDiv)

    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv)
      }
    }, 5000)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.__isMainWindow) return
  new SourceSelector()
})
