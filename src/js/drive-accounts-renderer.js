class DriveAccountsUI {
  constructor(root = document) {
    this.root = root
    this.listEl = this.root.querySelector('#accountsList')
    this.addBtn = this.root.querySelector('#addAccountBtn')
    this.template = this.root.querySelector('#accountTemplate')
    this.accounts = []

    if (this.addBtn) {
      this.addBtn.addEventListener('click', () => this.addAccount())
    }

    this.loadAccounts()
    if (window.electronAPI && window.electronAPI.onDriveAuthUpdated) {
      window.electronAPI.onDriveAuthUpdated(() => this.loadAccounts().catch(() => {}))
    }
  }

  listAccounts() {
    return this.accounts
  }

  async loadAccounts() {
    try {
      this.listEl.innerHTML = ''
      if (!window.electronAPI || !window.electronAPI.driveAccountsList) {
        this.showError('IPC API not available')
        return
      }

      try {
        if (window.electronAPI.driveAccountsRefreshTokens) {
          const refreshResult = await window.electronAPI.driveAccountsRefreshTokens()
        }
      } catch (refreshErr) {}

      const res = await window.electronAPI.driveAccountsList()
      const accounts = (res && res.accounts) || []
      this.accounts = accounts

      if (!accounts.length) {
        this.listEl.innerHTML = '<div class="p-4 bg-white rounded-lg text-gray-600">No Drive accounts added yet.</div>'
        return
      }

      accounts.forEach(acc => this.renderAccount(acc))
    } catch (err) {
      this.listEl.innerHTML = '<div class="p-4 bg-white rounded-lg text-red-600">Error loading accounts</div>'
    }
  }

  renderAccount(acc) {
    const clone = this.template.content.cloneNode(true)
    const row = clone.querySelector('.account-card')
    const avatarImg = clone.querySelector('.account-avatar-img')
    const avatarInitial = clone.querySelector('.account-avatar-initial')
    const nameEl = clone.querySelector('.account-name')
    const emailEl = clone.querySelector('.account-email')
    const folderEl = clone.querySelector('.account-folder')
    const folderBtn = clone.querySelector('.btn-folder')
    const removeBtn = clone.querySelector('.btn-remove')
    const chkActive = clone.querySelector('.chk-active')
    const statusPill = clone.querySelector('.status-pill')
    const statusDot = clone.querySelector('.status-dot')
    const statusText = clone.querySelector('.status-text')

    const initial =
      acc.displayName && acc.displayName[0]
        ? acc.displayName[0].toUpperCase()
        : acc.email
          ? acc.email[0].toUpperCase()
          : 'A'
    avatarInitial.textContent = initial

    if (acc.avatarUrl) {
      avatarImg.src = acc.avatarUrl
      avatarImg.style.display = 'block'
      avatarInitial.style.display = 'none'
    } else {
      avatarImg.style.display = 'none'
      avatarInitial.style.display = 'inline-block'
    }

    const colors = [
      'from-blue-500 to-purple-600',
      'from-green-500 to-teal-600',
      'from-red-500 to-pink-600',
      'from-yellow-500 to-orange-600',
      'from-indigo-500 to-blue-600',
      'from-purple-500 to-indigo-600'
    ]
    const colorIndex = acc.id ? acc.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length : 0
    const avatarShell = clone.querySelector('.avatar-shell')
    if (avatarShell) {
      avatarShell.className = avatarShell.className.replace(/from-\w+-\d+ to-\w+-\d+/, colors[colorIndex])
    }

    nameEl.textContent = acc.email || acc.displayName || `Account ${acc.id.slice(0, 6)}`
    emailEl.textContent = acc.displayName && acc.displayName !== acc.email ? acc.displayName : ''
    folderEl.textContent = acc.defaultFolderName || 'No folder set'

    const isActive = !!acc.isActive
    chkActive.checked = isActive
    statusText.textContent = isActive ? 'Active' : 'Inactive'
    statusDot.classList.toggle('inactive', !isActive)
    statusPill.classList.toggle('inactive', !isActive)

    chkActive.addEventListener('change', async () => {
      try {
        const checked = chkActive.checked
        await window.electronAPI.driveAccountsUpdate(acc.id, { isActive: checked })
        statusText.textContent = checked ? 'Active' : 'Inactive'
        statusDot.classList.toggle('inactive', !checked)
        statusPill.classList.toggle('inactive', !checked)
        this.showSuccess('Account updated')
      } catch (e) {
        this.showError('Failed to update account')
        chkActive.checked = !chkActive.checked
      }
    })

    folderBtn.addEventListener('click', async () => {
      try {
        const selected = await this.chooseFolderForAccount(acc.id)
        if (selected) {
          await window.electronAPI.driveAccountsUpdate(acc.id, {
            defaultFolderId: selected.id,
            defaultFolderName: selected.name
          })
          this.showSuccess('Default folder saved')
          this.loadAccounts()
        }
      } catch (e) {
        this.showError('Failed to set folder')
      }
    })

    removeBtn.addEventListener('click', async () => {
      if (!confirm(`Remove account ${acc.email || acc.displayName || acc.id}? This will unlink it from StreamSnap.`))
        return
      try {
        await window.electronAPI.driveAccountsRemove(acc.id)
        this.showSuccess('Account removed')
        this.loadAccounts()
      } catch (e) {
        this.showError('Failed to remove account')
      }
    })

    this.listEl.appendChild(clone)
  }

  async addAccount() {
    try {
      this.addBtn.disabled = true
      this.addBtn.textContent = 'Adding...'

      const CANCEL_ID = 'addAccountCancelBtn'
      let cancelBtn = this.root.querySelector(`#${CANCEL_ID}`)
      let aborted = false
      if (!cancelBtn) {
        cancelBtn = document.createElement('button')
        cancelBtn.id = CANCEL_ID
        cancelBtn.type = 'button'
        cancelBtn.className = 'ml-2 px-3 py-2 bg-red-500 text-white rounded'
        cancelBtn.textContent = 'Cancel'
        cancelBtn.addEventListener('click', () => {
          aborted = true
          try {
            cancelBtn.remove()
          } catch (e) {}
          this.addBtn.disabled = false
          this.addBtn.textContent = '+ Add account'
          this.showError('Adding account cancelled by user')
        })
        this.addBtn.parentNode && this.addBtn.parentNode.insertBefore(cancelBtn, this.addBtn.nextSibling)
      }

      const res = await window.electronAPI.driveAccountsCreate()
      if (aborted) {
        return
      }

      if (res && res.success) {
        this.showSuccess('Account added')
        this.loadAccounts()
      } else {
        this.showError(res && res.error ? res.error : 'Failed to add account')
      }
    } catch (e) {
      this.showError('Failed to add account')
    } finally {
      this.addBtn.disabled = false
      this.addBtn.textContent = '+ Add account'
      try {
        const b = this.root.querySelector('#addAccountCancelBtn')
        if (b) b.remove()
      } catch (e) {}
    }
  }

  async chooseFolderForAccount(accountId) {
    try {
      const res = await window.electronAPI.getDriveFoldersForAccount(accountId)
      const folders = Array.isArray(res) ? res : (res && res.files) || []

      return await new Promise(resolve => {
        const modal = document.createElement('div')
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
        modal.innerHTML = `
          <div class="bg-white rounded-lg p-4 w-full max-w-lg mx-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-semibold">Select Drive Folder</h3>
              <div>
                <input id="folderSearch" placeholder="Search..." class="px-3 py-2 border rounded mr-2" />
                <button id="cancelBtn" class="px-3 py-2">Cancel</button>
              </div>
            </div>
            <div class="max-h-64 overflow-y-auto border rounded p-2" id="folderList"></div>
          </div>
        `
        document.body.appendChild(modal)
        const folderList = modal.querySelector('#folderList')
        const cancelBtn = modal.querySelector('#cancelBtn')
        const searchInput = modal.querySelector('#folderSearch')

        const render = list => {
          folderList.innerHTML = ''
          if (!list || !list.length) {
            folderList.innerHTML = '<div class="p-3 text-gray-500">No folders found</div>'
            return
          }
          list.forEach(f => {
            const btn = document.createElement('button')
            btn.className = 'w-full text-left px-3 py-2 hover:bg-gray-100 rounded'
            btn.textContent = f.name
            btn.addEventListener('click', () => {
              cleanup()
              resolve({ id: f.id, name: f.name })
            })
            folderList.appendChild(btn)
          })
        }

        render(folders)

        const cleanup = () => {
          try {
            modal.remove()
          } catch (e) {}
        }

        cancelBtn.addEventListener('click', () => {
          cleanup()
          resolve(null)
        })

        let debounce = null
        searchInput.addEventListener('input', () => {
          clearTimeout(debounce)
          debounce = setTimeout(async () => {
            const q = searchInput.value.trim()
            try {
              const page = await window.electronAPI.getDriveFoldersPagedForAccount(accountId, { nameQuery: q })
              const files = (page && page.files) || page || []
              render(files)
            } catch (e) {}
          }, 300)
        })
      })
    } catch (e) {
      if (e.message && e.message.includes('Not authenticated')) {
        const account = this.listAccounts().find(a => a.id === accountId)
        const accountName = account?.email || account?.displayName || 'Unknown account'

        this.showError(`Account "${accountName}" authentication expired. Attempting to refresh token...`)

        try {
          const authResult = await window.electronAPI.driveAccountsHandleAuthError(accountId)
          if (authResult && authResult.success && authResult.refreshed) {
            this.showSuccess(`Account "${accountName}" token refreshed successfully. Please try again.`)
            this.loadAccounts()
          } else if (authResult && authResult.shouldRemove) {
            this.showError(
              `Account "${accountName}" could not be refreshed and will be removed. Error: ${authResult.error}`
            )
            try {
              await window.electronAPI.driveAccountsRemove(accountId)
              this.loadAccounts()
            } catch (removeErr) {
              this.showError('Failed to remove expired account. Please remove manually.')
            }
          }
        } catch (handleErr) {
          this.showError(`Failed to handle authentication error for account "${accountName}"`)
        }
      } else {
        this.showError(`Failed to load folders: ${e.message}`)
      }
      return null
    }
  }

  showError(msg) {
    const toast = document.createElement('div')
    toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
    toast.textContent = msg
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 4000)
  }

  showSuccess(msg) {
    const toast = document.createElement('div')
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
    toast.textContent = msg
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
  }
}

function bootstrapDriveAccountsUI() {
  const root = document.querySelector('[data-drive-accounts-root]') || document
  if (!root.querySelector('#accountsList')) {
    return
  }

  if (root.__driveAccountsUI) {
    root.__driveAccountsUI.loadAccounts().catch(() => {})
    return
  }

  root.__driveAccountsUI = new DriveAccountsUI(root)
  window.driveAccountsUI = root.__driveAccountsUI

  const closeBtn = root.querySelector('#closeBtn')
  if (closeBtn && !closeBtn._driveAccountsCloseBound) {
    closeBtn._driveAccountsCloseBound = true
    closeBtn.addEventListener('click', () => {
      if (window.__driveAccountsModalMode) {
        document.getElementById('driveAccountsOverlay')?.classList.add('hidden')
      } else {
        window.close()
      }
    })
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapDriveAccountsUI)
} else {
  bootstrapDriveAccountsUI()
}
