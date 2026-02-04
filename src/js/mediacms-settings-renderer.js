class MediaCMSSettingsRenderer {
  constructor() {
    this.isLoading = false
    this.isAuthenticated = false

    this.initializeElements()
    this.loadCurrentConfig()
    this.setupEventListeners()
    this.setupAuthListener()
  }

  initializeElements() {
    this.statusBadge = document.getElementById('statusBadge')
    this.connectedInfo = document.getElementById('connectedInfo')
    this.messageArea = document.getElementById('messageArea')
    this.loginForm = document.getElementById('loginForm')
    this.serverUrlInput = document.getElementById('serverUrl')
    this.usernameInput = document.getElementById('username')
    this.passwordInput = document.getElementById('password')
    this.loginBtn = document.getElementById('loginBtn')
    this.loginBtnText = document.getElementById('loginBtnText')
    this.logoutBtn = document.getElementById('logoutBtn')
    this.closeBtn = document.getElementById('closeBtn')
  }

  async loadCurrentConfig() {
    try {
      const result = await window.electronAPI.invoke('mediacms:get-config')
      if (result.success && result.config) {
        const { serverUrl, username, isAuthenticated } = result.config
        this.isAuthenticated = isAuthenticated

        if (isAuthenticated && serverUrl && username) {
          this.serverUrlInput.value = serverUrl
          this.usernameInput.value = username
          this.updateUIForAuthState(true, serverUrl, username)
        } else {
          this.updateUIForAuthState(false)
        }
      }
    } catch (error) {
      console.error('Error loading config:', error)
      this.updateUIForAuthState(false)
    }
  }

  setupEventListeners() {
    this.loginForm.addEventListener('submit', (e) => {
      e.preventDefault()
      this.handleLogin()
    })

    this.logoutBtn.addEventListener('click', () => {
      this.handleLogout()
    })

    this.closeBtn.addEventListener('click', () => {
      window.close()
    })
  }

  setupAuthListener() {
    if (window.electronAPI && window.electronAPI.onMediaCMSAuthUpdated) {
      window.electronAPI.onMediaCMSAuthUpdated((data) => {
        if (data.success) {
          this.updateUIForAuthState(true, data.serverUrl, data.username)
        } else {
          this.updateUIForAuthState(false)
        }
      })
    }
  }

  updateUIForAuthState(authenticated, serverUrl = '', username = '') {
    this.isAuthenticated = authenticated

    if (authenticated) {
      this.statusBadge.innerHTML = '<span class="status-badge connected">✓ Connected</span>'
      this.connectedInfo.style.display = 'block'
      this.connectedInfo.innerHTML = `
        <div class="info-section">
          <p><strong>Server:</strong> ${serverUrl}</p>
          <p><strong>Username:</strong> ${username}</p>
        </div>
      `

      this.serverUrlInput.disabled = true
      this.usernameInput.disabled = true
      this.passwordInput.disabled = true
      this.passwordInput.value = '••••••••'

      this.loginBtn.style.display = 'none'
      this.logoutBtn.style.display = 'block'
    } else {
      this.statusBadge.innerHTML = '<span class="status-badge disconnected">✗ Not Connected</span>'
      this.connectedInfo.style.display = 'none'

      this.serverUrlInput.disabled = false
      this.usernameInput.disabled = false
      this.passwordInput.disabled = false
      this.passwordInput.value = ''

      this.loginBtn.style.display = 'block'
      this.logoutBtn.style.display = 'none'
    }
  }

  showMessage(message, type = 'error') {
    const className = type === 'error' ? 'error-message' : 'success-message'
    this.messageArea.innerHTML = `<div class="${className}">${message}</div>`

    setTimeout(() => {
      this.messageArea.innerHTML = ''
    }, 5000)
  }

  setLoading(loading) {
    this.isLoading = loading
    this.loginBtn.disabled = loading
    this.closeBtn.disabled = loading

    if (loading) {
      this.loginBtnText.innerHTML = '<span class="spinner"></span>Connecting...'
    } else {
      this.loginBtnText.textContent = 'Connect'
    }
  }

  async handleLogin() {
    if (this.isLoading) return

    const serverUrl = this.serverUrlInput.value.trim()
    const username = this.usernameInput.value.trim()
    const password = this.passwordInput.value

    if (!serverUrl || !username || !password) {
      this.showMessage('Please fill in all fields', 'error')
      return
    }

    try {
      new URL(serverUrl)
    } catch (e) {
      this.showMessage('Please enter a valid server URL (e.g., https://mediacms.example.com)', 'error')
      return
    }

    this.setLoading(true)
    this.messageArea.innerHTML = ''

    try {
      const result = await window.electronAPI.invoke('mediacms:authenticate', {
        serverUrl,
        username,
        password
      })

      if (result.success) {
        this.showMessage('Successfully connected to MediaCMS!', 'success')
        this.updateUIForAuthState(true, serverUrl, username)
      } else {
        this.showMessage(result.error || 'Authentication failed', 'error')
      }
    } catch (error) {
      this.showMessage('Connection error: ' + error.message, 'error')
    } finally {
      this.setLoading(false)
    }
  }

  async handleLogout() {
    if (this.isLoading) return

    const confirmed = confirm('Are you sure you want to disconnect from MediaCMS?')
    if (!confirmed) return

    this.setLoading(true)

    try {
      const result = await window.electronAPI.invoke('mediacms:logout')

      if (result.success) {
        this.showMessage('Disconnected successfully', 'success')
        this.updateUIForAuthState(false)
        this.serverUrlInput.value = ''
        this.usernameInput.value = ''
        this.passwordInput.value = ''
      } else {
        this.showMessage(result.error || 'Logout failed', 'error')
      }
    } catch (error) {
      this.showMessage('Error during logout: ' + error.message, 'error')
    } finally {
      this.setLoading(false)
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new MediaCMSSettingsRenderer()
  })
} else {
  new MediaCMSSettingsRenderer()
}
