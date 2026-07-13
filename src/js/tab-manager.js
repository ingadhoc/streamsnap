window.TabManager = class TabManager {
  constructor() {
    this.recordTab = null
    this.settingsTab = null
    this.historyTab = null
    this.localVideosTab = null
    this.recordContent = null
    this.settingsContent = null
    this.historyContent = null
    this.localVideosContent = null
  }

  init() {
    this.recordTab = document.getElementById('recordTab')
    this.settingsTab = document.getElementById('settingsTab')
    this.historyTab = document.getElementById('historyTab')
    this.localVideosTab = document.getElementById('localVideosTab')
    this.recordContent = document.getElementById('recordPanel')
    this.settingsContent = document.getElementById('settingsPanel')
    this.historyContent = document.getElementById('historyPanel')
    this.localVideosContent = document.getElementById('localVideosPanel')

    if (
      this.recordTab &&
      this.settingsTab &&
      this.historyTab &&
      this.recordContent &&
      this.settingsContent &&
      this.historyContent
    ) {
      this.setupTabs()
    }
  }

  setupTabs() {
    this.recordTab.addEventListener('click', () => {
      this.showRecordTab()
    })

    this.settingsTab.addEventListener('click', () => {
      this.showSettingsTab()
    })

    this.historyTab.addEventListener('click', () => {
      this.showHistoryTab()
    })

    if (this.localVideosTab) {
      this.localVideosTab.addEventListener('click', () => {
        this.showLocalVideosTab()
      })
    }

    this.showRecordTab()
  }

  _setActiveTab(activeTab) {
    const tabs = [this.recordTab, this.settingsTab, this.historyTab, this.localVideosTab].filter(Boolean)
    tabs.forEach(tab => {
      if (tab === activeTab) {
        tab.classList.add('active', 'border-blue-500', 'text-blue-600')
        tab.classList.remove('border-transparent', 'text-gray-500')
      } else {
        tab.classList.remove('active', 'border-blue-500', 'text-blue-600')
        tab.classList.add('border-transparent', 'text-gray-500')
      }
    })
  }

  _showPanel(activePanel) {
    const panels = [this.recordContent, this.settingsContent, this.historyContent, this.localVideosContent].filter(Boolean)
    panels.forEach(panel => {
      if (panel === activePanel) {
        panel.classList.remove('hidden')
      } else {
        panel.classList.add('hidden')
      }
    })
  }

  showRecordTab() {
    this._setActiveTab(this.recordTab)
    this._showPanel(this.recordContent)
  }

  showSettingsTab() {
    this._setActiveTab(this.settingsTab)
    this._showPanel(this.settingsContent)
  }

  showHistoryTab() {
    this._setActiveTab(this.historyTab)
    this._showPanel(this.historyContent)

    if (window.screenRecorder && window.screenRecorder.historyManager) {
      window.screenRecorder.historyManager.init()
      window.screenRecorder.historyManager.refresh()
    }
  }

  showLocalVideosTab() {
    this._setActiveTab(this.localVideosTab)
    this._showPanel(this.localVideosContent)

    if (window.localVideosManager) {
      window.localVideosManager.refresh()
    } else if (window.LocalVideosManager && this.localVideosContent) {
      window.localVideosManager = new window.LocalVideosManager(this.localVideosContent)
      window.localVideosManager.refresh()
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const tabManager = new window.TabManager()
  tabManager.init()
})
