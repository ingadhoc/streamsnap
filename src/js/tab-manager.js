window.TabManager = class TabManager {
  constructor() {
    this.recordTab = null
    this.settingsTab = null
    this.historyTab = null
    this.recordContent = null
    this.settingsContent = null
    this.historyContent = null
  }

  init() {
    this.recordTab = document.getElementById('recordTab')
    this.settingsTab = document.getElementById('settingsTab')
    this.historyTab = document.getElementById('historyTab')
    this.recordContent = document.getElementById('recordPanel')
    this.settingsContent = document.getElementById('settingsPanel')
    this.historyContent = document.getElementById('historyPanel')

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

    this.showRecordTab()
  }

  showRecordTab() {
    this.recordTab.classList.add('active', 'border-blue-500', 'text-blue-600')
    this.recordTab.classList.remove('border-transparent', 'text-gray-500')
    this.settingsTab.classList.remove('active', 'border-blue-500', 'text-blue-600')
    this.settingsTab.classList.add('border-transparent', 'text-gray-500')
    this.historyTab.classList.remove('active', 'border-blue-500', 'text-blue-600')
    this.historyTab.classList.add('border-transparent', 'text-gray-500')

    this.recordContent.classList.remove('hidden')
    this.settingsContent.classList.add('hidden')
    this.historyContent.classList.add('hidden')
  }

  showSettingsTab() {
    this.settingsTab.classList.add('active', 'border-blue-500', 'text-blue-600')
    this.settingsTab.classList.remove('border-transparent', 'text-gray-500')
    this.recordTab.classList.remove('active', 'border-blue-500', 'text-blue-600')
    this.recordTab.classList.add('border-transparent', 'text-gray-500')
    this.historyTab.classList.remove('active', 'border-blue-500', 'text-blue-600')
    this.historyTab.classList.add('border-transparent', 'text-gray-500')

    this.settingsContent.classList.remove('hidden')
    this.recordContent.classList.add('hidden')
    this.historyContent.classList.add('hidden')
  }

  showHistoryTab() {
    this.historyTab.classList.add('active', 'border-blue-500', 'text-blue-600')
    this.historyTab.classList.remove('border-transparent', 'text-gray-500')
    this.recordTab.classList.remove('active', 'border-blue-500', 'text-blue-600')
    this.recordTab.classList.add('border-transparent', 'text-gray-500')
    this.settingsTab.classList.remove('active', 'border-blue-500', 'text-blue-600')
    this.settingsTab.classList.add('border-transparent', 'text-gray-500')

    this.historyContent.classList.remove('hidden')
    this.recordContent.classList.add('hidden')
    this.settingsContent.classList.add('hidden')

    if (window.screenRecorder && window.screenRecorder.historyManager) {
      window.screenRecorder.historyManager.init()
      window.screenRecorder.historyManager.refresh()
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const tabManager = new window.TabManager()
  tabManager.init()
})
