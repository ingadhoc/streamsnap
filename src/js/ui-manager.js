class UIManager {
  constructor() {
    this.statusElement = document.getElementById('recordingStatus')
    this.startButton = document.getElementById('startRecordingBtn')
    this.conversionProgressContainer = document.getElementById('conversionProgressContainer')
    this.conversionProgressBar = document.getElementById('conversionProgressBar')
    this.conversionProgressPercent = document.getElementById('conversionProgressPercent')
  }

  updateRecordingStatus(text, status = 'ready') {
    const dotElement = this.statusElement.querySelector('div')
    this.statusElement.className = 'inline-flex items-center px-5 py-2 rounded-full text-sm font-medium mb-8 '
    dotElement.className = 'w-2 h-2 rounded-full mr-2 '

    if (status === 'recording') {
      this.statusElement.className += 'bg-red-50 text-red-700'
      dotElement.className += 'bg-red-600 animate-pulse'
    } else if (status === 'complete') {
      this.statusElement.className += 'bg-green-50 text-green-700'
      dotElement.className += 'bg-green-600'
    } else {
      this.statusElement.className += 'bg-gray-100 text-gray-700'
      dotElement.className += 'bg-gray-400'
    }

    this.statusElement.lastChild.textContent = text
  }

  enableStartButton() {
    this.startButton.disabled = false
  }

  disableStartButton() {
    this.startButton.disabled = true
  }

  showConversionProgress(percent = null) {
    if (!this.conversionProgressContainer) return

    this.conversionProgressContainer.classList.remove('hidden')

    const numericPercent = typeof percent === 'number' ? Math.max(0, Math.min(100, Math.round(percent))) : 0

    if (this.conversionProgressBar) {
      this.conversionProgressBar.style.width = `${numericPercent}%`
    }

    if (this.conversionProgressPercent) {
      this.conversionProgressPercent.textContent = `${numericPercent}%`
    }
  }

  hideConversionProgress() {
    if (!this.conversionProgressContainer) return

    this.conversionProgressContainer.classList.add('hidden')

    if (this.conversionProgressBar) {
      this.conversionProgressBar.style.width = '0%'
    }

    if (this.conversionProgressPercent) {
      this.conversionProgressPercent.textContent = '0%'
    }
  }

  showError(message) {
    alert(`${message}`)
  }

  showSuccess(message) {
    this.updateRecordingStatus(message, 'complete')
  }

  getPrivacyDisplayName(privacy) {
    switch (privacy) {
      case 'anyone':
        return 'Public (anyone can find and view)'
      case 'anyoneWithLink':
        return 'Anyone with the link'
      case 'domain':
        return 'Organization only'
      case 'restricted':
      default:
        return 'Private (only you)'
    }
  }

  showUploadSuccessModal(payload) {
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
    modal.innerHTML = `
            <div class="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
                <div class="text-center mb-6">
                    <div class="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="text-2xl text-white">✅</span>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-800 mb-2">Video Uploaded Successfully!</h3>
                    <p class="text-gray-600">🎥 ${payload.fileName}</p>
                    <p class="text-sm text-gray-500 mt-1">🔐 Privacy: ${this.getPrivacyDisplayName(payload.privacy)}</p>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Video Link:</label>
                        <div class="flex gap-2">
                            <input type="text" id="videoLinkInput" readonly 
                                   class="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm" 
                                   value="${payload.webViewLink || payload.results?.[0]?.webViewLink || 'Link not available'}">
                            <button id="copyLinkBtn" 
                                    class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                                    ${!payload.webViewLink && !payload.results?.[0]?.webViewLink ? 'disabled' : ''}>
                                📋 Copy
                            </button>
                        </div>
                    </div>
                    
                    <div class="flex gap-2">
                        <button id="openLinkBtn" 
                                class="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors">
                            🌐 Open in Browser
                        </button>
                        <button id="closeModalBtn" 
                                class="flex-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `

    document.body.appendChild(modal)

    modal.querySelector('#copyLinkBtn').addEventListener('click', () => {
      const linkToOpen = payload.webViewLink || payload.results?.[0]?.webViewLink
      if (!linkToOpen || linkToOpen === 'Link not available') return

      const linkInput = modal.querySelector('#videoLinkInput')
      linkInput.select()
      document.execCommand('copy')

      const copyBtn = modal.querySelector('#copyLinkBtn')
      const originalText = copyBtn.innerHTML
      copyBtn.innerHTML = '✅ Copied!'
      copyBtn.classList.add('bg-green-600')
      setTimeout(() => {
        copyBtn.innerHTML = originalText
        copyBtn.classList.remove('bg-green-600')
      }, 2000)
    })

    modal.querySelector('#openLinkBtn').addEventListener('click', () => {
      const linkToOpen = payload.webViewLink || payload.results?.[0]?.webViewLink
      if (linkToOpen && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(linkToOpen)
      }
    })

    modal.querySelector('#closeModalBtn').addEventListener('click', () => {
      document.body.removeChild(modal)
    })

    modal.addEventListener('click', e => {
      if (e.target === modal) {
        document.body.removeChild(modal)
      }
    })
  }
}
