class UploadSuccessModal {
  constructor() {
    this.modal = null
  }

  close() {
    if (this.modal) {
      this.modal.remove()
      this.modal = null
    }
  }

  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
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

  showLocalSave(filePath, fileName) {
    try {
      const safePath = this.escapeHtml(filePath || '')
      const safeName = this.escapeHtml(fileName || '')

      const modalHTML = `<div class="modal-overlay"><div class="modal-content"><div class="modal-header"><div class="success-icon">✅</div><h2 class="modal-title">Saved to Computer!</h2><p class="modal-subtitle">Your recording was saved locally.</p></div><div class="modal-info"><div class="info-item"><p class="info-label">File Name:</p><p class="info-value">${safeName}</p></div><div class="info-item"><p class="info-label">Location:</p><p class="info-value" style="word-break: break-all;">${safePath}</p></div></div><div class="modal-actions"><button id="localModalOpenCopyBtn" class="btn btn-primary">Open Folder & Copy Path</button><button id="localModalCloseBtn" class="btn btn-secondary">Close</button></div></div></div>`

      const modalContainer = document.createElement('div')
      modalContainer.innerHTML = modalHTML.trim()

      const modalElement = modalContainer.firstElementChild
      if (!modalElement) {
        throw new Error('Modal element not created')
      }

      document.body.appendChild(modalElement)
      this.modal = modalElement

      const openCopyBtn = this.modal.querySelector('#localModalOpenCopyBtn')
      if (openCopyBtn) {
        openCopyBtn.addEventListener('click', async () => {
          const [openResult, copyResult] = await Promise.allSettled([
            window.electronAPI.openFolder(filePath),
            navigator.clipboard.writeText(filePath)
          ])

          if (openResult.status === 'fulfilled' && copyResult.status === 'fulfilled') {
            openCopyBtn.textContent = 'Opened & Copied'
          } else if (openResult.status === 'fulfilled') {
            openCopyBtn.textContent = 'Opened'
          } else if (copyResult.status === 'fulfilled') {
            openCopyBtn.textContent = 'Copied'
          } else {
            openCopyBtn.textContent = 'Failed'
          }

          setTimeout(() => {
            openCopyBtn.textContent = 'Open Folder & Copy Path'
          }, 1500)
        })
      }

      const closeBtn = this.modal.querySelector('#localModalCloseBtn')
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.close())
      }

      this.modal.addEventListener('click', e => {
        if (e.target === this.modal) {
          this.close()
        }
      })
    } catch (error) {
      throw error
    }
  }

  setupEventListeners(webViewLink, primaryLabel) {
    if (!this.modal) return

    const openCopyBtn = this.modal.querySelector('#driveModalOpenCopyBtn')
    const closeBtn = this.modal.querySelector('#driveModalCloseBtn')

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

  showAutoSaveDrive(uploads = [], initialTitle = '', onRename) {
    try {
      const safeUploads = Array.isArray(uploads) ? uploads : []
      const listHtml = safeUploads
        .map((upload, index) => {
          const accountName = this.escapeHtml(upload.accountName || upload.accountEmail || 'Drive account')
          const folderName = this.escapeHtml(upload.folderName || 'Drive Folder')
          const fileName = this.escapeHtml(upload.fileName || 'Uploaded video')
          const openBtn = upload.webViewLink
            ? `<button data-link-index="${index}" class="btn btn-primary drive-modal-open-copy-btn" style="flex:0 0 auto; padding:8px 12px; font-size:12px;">Open & Copy</button>`
            : ''

          return `<div class="bg-white border border-gray-200 rounded-lg p-3"><div class="flex items-center justify-between gap-2"><div class="min-w-0"><p class="text-sm font-semibold text-gray-800 truncate">${accountName}</p><p class="text-xs text-gray-500 truncate">📁 ${folderName}</p><p class="text-xs text-gray-600 truncate mt-1">${fileName}</p></div>${openBtn}</div></div>`
        })
        .join('')

      const modalHTML = `<div class="modal-overlay"><div class="modal-content"><div class="modal-header"><div class="success-icon">✅</div><h2 class="modal-title">Uploaded to Drive!</h2><p class="modal-subtitle">Your video has been auto-saved. You can open links or rename in Drive.</p></div><div class="modal-info"><div class="flex items-center justify-between mb-3"><p class="info-label mb-0">Uploaded Accounts</p><span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">${safeUploads.length} uploaded</span></div><div id="driveModalUploadsList" class="space-y-2">${listHtml}</div><div class="mt-4"><p class="info-label">Video Title:</p><div class="flex gap-2"><input id="driveModalTitleInput" type="text" class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" value="${this.escapeHtml(initialTitle)}" placeholder="Video title" /><button id="driveModalRenameBtn" class="btn btn-primary" style="flex:0 0 auto;">Update in Drive</button></div><p id="driveModalRenameStatus" class="text-xs text-gray-600 mt-2"></p></div></div><div class="modal-actions"><button id="driveModalCloseBtn" class="btn btn-secondary">Close</button></div></div></div>`

      const modalContainer = document.createElement('div')
      modalContainer.innerHTML = modalHTML.trim()

      const modalElement = modalContainer.firstElementChild
      if (!modalElement) {
        throw new Error('Modal element not created')
      }

      document.body.appendChild(modalElement)
      this.modal = modalElement

      this.modal.querySelectorAll('.drive-modal-open-copy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const index = Number(btn.getAttribute('data-link-index'))
          const item = safeUploads[index]
          const link = item && item.webViewLink
          if (!link) return

          const [openResult, copyResult] = await Promise.allSettled([
            window.electronAPI.openExternal(link),
            navigator.clipboard.writeText(link)
          ])

          if (openResult.status === 'fulfilled' && copyResult.status === 'fulfilled') {
            btn.textContent = 'Opened & Copied'
          } else if (openResult.status === 'fulfilled') {
            btn.textContent = 'Opened'
          } else if (copyResult.status === 'fulfilled') {
            btn.textContent = 'Copied'
          } else {
            btn.textContent = 'Failed'
          }

          setTimeout(() => {
            btn.textContent = 'Open & Copy'
          }, 1500)
        })
      })

      const renameBtn = this.modal.querySelector('#driveModalRenameBtn')
      const titleInput = this.modal.querySelector('#driveModalTitleInput')
      const statusEl = this.modal.querySelector('#driveModalRenameStatus')

      if (renameBtn && titleInput && statusEl && typeof onRename === 'function') {
        renameBtn.addEventListener('click', async () => {
          const nextTitle = (titleInput.value || '').trim()
          if (!nextTitle) {
            statusEl.textContent = 'Please enter a title.'
            statusEl.className = 'text-xs text-red-600 mt-2'
            return
          }

          renameBtn.disabled = true
          renameBtn.style.opacity = '0.7'
          statusEl.textContent = 'Updating title in Drive...'
          statusEl.className = 'text-xs text-gray-600 mt-2'

          let result = null
          try {
            result = await onRename(nextTitle)
          } catch (error) {
            result = null
          }

          renameBtn.disabled = false
          renameBtn.style.opacity = '1'

          const updated = Number(result && result.updatedCount)
          const total = Number((result && result.total) || safeUploads.length)

          if (updated >= total && total > 0) {
            statusEl.textContent = `Title updated in ${updated} account${updated === 1 ? '' : 's'}.`
            statusEl.className = 'text-xs text-green-600 mt-2'
          } else if (updated > 0) {
            statusEl.textContent = `Updated ${updated}/${total} accounts.`
            statusEl.className = 'text-xs text-amber-600 mt-2'
          } else {
            statusEl.textContent = 'Could not update title in Drive.'
            statusEl.className = 'text-xs text-red-600 mt-2'
          }
        })
      }

      const closeBtn = this.modal.querySelector('#driveModalCloseBtn')
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.close())
      }

      this.modal.addEventListener('click', e => {
        if (e.target === this.modal) {
          this.close()
        }
      })
    } catch (error) {
      throw error
    }
  }

}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UploadSuccessModal
}
