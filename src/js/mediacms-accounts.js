class MediaCMSAccountsManager {
  constructor() {
    this.manageBtn = null
    this.statusElement = null
  }

  init() {
    this.manageBtn = document.getElementById('manageMediaCMSBtn')
    this.statusElement = document.getElementById('mediaCMSStatus')

    if (this.manageBtn) {
      this.manageBtn.addEventListener('click', () => this.handleManageClick())
    }

    this.updateStatus()

    if (window.electronAPI && window.electronAPI.onMediaCMSAuthUpdated) {
      window.electronAPI.onMediaCMSAuthUpdated(() => {
        this.updateStatus()
      })
    }
  }

  async updateStatus() {
    try {
      if (window.electronAPI && window.electronAPI.mediaCMSGetConfig) {
        const result = await window.electronAPI.mediaCMSGetConfig()
        if (result && result.success && result.config) {
          const { isAuthenticated, serverUrl, username } = result.config
          if (isAuthenticated && serverUrl) {
            this.statusElement.textContent = `Connected to ${serverUrl} as ${username}`
          } else {
            this.statusElement.textContent = 'Configure your MediaCMS server for uploads'
          }
        }
      }
    } catch (error) {
      console.error('Error updating MediaCMS status:', error)
    }
  }

  async handleManageClick() {
    try {
      if (window.electronAPI && window.electronAPI.mediaCMSOpen) {
        await window.electronAPI.mediaCMSOpen()
      } else {
        console.error('MediaCMS: electronAPI.mediaCMSOpen not available')
      }
    } catch (error) {
      console.error('Error opening MediaCMS settings:', error)
      alert('Failed to open MediaCMS settings: ' + error.message)
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const manager = new MediaCMSAccountsManager()
  manager.init()
})
