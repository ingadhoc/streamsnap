class UploadSuccessModal {
  constructor() {
    this.modal = null
  }

  show(accountName, webViewLink, fileName, options = {}) {
    try {
      const platform = options.platform || 'drive'
      const icon = options.icon || (platform === 'youtube' ? '▶️' : '✅')
      const title =
        options.title || (platform === 'youtube' ? 'Video Uploaded!' : 'Uploaded to Drive!')
      const subtitle =
        options.subtitle ||
        (platform === 'youtube'
          ? 'Your video has been successfully uploaded to YouTube'
          : `Your video has been saved to ${accountName}`)

      const details = Array.isArray(options.details)
        ? options.details
        : [{ label: options.fileLabel || 'File Name:', value: fileName }]

      const detailsHTML = details
        .filter(item => item && item.value)
        .map(
          item =>
            `<div class="info-item"><p class="info-label">${item.label}</p><p class="info-value">${item.value}</p></div>`
        )
        .join('')

      const primaryLabel = options.primaryButtonText || 'Open & Copy'

      const modalHTML = `<div class="modal-overlay"><div class="modal-content"><div class="modal-header"><div class="success-icon">${icon}</div><h2 class="modal-title">${title}</h2><p class="modal-subtitle">${subtitle}</p></div><div class="modal-info">${detailsHTML}</div><div class="modal-actions">${webViewLink ? `<button id="driveModalOpenCopyBtn" class="btn btn-primary">${primaryLabel}</button>` : ''}<button id="driveModalCloseBtn" class="btn btn-secondary">Close</button></div></div></div>`

      const modalContainer = document.createElement('div')
      modalContainer.innerHTML = modalHTML.trim()

      const modalElement = modalContainer.firstElementChild

      if (!modalElement) {
        throw new Error('Modal element not created')
      }

      document.body.appendChild(modalElement)
      this.modal = modalElement
      this.setupEventListeners(webViewLink, primaryLabel)
    } catch (error) {
      throw error
    }
  }

  setupEventListeners(webViewLink, primaryLabel) {
    const openCopyBtn = document.getElementById('driveModalOpenCopyBtn')
    const closeBtn = document.getElementById('driveModalCloseBtn')

    if (openCopyBtn && webViewLink) {
      openCopyBtn.addEventListener('click', async () => {
        try {
          const [openResult, copyResult] = await Promise.allSettled([
            window.electronAPI.openExternal(webViewLink),
            navigator.clipboard.writeText(webViewLink)
          ])

          if (openResult.status === 'fulfilled' && copyResult.status === 'fulfilled') {
            openCopyBtn.textContent = '✅ Opened & Copied'
          } else if (openResult.status === 'fulfilled') {
            openCopyBtn.textContent = '✅ Opened'
          } else if (copyResult.status === 'fulfilled') {
            openCopyBtn.textContent = '✅ Copied'
          } else {
            openCopyBtn.textContent = '❌ Failed'
          }

          setTimeout(() => {
            openCopyBtn.textContent = primaryLabel
          }, 2000)
        } catch (error) {
          openCopyBtn.textContent = '❌ Failed'
          setTimeout(() => {
            openCopyBtn.textContent = primaryLabel
          }, 2000)
        }
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
  module.exports = UploadSuccessModal
}
