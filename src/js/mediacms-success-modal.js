class MediaCMSSuccessModal {
  constructor() {
    this.modal = null
  }

  show(serverUrl, videoUrl, fileName) {
    try {
      const modalHTML = `<div class="modal-overlay"><div class="modal-content"><div class="modal-header"><div class="success-icon">✅</div><h2 class="modal-title">Uploaded to MediaCMS!</h2><p class="modal-subtitle">Your video has been saved to ${serverUrl}</p></div><div class="modal-info"><div class="info-item"><p class="info-label">File Name:</p><p class="info-value">${fileName}</p></div>${videoUrl ? `<div class="info-item"><p class="info-label">MediaCMS Link:</p><p class="info-value link-value">${videoUrl}</p></div>` : ''}</div><div class="modal-actions">${videoUrl ? `<button id="mediaCMSModalCopyBtn" class="btn btn-secondary">📋 Copy Link</button><button id="mediaCMSModalOpenBtn" class="btn btn-primary">Open Video</button>` : ''}<button id="mediaCMSModalCloseBtn" class="btn btn-secondary">Close</button></div></div></div>`

      const modalContainer = document.createElement('div')
      modalContainer.innerHTML = modalHTML.trim()

      const modalElement = modalContainer.firstElementChild

      if (!modalElement) {
        throw new Error('Modal element not created')
      }

      document.body.appendChild(modalElement)
      this.modal = modalElement
      this.setupEventListeners(videoUrl)
    } catch (error) {
      throw error
    }
  }

  setupEventListeners(videoUrl) {
    const copyBtn = document.getElementById('mediaCMSModalCopyBtn')
    const openBtn = document.getElementById('mediaCMSModalOpenBtn')
    const closeBtn = document.getElementById('mediaCMSModalCloseBtn')

    if (copyBtn && videoUrl) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(videoUrl)
          copyBtn.textContent = '✅ Copied!'
          setTimeout(() => {
            copyBtn.textContent = '📋 Copy Link'
          }, 2000)
        } catch (error) {
          copyBtn.textContent = '❌ Failed'
          setTimeout(() => {
            copyBtn.textContent = '📋 Copy Link'
          }, 2000)
        }
      })
    }

    if (openBtn && videoUrl) {
      openBtn.addEventListener('click', async () => {
        await window.electronAPI.openExternal(videoUrl)
      })
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.close()
      })
    }

    if (this.modal) {
      this.modal.addEventListener('click', e => {
        if (e.target === this.modal) {
          this.close()
        }
      })
    }
  }

  close() {
    if (this.modal) {
      this.modal.remove()
      this.modal = null
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MediaCMSSuccessModal
}
