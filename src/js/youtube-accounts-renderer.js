class YouTubeAccountsManager {
  constructor(root = document) {
    this.root = root
    this.accounts = []
    this.isAddingAccount = false
    this.init()
  }

  async init() {
    await this.loadAccounts()
    this.setupEventListeners()
    this.renderAccounts()
  }

  setupEventListeners() {
    this.root.querySelector('#addAccountBtn')?.addEventListener('click', () => this.addAccount())
    this.root.querySelector('#closeBtn')?.addEventListener('click', () => {
      if (window.__youtubeAccountsModalMode) {
        document.getElementById('youtubeAccountsOverlay')?.classList.add('hidden')
      } else {
        window.close()
      }
    })

    if (window.electronAPI && window.electronAPI.onYouTubeAuthUpdated) {
      window.electronAPI.onYouTubeAuthUpdated(() => {
        this.loadAccounts().then(() => this.renderAccounts())
      })
    }
  }

  async loadAccounts() {
    try {
      if (window.electronAPI && window.electronAPI.youtubeAccountsList) {
        const result = await window.electronAPI.youtubeAccountsList()
        this.accounts = (result && result.accounts) || []
      }
    } catch (error) {
      this.accounts = []
    }
  }

  async addAccount() {
    if (this.isAddingAccount) {
      return
    }

    const btn = this.root.querySelector('#addAccountBtn')

    try {
      this.isAddingAccount = true
      if (btn) {
        btn.disabled = true
        btn.textContent = '⏳ Connecting...'
      }

      if (window.electronAPI && window.electronAPI.youtubeSignIn) {
        const result = await window.electronAPI.youtubeSignIn()
        if (result && result.success) {
          await this.loadAccounts()
          this.renderAccounts()
        } else if (result && result.error) {
          if (result.needsChannel) {
            alert(
              'No YouTube channel found!\n\nA browser window has been opened to create your channel.\n\nAfter creating your channel, click "Add Account" again.'
            )
          } else {
            alert(result.error)
          }
        }
      }
    } catch (error) {
      alert('Failed to add YouTube account: ' + (error.message || String(error)))
    } finally {
      this.isAddingAccount = false
      if (btn) {
        btn.disabled = false
        btn.textContent = '+ Add Account'
      }
    }
  }

  async removeAccount(accountId) {
    if (!confirm('Are you sure you want to remove this YouTube account?')) {
      return
    }

    try {
      if (window.electronAPI && window.electronAPI.youtubeAccountsRemove) {
        await window.electronAPI.youtubeAccountsRemove(accountId)
        await this.loadAccounts()
        this.renderAccounts()
      }
    } catch (error) {
      alert('Failed to remove account')
    }
  }

  async updateAccount(accountId, changes) {
    try {
      if (window.electronAPI && window.electronAPI.youtubeAccountsUpdate) {
        await window.electronAPI.youtubeAccountsUpdate(accountId, changes)
      }
    } catch (error) {}
  }

  renderAccounts() {
    const container = this.root.querySelector('#accountsList')
    const template = this.root.querySelector('#accountTemplate')

    if (!this.accounts || this.accounts.length === 0) {
      container.innerHTML =
        '<div class="no-accounts">No YouTube accounts connected yet. Click "Add Account" to connect your first profile.</div>'
      return
    }

    container.innerHTML = ''

    this.accounts.forEach(account => {
      const clone = template.content.cloneNode(true)
      const row = clone.querySelector('.account-card')

      const avatarImg = row.querySelector('.account-avatar-img')
      const avatarInitial = row.querySelector('.account-avatar-initial')
      const initial = account.channelName ? account.channelName.substring(0, 1).toUpperCase() : 'Y'

      avatarInitial.textContent = initial

      if (account.thumbnail) {
        avatarImg.src = account.thumbnail
        avatarImg.style.display = 'block'
        avatarInitial.style.display = 'none'
      } else {
        avatarImg.style.display = 'none'
        avatarInitial.style.display = 'inline-block'
      }

      row.querySelector('.account-name').textContent = account.channelName || 'YouTube Channel'
      row.querySelector('.account-email').textContent = account.email || account.channelName || 'Unknown'
      const channelRow = row.querySelector('.account-channel')
      if (channelRow) channelRow.style.display = 'none'

      const statusText = row.querySelector('.status-text')
      const statusDot = row.querySelector('.status-dot')
      const statusPill = row.querySelector('.status-pill')
      const isActive = account.active !== false
      statusText.textContent = isActive ? 'Active' : 'Inactive'
      statusDot.classList.toggle('inactive', !isActive)
      statusPill.classList.toggle('inactive', !isActive)

      const activeCheckbox = row.querySelector('.chk-active')
      activeCheckbox.checked = isActive
      activeCheckbox.addEventListener('change', e => {
        const checked = e.target.checked
        statusText.textContent = checked ? 'Active' : 'Inactive'
        statusDot.classList.toggle('inactive', !checked)
        statusPill.classList.toggle('inactive', !checked)
        this.updateAccount(account.id, { active: checked })
      })

      const privacySelect = row.querySelector('.privacy-select')
      privacySelect.value = account.defaultPrivacy || 'private'
      privacySelect.addEventListener('change', e => {
        this.updateAccount(account.id, { defaultPrivacy: e.target.value })
      })

      const removeBtn = row.querySelector('.btn-remove')
      removeBtn.addEventListener('click', () => this.removeAccount(account.id))

      container.appendChild(row)
    })
  }
}

function bootstrapYouTubeAccountsUI() {
  const root = document.querySelector('[data-youtube-accounts-root]') || document
  if (!root.querySelector('#accountsList')) {
    return
  }

  if (root.__youtubeAccountsUI) {
    root.__youtubeAccountsUI.loadAccounts().then(() => root.__youtubeAccountsUI.renderAccounts())
    return
  }

  root.__youtubeAccountsUI = new YouTubeAccountsManager(root)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapYouTubeAccountsUI)
} else {
  bootstrapYouTubeAccountsUI()
}
